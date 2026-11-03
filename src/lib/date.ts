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
  if (!DATE_KEY.test(value)) return false;

  // `new Date(2026, 12, 45)` silently rolls over into 2027 rather than failing,
  // so a shape check is not enough — the parsed date has to format back to the
  // same key. Otherwise `?date=2026-13-45` would quietly load another day.
  const parsed = fromDateKey(value);
  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === value;
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

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, month + 1, 0).getDate();
}

/**
 * The same day-of-month `months` away, clamped to the target month's length.
 *
 * Naive month arithmetic skips: `setMonth` on January 31 lands on March 3,
 * so paging a calendar forward from a long month would lose February
 * entirely. Moving to the 1st first and clamping afterwards keeps every month
 * reachable.
 */
export function addMonths(key: string, months: number): string {
  const date = fromDateKey(key);
  const day = date.getDate();

  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  date.setDate(Math.min(day, daysInMonth(date.getFullYear(), date.getMonth())));

  return toDateKey(date);
}

/** Calendar header, e.g. "November 2026". */
export function monthLabel(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * The calendar grid for `key`'s month, as weeks of date keys, Monday first.
 *
 * Cells outside the month are null rather than the neighbouring month's days:
 * a tap can then never land on a date the header isn't naming.
 */
export function monthGrid(key: string): (string | null)[][] {
  const date = fromDateKey(key);
  const year = date.getFullYear();
  const month = date.getMonth();

  // getDay() counts from Sunday; shift so Monday is 0.
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth(year, month) }, (_, i) =>
      toDateKey(new Date(year, month, i + 1)),
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7),
  );
}

/**
 * Column headings for the grid, Monday first. The narrow form is what shows —
 * seven columns of "Mon" will not fit the mobile width — so each carries the
 * long name for screen readers, where a bare "T" is a coin flip.
 */
export function weekdayHeadings(): { narrow: string; long: string }[] {
  // 2026-01-05 was a Monday; any Monday would do.
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(2026, 0, 5 + i);
    return {
      narrow: date.toLocaleDateString(undefined, { weekday: 'narrow' }),
      long: date.toLocaleDateString(undefined, { weekday: 'long' }),
    };
  });
}

/** What the picker button reads, e.g. "Today" or "Wed, Nov 4". */
export function relativeDateLabel(key: string, today: string): string {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  if (key === addDays(today, 1)) return 'Tomorrow';

  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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
