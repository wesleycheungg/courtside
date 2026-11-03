import { describe, expect, it } from 'vitest';
import { createMockProvider } from './mockProvider';
import { SIM_GAME_ID } from './simGame';
import { fixedClock } from '../clock';
import {
  conferenceSchema,
  gameDetailSchema,
  gameSchema,
  playerSchema,
  parseOrThrow,
} from '../schemas';

const MINUTE = 60_000;
const DATE = '2026-11-02';

/** Mid-third-quarter and well past full time, in the simulation's cycle. */
const DURING_Q3 = 60 * MINUTE * 1000 + 26 * MINUTE;
const AFTER_FULL_TIME = 60 * MINUTE * 1000 + 50 * MINUTE;

function providerAt(now: number) {
  return createMockProvider({ clock: fixedClock(now) });
}

describe('MockProvider.getGames', () => {
  it('returns the simulated game plus the static slate', async () => {
    const games = await providerAt(DURING_Q3).getGames(DATE);

    expect(games).toHaveLength(5);
    expect(games[0]?.id).toBe(SIM_GAME_ID);
    expect(games.map((game) => game.state.status).sort()).toEqual([
      'final',
      'final',
      'live',
      'scheduled',
      'scheduled',
    ]);
  });

  it('covers every status the UI has to render', async () => {
    const games = await providerAt(DURING_Q3).getGames(DATE);
    const statuses = new Set(games.map((game) => game.state.status));

    expect(statuses).toEqual(new Set(['live', 'final', 'scheduled']));
  });

  it('includes a game that went to overtime', async () => {
    const games = await providerAt(DURING_Q3).getGames(DATE);
    const overtime = games.filter(
      (game) => game.state.status === 'final' && game.state.wentToOvertime,
    );

    expect(overtime).toHaveLength(1);
  });

  it('dates the slate to the day being asked for', async () => {
    const games = await providerAt(DURING_Q3).getGames('2027-01-15');

    for (const game of games) {
      expect(game.startsAt.startsWith('2027-01-15')).toBe(true);
    }
  });

  it('advances the simulated game from live to final with the clock', async () => {
    const live = await providerAt(DURING_Q3).getGames(DATE);
    const finished = await providerAt(AFTER_FULL_TIME).getGames(DATE);

    expect(live[0]?.state.status).toBe('live');
    expect(finished[0]?.state.status).toBe('final');
    expect(finished[0]?.homeScore).toBeGreaterThan(live[0]!.homeScore);
  });

  it('returns games that satisfy the domain schema', async () => {
    const games = await providerAt(DURING_Q3).getGames(DATE);

    for (const game of games) {
      expect(() => parseOrThrow(gameSchema, game, game.id)).not.toThrow();
    }
  });
});

describe('MockProvider.getGame', () => {
  it('returns detail whose quarter scores sum to the final score', async () => {
    const detail = await providerAt(DURING_Q3).getGame('mock-final-gsw-okc');

    const awayTotal = detail.periods.reduce((sum, period) => sum + period.awayScore, 0);
    const homeTotal = detail.periods.reduce((sum, period) => sum + period.homeScore, 0);

    expect(awayTotal).toBe(detail.awayScore);
    expect(homeTotal).toBe(detail.homeScore);
  });

  it('builds top performers from the box score', async () => {
    const detail = await providerAt(DURING_Q3).getGame(SIM_GAME_ID);

    expect(detail.topPerformers.map((line) => line.playerId)).toEqual([
      'tatum',
      'brunson',
    ]);
    expect(detail.topPerformers[0]?.points).toBe(28);
  });

  it('gives a scheduled game empty stats rather than fabricated ones', async () => {
    const detail = await providerAt(DURING_Q3).getGame('mock-sched-cle-mil');

    expect(detail.periods).toEqual([]);
    expect(detail.teamStats).toEqual([]);
    expect(detail.boxScore.away).toEqual([]);
  });

  it('throws on an unknown game id', async () => {
    await expect(providerAt(DURING_Q3).getGame('nope')).rejects.toThrow(/unknown game/i);
  });

  it('returns detail that satisfies the domain schema', async () => {
    const detail = await providerAt(DURING_Q3).getGame(SIM_GAME_ID);
    expect(() => parseOrThrow(gameDetailSchema, detail, SIM_GAME_ID)).not.toThrow();
  });
});

describe('MockProvider.getStandings', () => {
  it('returns both conferences with fifteen teams each', async () => {
    const conferences = await providerAt(DURING_Q3).getStandings();

    expect(conferences.map((conference) => conference.id)).toEqual(['east', 'west']);
    for (const conference of conferences) {
      expect(conference.standings).toHaveLength(15);
      expect(() =>
        parseOrThrow(conferenceSchema, conference, conference.id),
      ).not.toThrow();
    }
  });

  it('covers enough teams to show playoff and play-in cutoffs', async () => {
    const [east] = await providerAt(DURING_Q3).getStandings();
    expect(east!.standings.length).toBeGreaterThanOrEqual(10);
  });
});

describe('MockProvider.getPlayer and getPlayByPlay', () => {
  it('returns a player that satisfies the domain schema', async () => {
    const player = await providerAt(DURING_Q3).getPlayer('tatum');

    expect(player.name).toBe('Jayson Tatum');
    expect(() => parseOrThrow(playerSchema, player, 'tatum')).not.toThrow();
  });

  it('throws on an unknown player id', async () => {
    await expect(providerAt(DURING_Q3).getPlayer('nope')).rejects.toThrow(
      /unknown player/i,
    );
  });

  it('returns play-by-play newest first', async () => {
    const plays = await providerAt(DURING_Q3).getPlayByPlay(SIM_GAME_ID);

    expect(plays.length).toBeGreaterThan(0);
    expect(plays[0]?.isScoringPlay).toBe(true);
    // The period clock counts down, so the most recent play is the one with the
    // least time remaining — a newest-first list reads as ascending seconds.
    const secondsRemaining = plays.map((play) => {
      const [minutes, secs] = play.clock.split(':').map(Number);
      return (minutes ?? 0) * 60 + (secs ?? 0);
    });
    expect([...secondsRemaining].sort((a, b) => a - b)).toEqual(secondsRemaining);
  });

  it('returns an empty list for a game with no plays yet', async () => {
    expect(await providerAt(DURING_Q3).getPlayByPlay('mock-sched-cle-mil')).toEqual([]);
  });
});
