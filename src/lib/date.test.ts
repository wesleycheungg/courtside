import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  addMonths,
  dayOfMonth,
  formatTipoff,
  fromDateKey,
  isDateKey,
  monthGrid,
  monthLabel,
  relativeDateLabel,
  toDateKey,
  weekdayHeadings,
} from './date';

afterEach(() => {
  vi.useRealTimers();
});

describe('toDateKey', () => {
  it('uses the local calendar date, not the UTC one', () => {
    // 2026-11-03T01:30Z is still 2026-11-02 in New York. CI runs under
    // TZ=America/New_York precisely so this distinction is exercised.
    const instant = new Date('2026-11-03T01:30:00.000Z');
    const expected = instant.getDate() === 2 ? '2026-11-02' : '2026-11-03';

    expect(toDateKey(instant)).toBe(expected);
  });

  it('pads single-digit months and days', () => {
    expect(toDateKey(new Date(2027, 0, 5))).toBe('2027-01-05');
  });
});

describe('isDateKey', () => {
  it('accepts a well-formed key', () => {
    expect(isDateKey('2026-11-02')).toBe(true);
  });

  it('rejects junk, which is what guards the URL parameter', () => {
    for (const bad of ['', '2026-11-2', '20261102', 'yesterday']) {
      expect(isDateKey(bad), bad).toBe(false);
    }
  });

  it('rejects a date that does not exist, rather than letting it roll over', () => {
    // new Date(2026, 12, 45) silently becomes 2027-02-14. Without a
    // round-trip check, ?date=2026-13-45 would quietly load another day.
    for (const bad of ['2026-13-45', '2026-02-30', '2026-00-10', '2027-02-29']) {
      expect(isDateKey(bad), bad).toBe(false);
    }
  });

  it('still accepts a real leap day', () => {
    expect(isDateKey('2028-02-29')).toBe(true);
  });
});

describe('fromDateKey and addDays', () => {
  it('round-trips a key', () => {
    expect(toDateKey(fromDateKey('2026-11-02'))).toBe('2026-11-02');
  });

  it('crosses a month boundary', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });
});

describe('addMonths', () => {
  it('keeps the day of the month', () => {
    expect(addMonths('2026-11-15', 1)).toBe('2026-12-15');
    expect(addMonths('2026-11-15', -1)).toBe('2026-10-15');
  });

  it('clamps rather than skipping a short month', () => {
    // The bug this guards: setMonth on January 31 lands on March 3, so
    // paging forward from a long month would step over February entirely.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('crosses a year boundary', () => {
    expect(addMonths('2026-12-10', 1)).toBe('2027-01-10');
    expect(addMonths('2026-01-10', -1)).toBe('2025-12-10');
  });

  it('is reversible across twelve months', () => {
    expect(addMonths(addMonths('2026-06-15', 12), -12)).toBe('2026-06-15');
  });
});

describe('monthGrid', () => {
  it('lays the month out in whole weeks', () => {
    const weeks = monthGrid('2026-11-03');

    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });

  it('pads to the Monday-first weekday the month starts on', () => {
    // 2026-11-01 was a Sunday, so it sits in the last column of week one.
    const [first] = monthGrid('2026-11-03');

    expect(first).toEqual([null, null, null, null, null, null, '2026-11-01']);
  });

  it('runs the days in order with no gaps inside the month', () => {
    const days = monthGrid('2026-11-03').flat().filter(Boolean);

    expect(days[0]).toBe('2026-11-01');
    expect(days.at(-1)).toBe('2026-11-30');
    expect(days).toEqual(Array.from({ length: 30 }, (_, i) => addDays('2026-11-01', i)));
  });

  it('handles a February that starts on a Monday and needs no padding', () => {
    // 2027-02-01 was a Monday and the month is exactly four weeks.
    const weeks = monthGrid('2027-02-10');

    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every(Boolean)).toBe(true);
  });

  it('includes the leap day', () => {
    expect(monthGrid('2028-02-01').flat()).toContain('2028-02-29');
  });
});

describe('monthLabel and weekdayHeadings', () => {
  it('names the month and year', () => {
    expect(monthLabel('2026-11-03')).toMatch(/2026/);
  });

  it('gives seven headings starting on Monday', () => {
    const headings = weekdayHeadings();

    expect(headings).toHaveLength(7);
    // Locale decides the wording, so assert the shape: a narrow glyph for the
    // eye and a longer spelled-out name for a screen reader.
    expect(headings[0]?.long.length).toBeGreaterThan(headings[0]?.narrow.length ?? 0);
  });
});

describe('relativeDateLabel', () => {
  const today = '2026-11-03';

  it('names the three days around today in words', () => {
    expect(relativeDateLabel(today, today)).toBe('Today');
    expect(relativeDateLabel('2026-11-02', today)).toBe('Yesterday');
    expect(relativeDateLabel('2026-11-04', today)).toBe('Tomorrow');
  });

  it('falls back to a dated label further out', () => {
    const label = relativeDateLabel('2026-11-20', today);

    expect(label).not.toMatch(/Today|Yesterday|Tomorrow/);
    expect(label).toMatch(/20/);
  });
});

describe('dayOfMonth', () => {
  it('gives the day number without padding', () => {
    expect(dayOfMonth('2026-11-02')).toBe('2');
    expect(dayOfMonth('2026-11-30')).toBe('30');
  });
});

describe('formatTipoff', () => {
  it('renders a time of day rather than a date', () => {
    expect(formatTipoff('2026-11-02T23:30:00.000Z')).toMatch(/\d{1,2}:\d{2}/);
  });
});
