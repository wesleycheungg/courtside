import { describe, expect, it } from 'vitest';
import { formatAge, formatInstant, formatLatency, formatRows } from './format';

describe('formatInstant', () => {
  it('renders UTC, readably, without reaching for the local zone', () => {
    expect(formatInstant('2026-11-03T18:00:30.000Z')).toBe('2026-11-03 18:00:30Z');
  });

  it('says never rather than rendering an empty timestamp', () => {
    expect(formatInstant(null)).toBe('never');
  });
});

describe('formatAge', () => {
  it('scales the unit with the age', () => {
    expect(formatAge(0)).toBe('0s ago');
    expect(formatAge(59)).toBe('59s ago');
    expect(formatAge(60)).toBe('1m ago');
    expect(formatAge(3599)).toBe('59m ago');
    expect(formatAge(3600)).toBe('1h ago');
    expect(formatAge(86_400)).toBe('1d ago');
  });

  it('distinguishes an empty table from a fresh one', () => {
    expect(formatAge(null)).toBe('no rows yet');
  });
});

describe('formatLatency and formatRows', () => {
  it('rounds latency to whole milliseconds', () => {
    expect(formatLatency(87.4)).toBe('87 ms');
  });

  it('pluralizes rows', () => {
    expect(formatRows(1)).toBe('1 row');
    expect(formatRows(0)).toBe('0 rows');
    expect(formatRows(11)).toBe('11 rows');
  });
});
