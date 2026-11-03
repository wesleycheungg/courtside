import { describe, expect, it } from 'vitest';
import { SIM_CYCLE_MS, SIM_FINAL_SCORE, elapsedAt, simSnapshotAt } from './simGame';

const MINUTE = 60_000;

/** An instant exactly `minutes` into the simulation cycle. */
function atMinute(minutes: number): number {
  return SIM_CYCLE_MS * 1000 + minutes * MINUTE;
}

describe('elapsedAt', () => {
  it('wraps to the start of each cycle', () => {
    expect(elapsedAt(atMinute(0))).toBe(0);
    expect(elapsedAt(atMinute(17))).toBe(17 * MINUTE);
    expect(elapsedAt(atMinute(60))).toBe(0);
    expect(elapsedAt(atMinute(72))).toBe(12 * MINUTE);
  });

  it('stays non-negative for instants before the epoch', () => {
    expect(elapsedAt(-5 * MINUTE)).toBe(SIM_CYCLE_MS - 5 * MINUTE);
  });
});

describe('simSnapshotAt', () => {
  it('is live in the first quarter at tip-off', () => {
    const snapshot = simSnapshotAt(atMinute(0));

    expect(snapshot.state).toMatchObject({
      status: 'live',
      periodNumber: 1,
      periodLabel: 'Q1',
    });
    expect(snapshot.awayScore).toBe(0);
    expect(snapshot.homeScore).toBe(0);
  });

  it('counts the period clock down rather than up', () => {
    const early = simSnapshotAt(atMinute(1));
    const late = simSnapshotAt(atMinute(9));

    expect(early.state).toMatchObject({ status: 'live', clock: '10:48' });
    expect(late.state).toMatchObject({ status: 'live', clock: '1:12' });
  });

  it('reports halftime as a live break with no clock', () => {
    const snapshot = simSnapshotAt(atMinute(22));

    expect(snapshot.state).toEqual({
      status: 'live',
      periodNumber: 2,
      periodLabel: 'Half',
      clock: '',
    });
    expect(snapshot.awayScore).toBe(52);
    expect(snapshot.homeScore).toBe(56);
  });

  it('matches the design scoreline midway through the third', () => {
    // Q3 runs 24-34 min; at 34 it has just finished, 82-87 as in the mockup.
    const snapshot = simSnapshotAt(atMinute(33.99));

    expect(snapshot.awayScore).toBe(82);
    expect(snapshot.homeScore).toBe(87);
    expect(snapshot.state).toMatchObject({ periodLabel: 'Q3' });
  });

  it('reports final once the timeline is exhausted', () => {
    const snapshot = simSnapshotAt(atMinute(50));

    expect(snapshot.state).toEqual({ status: 'final', wentToOvertime: false });
    expect(snapshot.awayScore).toBe(SIM_FINAL_SCORE.away);
    expect(snapshot.homeScore).toBe(SIM_FINAL_SCORE.home);
  });

  it('advances monotonically through the game', () => {
    const scores = [0, 5, 12, 20, 26, 33, 40, 44].map((minute) => {
      const snapshot = simSnapshotAt(atMinute(minute));
      return snapshot.awayScore + snapshot.homeScore;
    });

    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });

  it('is deterministic — the same instant always gives the same state', () => {
    const first = simSnapshotAt(atMinute(26.5));
    const second = simSnapshotAt(atMinute(26.5));

    expect(first).toEqual(second);
  });

  it('keeps period splits summing to the displayed score', () => {
    for (const minute of [5, 15, 26, 38, 50]) {
      const snapshot = simSnapshotAt(atMinute(minute));
      const awayTotal = snapshot.periods.reduce((sum, p) => sum + p.awayScore, 0);
      const homeTotal = snapshot.periods.reduce((sum, p) => sum + p.homeScore, 0);

      expect(awayTotal, `away at ${minute}min`).toBe(snapshot.awayScore);
      expect(homeTotal, `home at ${minute}min`).toBe(snapshot.homeScore);
    }
  });
});
