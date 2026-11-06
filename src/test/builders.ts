/**
 * Builders for domain objects.
 *
 * Tests state only the fields they care about; everything else gets a sane
 * default. That keeps a test's intent visible and stops an unrelated type
 * change from touching every test file.
 */

import type {
  BoxScore,
  Conference,
  Game,
  GameDetail,
  GameState,
  PlayEvent,
  Player,
  PlayerStatLine,
  RosterEntry,
  Standing,
  TeamRef,
} from '../data/types';
import type { DataProvider } from '../data/provider';

/**
 * Like Partial, but allows an explicit `undefined` so a test can say "this
 * field is absent". Plain Partial forbids that under
 * exactOptionalPropertyTypes.
 */
type Overrides<T> = { [K in keyof T]?: T[K] | undefined };

/**
 * Merges overrides over defaults, treating an explicit `undefined` as "remove
 * this field" rather than letting it through as a hole. That is what lets a
 * test say `aTeam({ record: undefined })` to model a team with no record.
 */
function build<T extends object>(defaults: T, overrides: Overrides<T>): T {
  const merged = { ...defaults, ...overrides };
  for (const key of Object.keys(merged) as (keyof T)[]) {
    if (merged[key] === undefined) delete merged[key];
  }
  return merged as T;
}

export function aTeam(overrides: Overrides<TeamRef> = {}): TeamRef {
  return build(
    {
      id: 'bos',
      name: 'Celtics',
      displayName: 'Boston Celtics',
      abbreviation: 'BOS',
      color: '#007A33',
      record: '5-2',
    },
    overrides,
  );
}

export const liveState: GameState = {
  status: 'live',
  periodNumber: 3,
  periodLabel: 'Q3',
  clock: '4:12',
};

export const finalState: GameState = { status: 'final', wentToOvertime: false };

export const scheduledState: GameState = {
  status: 'scheduled',
  tipoff: '2026-11-02T23:30:00.000Z',
};

export function aGame(overrides: Overrides<Game> = {}): Game {
  return build(
    {
      id: 'game-1',
      league: 'nba',
      startsAt: '2026-11-02T23:30:00.000Z',
      state: finalState,
      away: aTeam({ id: 'nyk', name: 'Knicks', abbreviation: 'NYK', color: '#1D5FB3' }),
      home: aTeam(),
      awayScore: 104,
      homeScore: 118,
    },
    overrides,
  );
}

export function aStatLine(overrides: Overrides<PlayerStatLine> = {}): PlayerStatLine {
  return build(
    {
      playerId: 'tatum',
      name: 'Jayson Tatum',
      position: 'F',
      jerseyNumber: '0',
      minutes: 30,
      points: 28,
      rebounds: 9,
      assists: 5,
      fieldGoalsMade: 10,
      fieldGoalsAttempted: 19,
      plusMinus: 7,
    },
    overrides,
  );
}

export function aBoxScore(overrides: Overrides<BoxScore> = {}): BoxScore {
  return build(
    {
      away: [
        aStatLine({
          playerId: 'brunson',
          name: 'Jalen Brunson',
          jerseyNumber: '11',
          points: 31,
        }),
      ],
      home: [aStatLine()],
    },
    overrides,
  );
}

export function aGameDetail(overrides: Overrides<GameDetail> = {}): GameDetail {
  const base = aGame();
  const boxScore = overrides.boxScore ?? aBoxScore();
  const awayLeader = boxScore.away[0] ?? aStatLine();
  const homeLeader = boxScore.home[0] ?? aStatLine();

  return build(
    {
      ...base,
      periods: [
        { number: 1, label: 'Q1', awayScore: 24, homeScore: 31 },
        { number: 2, label: 'Q2', awayScore: 29, homeScore: 28 },
        { number: 3, label: 'Q3', awayScore: 26, homeScore: 30 },
        { number: 4, label: 'Q4', awayScore: 25, homeScore: 29 },
      ],
      teamStats: [
        { label: 'Rebounds', awayValue: '40', homeValue: '46', awayShare: 0.47 },
      ],
      boxScore,
      topPerformers: [homeLeader],
      statLeaders: [
        { stat: 'points', away: awayLeader, home: homeLeader },
        { stat: 'rebounds', away: awayLeader, home: homeLeader },
        { stat: 'assists', away: awayLeader, home: homeLeader },
      ],
    },
    overrides,
  );
}

export function aPlay(overrides: Overrides<PlayEvent> = {}): PlayEvent {
  return build(
    {
      id: 'play-1',
      periodNumber: 3,
      clock: '4:12',
      teamId: 'bos',
      description: 'Jayson Tatum makes 26-foot three point jumper',
      isScoringPlay: true,
      awayScore: 82,
      homeScore: 87,
    },
    overrides,
  );
}

export function aStanding(overrides: Overrides<Standing> = {}): Standing {
  return build(
    {
      rank: 1,
      team: aTeam(),
      wins: 6,
      losses: 0,
      winPercent: 1,
      gamesBehind: 0,
      streak: 'W6',
    },
    overrides,
  );
}

export function aConference(overrides: Overrides<Conference> = {}): Conference {
  return build(
    {
      id: 'east',
      name: 'Eastern Conference',
      standings: [aStanding()],
    },
    overrides,
  );
}

export function aRosterEntry(overrides: Overrides<RosterEntry> = {}): RosterEntry {
  return build(
    {
      playerId: 'tatum',
      name: 'Jayson Tatum',
      position: 'F',
      jerseyNumber: '0',
      seasonAverages: {
        points: 27.4,
        rebounds: 8.6,
        assists: 5.1,
        fieldGoalPercent: 46.2,
      },
    },
    overrides,
  );
}

export function aPlayer(overrides: Overrides<Player> = {}): Player {
  return build(
    {
      id: 'tatum',
      name: 'Jayson Tatum',
      teamId: 'bos',
      teamName: 'Boston Celtics',
      teamColor: '#007A33',
      position: 'Forward',
      jerseyNumber: '0',
      height: `6' 8"`,
      age: 28,
      seasonNumber: 10,
      seasonAverages: [{ label: 'PTS', value: '27.4', rank: 6 }],
      shootingSplits: [
        { label: 'Field goals', made: 101, attempted: 219, percent: 46.1 },
      ],
      gameLog: [
        {
          gameId: 'g1',
          opponentAbbreviation: 'NYK',
          isHome: true,
          result: 'W 121-108',
          points: 28,
          rebounds: 9,
          assists: 5,
          fieldGoalsMade: 10,
          fieldGoalsAttempted: 19,
        },
      ],
    },
    overrides,
  );
}

type ProviderOverrides = Overrides<Omit<DataProvider, 'name'>> & { name?: string };

/** A provider returning whatever the test hands it; unstubbed calls throw. */
export function stubProvider(overrides: ProviderOverrides = {}): DataProvider {
  const unimplemented = (method: string) => () =>
    Promise.reject(new Error(`stubProvider.${method} was not stubbed`));

  return {
    name: overrides.name ?? 'stub',
    getGames: overrides.getGames ?? unimplemented('getGames'),
    getGame: overrides.getGame ?? unimplemented('getGame'),
    getStandings: overrides.getStandings ?? unimplemented('getStandings'),
    getPlayer: overrides.getPlayer ?? unimplemented('getPlayer'),
    getTeamRoster: overrides.getTeamRoster ?? unimplemented('getTeamRoster'),
    getPlayByPlay: overrides.getPlayByPlay ?? unimplemented('getPlayByPlay'),
  };
}
