/**
 * The mock fixtures' wire format.
 *
 * Deliberately shaped like a feed rather than like our domain types — split
 * market/nickname, a status code, hex without the `#`, per-period line scores
 * instead of totals. Normalization therefore does real work, and the unit tests
 * that cover it are testing the same code path a live provider will use.
 */

export interface WireTeam {
  teamId: string;
  market: string;
  nickname: string;
  abbrev: string;
  colorHex: string;
  conference: 'east' | 'west';
}

export interface WireRecord {
  wins: number;
  losses: number;
}

export interface WireLineScore {
  period: number;
  away: number;
  home: number;
}

/** `pre` = not started, `in` = in progress, `post` = finished. */
export type WireStatusCode = 'pre' | 'in' | 'post';

export interface WireGame {
  gameId: string;
  league: string;
  /** Time of day in UTC; combined with the requested date at read time. */
  tipoffUtc: string;
  /**
   * Days to add to the slate date before applying `tipoffUtc`. A US evening
   * game tips after midnight UTC, so it belongs to the next UTC day while
   * still being part of that evening's slate. Defaults to 0.
   */
  tipoffDayOffset?: number;
  statusCode: WireStatusCode;
  awayTeamId: string;
  homeTeamId: string;
  awayRecord: WireRecord;
  homeRecord: WireRecord;
  linescores: WireLineScore[];
}

/** Per-game averages, as a feed sends them: raw stat names, strings. */
export interface WireRosterStats {
  avgPoints: string;
  avgRebounds: string;
  avgAssists: string;
  fieldGoalPct: string;
}

export interface WireRosterPlayer {
  playerId: string;
  firstName: string;
  lastName: string;
  jersey: string;
  positionAbbrev: string;
  /** Absent for a player who has not appeared this season — never zeroed. */
  stats?: WireRosterStats;
}

/**
 * Keyed by teamId. Only the teams that can appear in a `pre` game need an
 * entry; the mock provider throws for anything else, so a new scheduled
 * fixture without a roster fails loudly rather than rendering an empty table.
 */
export type WireRosters = Record<string, WireRosterPlayer[]>;

export interface WireStandingRow {
  teamId: string;
  wins: number;
  losses: number;
  streak: string;
}

export interface WireStandings {
  east: WireStandingRow[];
  west: WireStandingRow[];
}
