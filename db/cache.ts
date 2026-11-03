/**
 * Write-through cache for fetched games and standings.
 *
 * What it is for: the proxy's in-memory cache lives for twelve seconds on one
 * warm instance. This one outlives the request, which is what makes the data
 * checkable — the SQL assertions in db/validations/ run against these tables,
 * and M7's health page reads `fetched_at` out of them.
 *
 * What it is not: a read path for the client. The proxy still answers from
 * ESPN. Nothing here can make a request fail; see `cacheGames`.
 *
 * SQL is inline and parameterized rather than loaded from disk, because this
 * module runs in an edge function with no filesystem. The schema in
 * db/migrations/ is applied out of band by `npm run db:migrate`.
 */

import type { Conference, Game, Period } from '../src/data/types';
import type { SqlClient } from './sql';

export interface CachedGame {
  game: Game;
  periods: Period[];
}

export interface CachedGameRow {
  id: string;
  status: string;
  away_team: string;
  away_score: number;
  home_team: string;
  home_score: number;
  fetched_at: string;
}

const UPSERT_GAME = `
  insert into cached_games (
    id, league, starts_at, status,
    away_team_id, away_team, away_score,
    home_team_id, home_team, home_score, fetched_at
  )
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
  on conflict (id) do update set
    status     = excluded.status,
    away_score = excluded.away_score,
    home_score = excluded.home_score,
    fetched_at = excluded.fetched_at
`;

const UPSERT_PERIOD = `
  insert into cached_game_periods (game_id, period, away_score, home_score)
  values ($1, $2, $3, $4)
  on conflict (game_id, period) do update set
    away_score = excluded.away_score,
    home_score = excluded.home_score
`;

/**
 * Upserting periods is not enough on its own: a game corrected downward — an
 * overtime reversed, or a mis-parsed fifth period — would leave a stale row
 * behind and break the score-equals-quarters invariant the validations assert.
 * So anything not in the set just written goes.
 *
 * Matched against the period numbers rather than a count, because a stale row
 * need not be the highest-numbered one.
 */
const DELETE_STALE_PERIODS = `
  delete from cached_game_periods
  where game_id = $1 and period <> all($2::int[])
`;

export async function saveGames(client: SqlClient, games: CachedGame[]): Promise<void> {
  for (const { game, periods } of games) {
    await client.query(UPSERT_GAME, [
      game.id,
      game.league,
      game.startsAt,
      game.state.status,
      game.away.id,
      game.away.displayName,
      game.awayScore,
      game.home.id,
      game.home.displayName,
      game.homeScore,
    ]);

    for (const period of periods) {
      await client.query(UPSERT_PERIOD, [
        game.id,
        period.number,
        period.awayScore,
        period.homeScore,
      ]);
    }

    await client.query(DELETE_STALE_PERIODS, [
      game.id,
      periods.map((period) => period.number),
    ]);
  }
}

const UPSERT_STANDING = `
  insert into cached_standings (
    conference, team_id, team_name, seed, wins, losses, games_behind, streak, fetched_at
  )
  values ($1, $2, $3, $4, $5, $6, $7, $8, now())
  on conflict (conference, team_id) do update set
    team_name    = excluded.team_name,
    seed         = excluded.seed,
    wins         = excluded.wins,
    losses       = excluded.losses,
    games_behind = excluded.games_behind,
    streak       = excluded.streak,
    fetched_at   = excluded.fetched_at
`;

/**
 * Standings are replaced per conference, not upserted row by row. Seeds are
 * unique within a conference, so shuffling two teams past each other would
 * collide mid-update against the rows still holding the old seeds.
 */
export async function saveStandings(
  client: SqlClient,
  conferences: Conference[],
): Promise<void> {
  for (const conference of conferences) {
    await client.query(`delete from cached_standings where conference = $1`, [
      conference.id,
    ]);

    for (const row of conference.standings) {
      await client.query(UPSERT_STANDING, [
        conference.id,
        row.team.id,
        row.team.displayName,
        row.rank,
        row.wins,
        row.losses,
        row.gamesBehind,
        row.streak,
      ]);
    }
  }
}

export async function readGames(client: SqlClient): Promise<CachedGameRow[]> {
  return client.query<CachedGameRow>(`
    select id, status, away_team, away_score, home_team, home_score, fetched_at
    from cached_games
    order by starts_at, id
  `);
}

export interface CacheAge {
  table: string;
  rows: number;
  newest: string | null;
}

/** What M7's health page needs: how much is stored and how stale it is. */
export async function cacheAge(client: SqlClient): Promise<CacheAge[]> {
  // A literal list, not input — a table name cannot be a bound parameter.
  const tables = ['cached_games', 'cached_standings'] as const;
  const ages: CacheAge[] = [];

  for (const table of tables) {
    const [row] = await client.query<{ rows: string; newest: string | null }>(
      `select count(*)::text as rows, max(fetched_at)::text as newest from ${table}`,
    );
    ages.push({ table, rows: Number(row?.rows ?? 0), newest: row?.newest ?? null });
  }

  return ages;
}

/**
 * Fire-and-forget write used by the proxy routes.
 *
 * A cache failure must never turn a good ESPN response into a 502, so this
 * swallows everything and logs. The route does not await it.
 */
export async function cacheQuietly(
  write: (client: SqlClient) => Promise<void>,
  getClient: () => Promise<SqlClient | null>,
): Promise<void> {
  try {
    const client = await getClient();
    if (!client) return;
    await write(client);
  } catch (error) {
    console.error('[courtside-cache] write failed', error);
  }
}
