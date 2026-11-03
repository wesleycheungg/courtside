import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  dateWindow,
  dayOfMonth,
  formatTipoff,
  fromDateKey,
  isDateKey,
  toDateKey,
  weekdayLabel,
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

describe('dateWindow', () => {
  it('centres five days on the given date', () => {
    expect(dateWindow('2026-11-02')).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
  });

  it('honours a custom radius', () => {
    expect(dateWindow('2026-11-02', 1)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
  });
});

describe('weekdayLabel and dayOfMonth', () => {
  it('gives an upper-case short weekday', () => {
    // 2026-10-31 is a Saturday.
    expect(weekdayLabel('2026-10-31')).toMatch(/^[A-Z]{2,4}$/);
  });

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
