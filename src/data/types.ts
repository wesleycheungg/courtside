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
}

export interface PlayEvent {
  id: string;
  periodNumber: number;
  clock: string;
  teamId: string;
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

export interface SeasonAverages {
  points: number;
  rebounds: number;
  assists: number;
  fieldGoalPercent: number;
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
  heightInches: number;
  age: number;
  seasonNumber: number;
  seasonAverages: SeasonAverages;
  gameLog: GameLogEntry[];
}
