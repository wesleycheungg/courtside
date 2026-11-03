// @vitest-environment node
/**
 * Cache write behaviour, against real Postgres (PGlite) and real captured
 * ESPN responses.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  espnScoreboardSchema,
  espnStandingsSchema,
  espnTeamsSchema,
} from '../src/data/espn/espnSchemas';
import scoreboardFixture from '../src/data/espn/fixtures/scoreboard-final-2026-11-02.json';
import scheduledFixture from '../src/data/espn/fixtures/scoreboard-scheduled-2026-11-04.json';
import standingsFixture from '../src/data/espn/fixtures/standings-2026-11-03.json';
import teamsFixture from '../src/data/espn/fixtures/teams-2026-11-03.json';
import { cacheAge, cacheQuietly, readGames, saveGames, saveStandings } from './cache';
import { cachedGamesFrom, cachedStandingsFrom } from './rows';
import { createTestDatabase, type TestDatabase } from './testdb';
import type { SqlClient } from './sql';

const scoreboard = espnScoreboardSchema.parse(scoreboardFixture);
const scheduled = espnScoreboardSchema.parse(scheduledFixture);
const standings = espnStandingsSchema.parse(standingsFixture);
const teams = espnTeamsSchema.parse(teamsFixture);

let db: TestDatabase;

// One PGlite per file; see the note on createTestDatabase.
beforeAll(async () => {
  db = await createTestDatabase();
}, 60_000);

beforeEach(() => db.reset());

afterAll(() => db.close());

describe('saveGames', () => {
  it('stores every game in a captured slate', async () => {
    await saveGames(db, cachedGamesFrom(scoreboard));

    const rows = await readGames(db);
    expect(rows).toHaveLength(scoreboard.events.length);
    expect(rows.every((row) => row.status === 'final')).toBe(true);
  });

  it('stores a quarter row per period played', async () => {
    const games = cachedGamesFrom(scoreboard);
    await saveGames(db, games);

    const expected = games.reduce((total, game) => total + game.periods.length, 0);
    const [count] = await db.query<{ n: string }>(
      'select count(*)::text as n from cached_game_periods',
    );
    expect(Number(count?.n)).toBe(expected);
  });

  it('stores a scheduled game with no periods at all', async () => {
    await saveGames(db, cachedGamesFrom(scheduled));

    const rows = await readGames(db);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.status === 'scheduled')).toBe(true);

    const [count] = await db.query<{ n: string }>(
      'select count(*)::text as n from cached_game_periods',
    );
    expect(Number(count?.n)).toBe(0);
  });

  it('is idempotent — the same slate written twice leaves one row per game', async () => {
    await saveGames(db, cachedGamesFrom(scoreboard));
    await saveGames(db, cachedGamesFrom(scoreboard));

    expect(await readGames(db)).toHaveLength(scoreboard.events.length);
  });

  it('updates a score in place as a game progresses', async () => {
    const [first] = cachedGamesFrom(scoreboard);
    expect(first).toBeDefined();

    const live = {
      game: {
        ...first!.game,
        state: { status: 'live', periodNumber: 2, periodLabel: 'Q2', clock: '5:00' },
        awayScore: 48,
        homeScore: 51,
      } as const,
      periods: first!.periods.slice(0, 2),
    };
    await saveGames(db, [live]);
    await saveGames(db, [first!]);

    const rows = await readGames(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('final');
    expect(rows[0]?.away_score).toBe(first!.game.awayScore);
  });

  it('drops period rows a later fetch no longer reports', async () => {
    // An overtime that gets corrected away, or a mis-parsed fifth period: the
    // stale row would break score-equals-quarters if it survived.
    const [game] = cachedGamesFrom(scoreboard);
    const withExtra = {
      game: game!.game,
      periods: [
        ...game!.periods,
        { number: 9, label: 'OT5', awayScore: 7, homeScore: 7 },
      ],
    };

    await saveGames(db, [withExtra]);
    expect(await periodCount(db, game!.game.id)).toBe(game!.periods.length + 1);

    await saveGames(db, [game!]);
    expect(await periodCount(db, game!.game.id)).toBe(game!.periods.length);
  });

  it('refuses a row where one team plays itself', async () => {
    const [game] = cachedGamesFrom(scoreboard);
    const broken = {
      game: { ...game!.game, home: { ...game!.game.away } },
      periods: [],
    };

    await expect(saveGames(db, [broken])).rejects.toThrow(/cached_games_distinct_teams/);
  });

  it('refuses a negative score', async () => {
    const [game] = cachedGamesFrom(scoreboard);
    const broken = { game: { ...game!.game, awayScore: -1 }, periods: [] };

    await expect(saveGames(db, [broken])).rejects.toThrow(/away_score/);
  });
});

describe('saveStandings', () => {
  it('stores both conferences with dense seeds', async () => {
    const conferences = cachedStandingsFrom(standings, teams);
    await saveStandings(db, conferences);

    const rows = await db.query<{ conference: string; seed: number }>(
      'select conference, seed from cached_standings order by conference, seed',
    );
    expect(rows).toHaveLength(
      conferences.reduce((total, conference) => total + conference.standings.length, 0),
    );
    expect(new Set(rows.map((row) => row.conference))).toEqual(new Set(['east', 'west']));
  });

  it('replaces a conference rather than merging into it', async () => {
    const conferences = cachedStandingsFrom(standings, teams);
    await saveStandings(db, conferences);

    // Two teams swapping seeds would collide on the unique (conference, seed)
    // index if the write merged instead of replacing.
    const east = conferences.find((conference) => conference.id === 'east');
    expect(east).toBeDefined();
    const [first, second, ...rest] = east!.standings;
    const swapped = {
      ...east!,
      standings: [{ ...second!, rank: 1 }, { ...first!, rank: 2 }, ...rest],
    };

    await saveStandings(db, [swapped]);

    const [leader] = await db.query<{ team_name: string }>(
      `select team_name from cached_standings where conference = 'east' and seed = 1`,
    );
    expect(leader?.team_name).toBe(second!.team.displayName);
  });

  it('works without a teams payload to join colours from', async () => {
    await saveStandings(db, cachedStandingsFrom(standings));

    const [count] = await db.query<{ n: string }>(
      'select count(*)::text as n from cached_standings',
    );
    expect(Number(count?.n)).toBeGreaterThan(0);
  });
});

describe('cacheAge', () => {
  it('reports row counts and the newest fetch per table', async () => {
    await saveGames(db, cachedGamesFrom(scoreboard));

    const ages = await cacheAge(db);
    const games = ages.find((age) => age.table === 'cached_games');
    const standingsAge = ages.find((age) => age.table === 'cached_standings');

    expect(games?.rows).toBe(scoreboard.events.length);
    expect(games?.newest).not.toBeNull();
    // Nothing written yet, which is a legitimate answer, not an error.
    expect(standingsAge).toEqual({ table: 'cached_standings', rows: 0, newest: null });
  });
});

describe('cacheQuietly', () => {
  it('does nothing when no database is configured', async () => {
    const write = vi.fn();

    await cacheQuietly(write, async () => null);

    expect(write).not.toHaveBeenCalled();
  });

  it('swallows a write failure so a good ESPN response still gets served', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      cacheQuietly(
        () => Promise.reject(new Error('connection refused')),
        () => Promise.resolve(db as SqlClient),
      ),
    ).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledWith(
      '[courtside-cache] write failed',
      expect.any(Error),
    );
    logged.mockRestore();
  });

  it('swallows a failure to connect at all', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      cacheQuietly(
        () => Promise.resolve(),
        () => Promise.reject(new Error('DATABASE_URL is nonsense')),
      ),
    ).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it('writes through when a client is available', async () => {
    await cacheQuietly(
      (client) => saveGames(client, cachedGamesFrom(scoreboard)),
      () => Promise.resolve(db as SqlClient),
    );

    expect(await readGames(db)).toHaveLength(scoreboard.events.length);
  });
});

async function periodCount(client: SqlClient, gameId: string): Promise<number> {
  const [row] = await client.query<{ n: string }>(
    'select count(*)::text as n from cached_game_periods where game_id = $1',
    [gameId],
  );
  return Number(row?.n ?? 0);
}
