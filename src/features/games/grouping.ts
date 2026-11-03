import type { Game, GameStatus, LeagueId } from '../../data/types';

export type FeedFilter = 'all' | 'live';

/** Live games first, then finals, then what has yet to tip off. */
const STATUS_ORDER: Record<GameStatus, number> = {
  live: 0,
  final: 1,
  scheduled: 2,
};

export interface LeagueGroup {
  league: LeagueId;
  name: string;
  games: Game[];
}

const LEAGUE_NAMES: Record<LeagueId, string> = {
  nba: 'NBA',
};

export function countLive(games: Game[]): number {
  return games.filter((game) => game.state.status === 'live').length;
}

export function applyFilter(games: Game[], filter: FeedFilter): Game[] {
  return filter === 'live' ? games.filter((g) => g.state.status === 'live') : games;
}

/** Status first, then tip-off time, so the order is stable across refetches. */
export function sortGames(games: Game[]): Game[] {
  return [...games].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.state.status] - STATUS_ORDER[b.state.status];
    if (byStatus !== 0) return byStatus;
    return a.startsAt.localeCompare(b.startsAt);
  });
}

/**
 * Groups into the league sections the design shows. Only the NBA is populated
 * today; the grouping exists so adding a competition is a data change.
 */
export function groupByLeague(games: Game[]): LeagueGroup[] {
  const byLeague = new Map<LeagueId, Game[]>();

  for (const game of games) {
    const existing = byLeague.get(game.league);
    if (existing) existing.push(game);
    else byLeague.set(game.league, [game]);
  }

  return [...byLeague.entries()].map(([league, leagueGames]) => ({
    league,
    name: LEAGUE_NAMES[league],
    games: sortGames(leagueGames),
  }));
}

/** Whether this team won a finished game. Live and scheduled games have no winner. */
export function isWinner(game: Game, side: 'away' | 'home'): boolean {
  if (game.state.status !== 'final') return false;
  return side === 'away'
    ? game.awayScore > game.homeScore
    : game.homeScore > game.awayScore;
}

/**
 * Whether to dim this team. Only the losing side of a finished game dims — a
 * live game shows both scores at full strength, as in the design.
 */
export function isDimmed(game: Game, side: 'away' | 'home'): boolean {
  if (game.state.status !== 'final') return false;
  return !isWinner(game, side) && game.awayScore !== game.homeScore;
}
