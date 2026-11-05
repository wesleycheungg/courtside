import { describe, expect, it } from 'vitest';
import {
  gamesBehind,
  normalizeConference,
  normalizeGame,
  normalizeGameState,
  normalizePeriods,
  normalizeRosterPlayer,
  normalizeTeam,
  periodLabel,
  toIsoInstant,
  totalsFromPeriods,
  winPercent,
} from './normalize';
import type { WireGame, WireRosterPlayer, WireTeam } from './wire';
import teamsFixture from './fixtures/teams.json';
import gamesFixture from './fixtures/games.json';
import standingsFixture from './fixtures/standings.json';
import { gameSchema, conferenceSchema, parseOrThrow } from '../schemas';

const teams = teamsFixture as WireTeam[];
const teamsById = new Map(teams.map((team) => [team.teamId, team]));
const games = gamesFixture as WireGame[];

const DATE = '2026-11-02';

function gameByID(id: string): WireGame {
  const game = games.find((candidate) => candidate.gameId === id);
  if (!game) throw new Error(`Fixture missing: ${id}`);
  return game;
}

describe('normalizeTeam', () => {
  it('maps a wire team into the domain type', () => {
    const celtics = teamsById.get('bos');
    expect(celtics).toBeDefined();

    expect(normalizeTeam(celtics!, { wins: 5, losses: 2 })).toEqual({
      id: 'bos',
      name: 'Celtics',
      displayName: 'Boston Celtics',
      abbreviation: 'BOS',
      color: '#007A33',
      record: '5-2',
    });
  });

  it('omits the record when the wire has none', () => {
    expect(normalizeTeam(teamsById.get('bos')!)).not.toHaveProperty('record');
  });
});

describe('periodLabel', () => {
  it('labels quarters and overtimes', () => {
    expect([1, 2, 3, 4, 5, 6].map(periodLabel)).toEqual([
      'Q1',
      'Q2',
      'Q3',
      'Q4',
      'OT1',
      'OT2',
    ]);
  });
});

describe('totalsFromPeriods', () => {
  it('sums period scores rather than trusting a separate total', () => {
    const periods = normalizePeriods([
      { period: 1, away: 24, home: 31 },
      { period: 2, away: 29, home: 28 },
    ]);

    expect(totalsFromPeriods(periods)).toEqual({ away: 53, home: 59 });
  });

  it('returns zeroes for a game that has not started', () => {
    expect(totalsFromPeriods([])).toEqual({ away: 0, home: 0 });
  });
});

describe('normalizeGameState', () => {
  it('derives scheduled from a pre game', () => {
    const state = normalizeGameState(
      gameByID('mock-sched-cle-mil'),
      '2026-11-02T23:30:00.000Z',
    );
    expect(state).toEqual({ status: 'scheduled', tipoff: '2026-11-02T23:30:00.000Z' });
  });

  it('derives final, and flags regulation versus overtime', () => {
    expect(normalizeGameState(gameByID('mock-final-gsw-okc'), '')).toEqual({
      status: 'final',
      wentToOvertime: false,
    });
    expect(normalizeGameState(gameByID('mock-final-ot-den-lal'), '')).toEqual({
      status: 'final',
      wentToOvertime: true,
    });
  });

  it('derives live, taking the current period from the last line score', () => {
    const live: WireGame = { ...gameByID('mock-final-gsw-okc'), statusCode: 'in' };
    expect(normalizeGameState(live, '')).toMatchObject({
      status: 'live',
      periodNumber: 4,
      periodLabel: 'Q4',
    });
  });
});

describe('toIsoInstant', () => {
  it('combines a calendar date with a UTC time of day', () => {
    expect(toIsoInstant('2026-11-02', '23:30:00')).toBe('2026-11-02T23:30:00.000Z');
  });

  it('rolls forward for a game that tips after midnight UTC', () => {
    expect(toIsoInstant('2026-11-02', '02:30:00', 1)).toBe('2026-11-03T02:30:00.000Z');
  });

  it('rolls across a month boundary', () => {
    expect(toIsoInstant('2026-11-30', '01:00:00', 1)).toBe('2026-12-01T01:00:00.000Z');
  });
});

