/**
 * Domain types. These describe basketball, not any particular API.
 *
 * Nothing outside src/data/ should ever see a provider's wire format — providers
 * normalize into these types, so swapping mock for live data changes no UI code.
 */

export type LeagueId = 'nba';

export interface League {
  id: LeagueId;
  name: string;
  abbreviation: string;
}

export type ConferenceId = 'east' | 'west';

/** A team as referenced from a game — enough to render a row, no more. */
export interface TeamRef {
  id: string;
  name: string;
  /** Full club name, e.g. "Boston Celtics". */
  displayName: string;
  abbreviation: string;
  /** Hex color used for the logo bubble. Sourced per team, not from tokens. */
  color: string;
  logoUrl?: string;
  record?: string;
}

export type GameStatus = 'scheduled' | 'live' | 'final';

/** Period 1-4 are quarters; 5+ are overtimes. */
export interface Period {
  number: number;
  label: string;
  awayScore: number;
  homeScore: number;
}

/**
 * Status is a discriminated union rather than optional fields, so it is
 * impossible to represent "final but still has a game clock".
 */
export type GameState =
  | { status: 'scheduled'; tipoff: string }
  | { status: 'live'; periodNumber: number; periodLabel: string; clock: string }
  | { status: 'final'; wentToOvertime: boolean };

export interface Game {
  id: string;
  league: LeagueId;
  /** ISO 8601 UTC instant of scheduled tipoff. */
  startsAt: string;
  state: GameState;
  away: TeamRef;
  home: TeamRef;
  awayScore: number;
  homeScore: number;
}

export interface TeamStat {
  label: string;
  awayValue: string;
  homeValue: string;
  /** Normalized 0-1 share for the comparison bars. */
  awayShare: number;
}

export interface PlayerStatLine {
  playerId: string;
  name: string;
  position: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  /** Absent for a player who has not appeared yet. */
  plusMinus?: number;
}

export interface StatLeader {
  stat: 'points' | 'rebounds' | 'assists';
  away: PlayerStatLine;
  home: PlayerStatLine;
}

export interface BoxScore {
  away: PlayerStatLine[];
  home: PlayerStatLine[];
}

export interface GameDetail extends Game {
  periods: Period[];
  teamStats: TeamStat[];
  boxScore: BoxScore;
  topPerformers: PlayerStatLine[];
  statLeaders: StatLeader[];
}

export interface PlayEvent {
  id: string;
  periodNumber: number;
  clock: string;
  /** Absent on game-level events like "End of Game". */
  teamId?: string;
  description: string;
  isScoringPlay: boolean;
  awayScore: number;
  homeScore: number;
}

export interface Standing {
  rank: number;
  team: TeamRef;
  wins: number;
  losses: number;
  /** Win percentage, 0-1. Formatted at the edge, not here. */
  winPercent: number;
  /** Games behind the conference leader. 0 for the leader. */
  gamesBehind: number;
  streak: string;
}

export interface Conference {
  id: ConferenceId;
  name: string;
  standings: Standing[];
}

/**
 * One season-average tile. A list rather than fixed fields because providers
 * expose different stats, and the page just renders what it is given.
 */
export interface StatTile {
  label: string;
  value: string;
  /** League rank for this stat, where the provider reports one. */
  rank?: number;
}

/** A player's season averages. Percentages are 0-100, like ShootingSplit. */
export interface SeasonAverages {
  points: number;
  rebounds: number;
  assists: number;
  fieldGoalPercent: number;
}

/**
 * The pregame counterpart to PlayerStatLine: before tipoff there is no game to
 * report, so the box score shows who is available and how they have played.
 */
export interface RosterEntry {
  playerId: string;
  /** Full name; the table abbreviates it, as the box score does. */
  name: string;
  /** Position abbreviation, e.g. `G`. */
  position: string;
  /** As the source formats it; empty where the source omits it. */
  jerseyNumber: string;
  /** Absent for a player who has not appeared this season. */
  seasonAverages?: SeasonAverages;
}

export interface ShootingSplit {
  label: string;
  made: number;
  attempted: number;
  /** 0-100. */
  percent: number;
}

export interface GameLogEntry {
  gameId: string;
  opponentAbbreviation: string;
  isHome: boolean;
  result: string;
  points: number;
  rebounds: number;
  assists: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  position: string;
  jerseyNumber: string;
  /** As the source formats it, e.g. `6' 6"`. */
  height: string;
  age: number;
  seasonNumber: number;
  seasonAverages: StatTile[];
  shootingSplits: ShootingSplit[];
  gameLog: GameLogEntry[];
}
