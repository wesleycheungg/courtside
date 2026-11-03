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
  statusCode: WireStatusCode;
  awayTeamId: string;
  homeTeamId: string;
  awayRecord: WireRecord;
  homeRecord: WireRecord;
  linescores: WireLineScore[];
}

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