describe('normalizeGame', () => {
  it('maps a finished fixture into the domain type', () => {
    const game = normalizeGame(gameByID('mock-final-gsw-okc'), DATE, teamsById);

    expect(game).toMatchObject({
      id: 'mock-final-gsw-okc',
      league: 'nba',
      startsAt: '2026-11-02T23:00:00.000Z',
      state: { status: 'final', wentToOvertime: false },
      awayScore: 104,
      homeScore: 118,
    });
    expect(game.away.abbreviation).toBe('GSW');
    expect(game.home.abbreviation).toBe('OKC');
    expect(game.home.record).toBe('6-1');
  });

  it('counts overtime periods into the total', () => {
    const game = normalizeGame(gameByID('mock-final-ot-den-lal'), DATE, teamsById);

    // 28+24+30+25+14 and 26+27+29+25+11
    expect(game.awayScore).toBe(121);
    expect(game.homeScore).toBe(118);
    expect(game.state).toEqual({ status: 'final', wentToOvertime: true });
  });

  it('leaves a scheduled game scoreless', () => {
    const game = normalizeGame(gameByID('mock-sched-cle-mil'), DATE, teamsById);
    expect(game.awayScore).toBe(0);
    expect(game.homeScore).toBe(0);
    expect(game.state.status).toBe('scheduled');
  });

  it('fails loudly on an unknown team rather than rendering a blank row', () => {
    const broken: WireGame = { ...gameByID('mock-sched-cle-mil'), awayTeamId: 'xyz' };
    expect(() => normalizeGame(broken, DATE, teamsById)).toThrow(/unknown team/i);
  });

  it('produces games that satisfy the domain schema', () => {
    for (const wire of games) {
      const game = normalizeGame(wire, DATE, teamsById);
      expect(() => parseOrThrow(gameSchema, game, wire.gameId)).not.toThrow();
    }
  });
});

describe('standings math', () => {
  it('computes games behind as the average of the win and loss gaps', () => {
    const leader = { wins: 6, losses: 0 };
    expect(gamesBehind(leader, leader)).toBe(0);
    expect(gamesBehind(leader, { wins: 5, losses: 2 })).toBe(1.5);
    expect(gamesBehind(leader, { wins: 4, losses: 3 })).toBe(2.5);
    expect(gamesBehind(leader, { wins: 1, losses: 6 })).toBe(5.5);
  });

  it('computes win percentage, treating an unplayed season as zero', () => {
    expect(winPercent(6, 0)).toBe(1);
    expect(winPercent(5, 2)).toBeCloseTo(0.714, 3);
    expect(winPercent(0, 0)).toBe(0);
  });
});

describe('normalizeConference', () => {
  const east = normalizeConference(
    'east',
    'Eastern Conference',
    standingsFixture.east,
    teamsById,
  );

  it('ranks by win percentage regardless of the feed order', () => {
    const shuffled = [...standingsFixture.east].reverse();
    const ranked = normalizeConference('east', 'Eastern Conference', shuffled, teamsById);

    expect(ranked.standings[0]?.team.abbreviation).toBe('CLE');
    expect(ranked.standings[0]?.rank).toBe(1);
    expect(ranked.standings.at(-1)?.winPercent).toBeLessThanOrEqual(
      ranked.standings[0]!.winPercent,
    );
  });

  it('measures games behind against the conference leader', () => {
    expect(east.standings[0]?.gamesBehind).toBe(0);
    expect(east.standings[1]).toMatchObject({ rank: 2, gamesBehind: 1.5 });
  });

  it('numbers ranks contiguously from one', () => {
    expect(east.standings.map((row) => row.rank)).toEqual(
      east.standings.map((_, index) => index + 1),
    );
  });

  it('produces conferences that satisfy the domain schema', () => {
    expect(() => parseOrThrow(conferenceSchema, east, 'east')).not.toThrow();
  });
});

describe('normalizeRosterPlayer', () => {
  const booker: WireRosterPlayer = {
    playerId: 'phx-booker',
    firstName: 'Devin',
    lastName: 'Booker',
    jersey: '15',
    positionAbbrev: 'G',
    stats: {
      avgPoints: '24.7',
      avgRebounds: '3.2',
      avgAssists: '4.7',
      fieldGoalPct: '48.5',
    },
  };

  it('joins the split name the feed sends', () => {
    expect(normalizeRosterPlayer(booker).name).toBe('Devin Booker');
  });

  it('carries the jersey and position through', () => {
    expect(normalizeRosterPlayer(booker)).toMatchObject({
      jerseyNumber: '15',
      position: 'G',
    });
  });

  it('parses the averages into numbers the table can sort on', () => {
    expect(normalizeRosterPlayer(booker).seasonAverages).toEqual({
      points: 24.7,
      rebounds: 3.2,
      assists: 4.7,
      fieldGoalPercent: 48.5,
    });
  });

  it('leaves a player with no stats without averages rather than on zeros', () => {
    const rookie = normalizeRosterPlayer({
      playerId: 'phx-peat',
      firstName: 'Koa',
      lastName: 'Peat',
      jersey: '18',
      positionAbbrev: 'F',
    });

    expect(rookie.seasonAverages).toBeUndefined();
    expect('seasonAverages' in rookie).toBe(false);
  });
});
