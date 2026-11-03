/**
 * Instants inside the simulated game's hourly cycle.
 *
 * The mock live game is a pure function of the clock, and `?simTime=` pins the
 * clock absolutely, so these constants give e2e an exact, repeatable state
 * with no waiting and no flake.
 *
 * Mirrors the segment timings in src/data/mock/simGame.ts.
 */

const MINUTE = 60_000;
const CYCLE = 60 * MINUTE;

/** An arbitrary whole cycle, so `base + offset` lands where we intend. */
const BASE = CYCLE * 1000;

export const simTime = {
  firstQuarter: BASE + 5 * MINUTE,
  halftime: BASE + 22 * MINUTE,
  thirdQuarter: BASE + 30 * MINUTE,
  fourthQuarter: BASE + 40 * MINUTE,
  /** Past the end of the timeline: the game reports final. */
  afterFullTime: BASE + 50 * MINUTE,
} as const;
