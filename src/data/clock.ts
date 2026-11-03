/**
 * Time source.
 *
 * Production code never calls Date.now() directly — it takes a Clock. Tests pass
 * a fixed one, so nothing depends on how long a test took to run.
 */

export interface Clock {
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

/** A clock frozen at a given instant. */
export function fixedClock(at: number): Clock {
  return { now: () => at };
}

/**
 * A clock shifted by a fixed offset, used to fast-forward the simulated live
 * game. The offset comes from `?simOffset=<ms>` or VITE_SIM_OFFSET so a demo can
 * jump to halftime or full time without waiting.
 */
export function offsetClock(base: Clock, offsetMs: number): Clock {
  return { now: () => base.now() + offsetMs };
}

function readNumber(
  params: URLSearchParams,
  key: string,
  fallback?: string,
): number | null {
  const candidate = params.get(key) ?? fallback;
  if (candidate == null || candidate === '') return null;

  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Reads the sim offset from the URL first, then the build-time env var. */
export function resolveSimOffset(search?: string): number {
  const params = new URLSearchParams(search ?? '');
  return readNumber(params, 'simOffset', import.meta.env.VITE_SIM_OFFSET) ?? 0;
}

/**
 * Builds the clock the providers run on.
 *
 * `simTime` pins the clock to an absolute instant — the simulated game cycles,
 * so only an absolute time guarantees a specific state, which is what e2e tests
 * need. `simOffset` just nudges the real clock, which is the convenient knob for
 * stepping through the game by hand.
 */
export function resolveClock(search?: string, base: Clock = systemClock): Clock {
  const params = new URLSearchParams(search ?? '');

  const pinned = readNumber(params, 'simTime', import.meta.env.VITE_SIM_TIME);
  if (pinned !== null) return fixedClock(pinned);

  const offset = readNumber(params, 'simOffset', import.meta.env.VITE_SIM_OFFSET) ?? 0;
  return offset === 0 ? base : offsetClock(base, offset);
}
