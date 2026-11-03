/**
 * Date helpers for the feed.
 *
 * Calendar dates are local, not UTC: a user in New York looking at "today"
 * means their today, and a UTC-based key would roll over at 8pm for them (R5 in
 * the test plan). Instants stay UTC — only the day bucket is local.
 */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date as YYYY-MM-DD. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDateKey(value: string): boolean {
  return DATE_KEY.test(value) && !Number.isNaN(fromDateKey(value).getTime());
}

/** Midnight local on the given calendar date. */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** The run of dates the strip shows, centred on `key`. */
export function dateWindow(key: string, radius = 2): string[] {
  return Array.from({ length: radius * 2 + 1 }, (_, i) => addDays(key, i - radius));
}

/** Short weekday for the date strip, e.g. "SAT". */
export function weekdayLabel(key: string): string {
  return fromDateKey(key)
    .toLocaleDateString(undefined, { weekday: 'short' })
    .toUpperCase();
}

export function dayOfMonth(key: string): string {
  return String(fromDateKey(key).getDate());
}

/** Full date for screen readers, e.g. "Saturday, 31 October 2026". */
export function fullDateLabel(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Tip-off time in the viewer's zone, e.g. "7:30 PM". */
export function formatTipoff(isoInstant: string): string {
  return new Date(isoInstant).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
