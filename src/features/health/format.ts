/**
 * Formatting for the health page.
 *
 * Timestamps render in UTC, as the ISO string with the `T` relaxed to a space:
 * this is a diagnostics screen read next to a log, and a local-time string
 * would be one more thing to reconcile — as well as something tests could only
 * assert in whichever zone they happened to run in.
 */

export function formatInstant(iso: string | null): string {
  if (!iso) return 'never';
  return iso.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

/** Server-measured age, so this never reads the browser's clock. */
export function formatAge(seconds: number | null): string {
  if (seconds === null) return 'no rows yet';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export function formatLatency(ms: number): string {
  return `${Math.round(ms)} ms`;
}

export function formatRows(rows: number): string {
  return `${rows} ${rows === 1 ? 'row' : 'rows'}`;
}
