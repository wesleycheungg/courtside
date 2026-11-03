import { describe, expect, it } from 'vitest';
import {
  applyFilter,
  countLive,
  groupByLeague,
  isDimmed,
  isWinner,
  sortGames,
} from './grouping';
import { aGame, finalState, liveState, scheduledState } from '../../test/builders';

const live = aGame({
  id: 'live',
  state: liveState,
  startsAt: '2026-11-02T23:00:00.000Z',
});
const finalEarly = aGame({
  id: 'final-early',
  state: finalState,
  startsAt: '2026-11-02T22:00:00.000Z',
});
const finalLate = aGame({
  id: 'final-late',
  state: finalState,
  startsAt: '2026-11-03T01:00:00.000Z',
});
const scheduled = aGame({
  id: 'scheduled',
  state: scheduledState,
  startsAt: '2026-11-03T02:00:00.000Z',
});

describe('countLive', () => {
  it('counts only games in progress', () => {
    expect(countLive([live, finalEarly, scheduled])).toBe(1);
    expect(countLive([finalEarly, scheduled])).toBe(0);
    expect(countLive([])).toBe(0);
  });
});

describe('applyFilter', () => {
  it('passes everything through for all', () => {
    const games = [live, finalEarly, scheduled];
    expect(applyFilter(games, 'all')).toHaveLength(3);
  });

  it('keeps only live games for live', () => {
    expect(applyFilter([live, finalEarly, scheduled], 'live')).toEqual([live]);
  });
});

describe('sortGames', () => {
  it('orders live, then final, then scheduled', () => {
    const sorted = sortGames([scheduled, finalEarly, live]);
    expect(sorted.map((g) => g.state.status)).toEqual(['live', 'final', 'scheduled']);
  });

  it('orders by tip-off within a status', () => {
    const sorted = sortGames([finalLate, finalEarly]);
    expect(sorted.map((g) => g.id)).toEqual(['final-early', 'final-late']);
  });

  it('does not mutate its input', () => {
    const games = [scheduled, live];
    sortGames(games);
    expect(games.map((g) => g.id)).toEqual(['scheduled', 'live']);
  });

  it('is stable across repeated calls, so a refetch does not reshuffle', () => {
    const once = sortGames([scheduled, finalLate, live, finalEarly]).map((g) => g.id);
    const twice = sortGames([finalEarly, live, scheduled, finalLate]).map((g) => g.id);
    expect(once).toEqual(twice);
  });
});

describe('groupByLeague', () => {
  it('groups into a single NBA section and sorts within it', () => {
    const groups = groupByLeague([scheduled, live, finalEarly]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.league).toBe('nba');
    expect(groups[0]?.name).toBe('NBA');
    expect(groups[0]?.games.map((g) => g.state.status)).toEqual([
      'live',
      'final',
      'scheduled',
    ]);
  });

  it('returns no groups for an empty slate', () => {
    expect(groupByLeague([])).toEqual([]);
  });
});

describe('isWinner and isDimmed', () => {
  const awayWon = aGame({ state: finalState, awayScore: 118, homeScore: 104 });
  const homeWon = aGame({ state: finalState, awayScore: 104, homeScore: 118 });

  it('marks the winner of a finished game', () => {
    expect(isWinner(awayWon, 'away')).toBe(true);
    expect(isWinner(awayWon, 'home')).toBe(false);
    expect(isWinner(homeWon, 'home')).toBe(true);
  });

  it('dims only the loser of a finished game', () => {
    expect(isDimmed(awayWon, 'home')).toBe(true);
    expect(isDimmed(awayWon, 'away')).toBe(false);
  });

  it('never dims a live game — both scores stay at full strength', () => {
    const inProgress = aGame({ state: liveState, awayScore: 82, homeScore: 87 });

    expect(isWinner(inProgress, 'home')).toBe(false);
    expect(isDimmed(inProgress, 'away')).toBe(false);
    expect(isDimmed(inProgress, 'home')).toBe(false);
  });

  it('never dims a scheduled game', () => {
    const upcoming = aGame({ state: scheduledState, awayScore: 0, homeScore: 0 });
    expect(isDimmed(upcoming, 'away')).toBe(false);
  });

  it('dims neither side of a tie', () => {
    const tied = aGame({ state: finalState, awayScore: 100, homeScore: 100 });
    expect(isDimmed(tied, 'away')).toBe(false);
    expect(isDimmed(tied, 'home')).toBe(false);
  });
});
