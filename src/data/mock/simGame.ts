/**
 * The simulated live game.
 *
 * Requirements pulling in opposite directions: a demo needs a game that is
 * visibly advancing whenever you happen to open the app, and a test needs an
 * exact, repeatable state. Both are satisfied by making the game's state a pure
 * function of a timestamp:
 *
 *   - No parameter: the real clock drives it, and the game cycles every hour, so
 *     it is live roughly 70% of the time and always moving.
 *   - `?simTime=<epoch ms>`: pins the clock to an instant, so a test gets exactly
 *     the state it asked for.
 *   - `?simOffset=<ms>`: nudges the real clock forward, for eyeballing a later
 *     stage by hand.
 *
 * Nothing here reads Date.now(); the caller supplies the time.
 */

import type { Game, GameDetail, GameState, Period } from '../types';
import { periodLabel } from './normalize';

const MINUTE = 60_000;

/** One full cycle: 42 minutes of game, then the final score holds for 18. */
export const SIM_CYCLE_MS = 60 * MINUTE;

export const SIM_GAME_ID = 'sim-live-nyk-bos';

interface SimSegment {
  kind: 'period' | 'break';
  periodNumber: number;
  startMs: number;
  endMs: number;
  /** Cumulative score at the start and end of the segment. */
  awayFrom: number;
  awayTo: number;
  homeFrom: number;
  homeTo: number;
}

/**
 * Scripted to land on the scoreline in the design screenshots: 82-87 midway
 * through Q3, finishing 108-112.
 */
const SEGMENTS: SimSegment[] = [
  {
    kind: 'period',
    periodNumber: 1,
    startMs: 0,
    endMs: 10 * MINUTE,
    awayFrom: 0,
    awayTo: 28,
    homeFrom: 0,
    homeTo: 25,
  },
  {
    kind: 'break',
    periodNumber: 1,
    startMs: 10 * MINUTE,
    endMs: 11 * MINUTE,
    awayFrom: 28,
    awayTo: 28,
    homeFrom: 25,
    homeTo: 25,
  },
  {
    kind: 'period',
    periodNumber: 2,
    startMs: 11 * MINUTE,
    endMs: 21 * MINUTE,
    awayFrom: 28,
    awayTo: 52,
    homeFrom: 25,
    homeTo: 56,
  },
  {
    kind: 'break',
    periodNumber: 2,
    startMs: 21 * MINUTE,
    endMs: 24 * MINUTE,
    awayFrom: 52,
    awayTo: 52,
    homeFrom: 56,
    homeTo: 56,
  },
  {
    kind: 'period',
    periodNumber: 3,
    startMs: 24 * MINUTE,
    endMs: 34 * MINUTE,
    awayFrom: 52,
    awayTo: 82,
    homeFrom: 56,
    homeTo: 87,
  },
  {
    kind: 'break',
    periodNumber: 3,
    startMs: 34 * MINUTE,
    endMs: 35 * MINUTE,
    awayFrom: 82,
    awayTo: 82,
    homeFrom: 87,
    homeTo: 87,
  },
  {
    kind: 'period',
    periodNumber: 4,
    startMs: 35 * MINUTE,
    endMs: 45 * MINUTE,
    awayFrom: 82,
    awayTo: 108,
    homeFrom: 87,
    homeTo: 112,
  },
];

const SIM_END_MS = 45 * MINUTE;
export const SIM_FINAL_SCORE = { away: 108, home: 112 } as const;

/** Where in the cycle a given instant falls. Exported for tests. */
export function elapsedAt(now: number): number {
  return ((now % SIM_CYCLE_MS) + SIM_CYCLE_MS) % SIM_CYCLE_MS;
}

function interpolate(from: number, to: number, progress: number): number {
  return Math.round(from + (to - from) * progress);
}

/** Counts a 12:00 period clock down to 0:00 across the segment. */
function formatClock(segment: SimSegment, elapsed: number): string {
  const progress = (elapsed - segment.startMs) / (segment.endMs - segment.startMs);
  const remainingSeconds = Math.max(0, Math.ceil((1 - progress) * 12 * 60));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export interface SimSnapshot {
  state: GameState;
  awayScore: number;
  homeScore: number;
  periods: Period[];
}

/** The simulated game's complete state at an instant. Pure. */
export function simSnapshotAt(now: number): SimSnapshot {
  const elapsed = elapsedAt(now);

  if (elapsed >= SIM_END_MS) {
    return {
      state: { status: 'final', wentToOvertime: false },
      awayScore: SIM_FINAL_SCORE.away,
      homeScore: SIM_FINAL_SCORE.home,
      periods: completedPeriods(SEGMENTS.length),
    };
  }

  // Unreachable: the early return above covers everything past the last
  // segment, so some segment always ends after `elapsed`.
  const segment = SEGMENTS.find((candidate) => elapsed < candidate.endMs);
  if (!segment) throw new Error(`No simulation segment covers ${elapsed}ms`);

  const progress = (elapsed - segment.startMs) / (segment.endMs - segment.startMs);

  const awayScore = interpolate(segment.awayFrom, segment.awayTo, progress);
  const homeScore = interpolate(segment.homeFrom, segment.homeTo, progress);

  const state: GameState =
    segment.kind === 'break'
      ? {
          status: 'live',
          periodNumber: segment.periodNumber,
          // Mirrors the design, which shows "Half" rather than "End Q2".
          periodLabel:
            segment.periodNumber === 2
              ? 'Half'
              : `End ${periodLabel(segment.periodNumber)}`,
          clock: '',
        }
      : {
          status: 'live',
          periodNumber: segment.periodNumber,
          periodLabel: periodLabel(segment.periodNumber),
          clock: formatClock(segment, elapsed),
        };

  return {
    state,
    awayScore,
    homeScore,
    periods: periodsUpTo(segment, awayScore, homeScore),
  };
}

/** Per-quarter splits for every quarter finished before the current one. */
function completedPeriods(upToIndex: number): Period[] {
  return SEGMENTS.slice(0, upToIndex)
    .filter((segment) => segment.kind === 'period')
    .map((segment) => ({
      number: segment.periodNumber,
      label: periodLabel(segment.periodNumber),
      awayScore: segment.awayTo - segment.awayFrom,
      homeScore: segment.homeTo - segment.homeFrom,
    }));
}

function periodsUpTo(
  current: SimSegment,
  awayScore: number,
  homeScore: number,
): Period[] {
  const index = SEGMENTS.indexOf(current);
  const finished = completedPeriods(index);

  if (current.kind === 'break') return finished;

  const priorAway = finished.reduce((sum, p) => sum + p.awayScore, 0);
  const priorHome = finished.reduce((sum, p) => sum + p.homeScore, 0);

  return [
    ...finished,
    {
      number: current.periodNumber,
      label: periodLabel(current.periodNumber),
      awayScore: awayScore - priorAway,
      homeScore: homeScore - priorHome,
    },
  ];
}

/** Applies a snapshot to the static parts of the game record. */
export function applySnapshot<T extends Game>(game: T, snapshot: SimSnapshot): T {
  return {
    ...game,
    state: snapshot.state,
    awayScore: snapshot.awayScore,
    homeScore: snapshot.homeScore,
  };
}

export function applyDetailSnapshot(
  detail: GameDetail,
  snapshot: SimSnapshot,
): GameDetail {
  return { ...applySnapshot(detail, snapshot), periods: snapshot.periods };
}
