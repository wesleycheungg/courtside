import { describe, expect, it } from 'vitest';
import {
  abbreviateName,
  formatAverage,
  formatMinutes,
  formatPlusMinus,
} from './formatStats';

describe('abbreviateName', () => {
  it('shortens a first name to an initial', () => {
    expect(abbreviateName('Jayson Tatum')).toBe('J. Tatum');
    expect(abbreviateName('Karl-Anthony Towns')).toBe('K. Towns');
  });

  it('keeps multi-part surnames intact', () => {
    expect(abbreviateName('Shai Gilgeous Alexander')).toBe('S. Gilgeous Alexander');
    expect(abbreviateName('Michael Porter Jr.')).toBe('M. Porter Jr.');
  });

  it('leaves an already-abbreviated name alone, so it is not double-shortened', () => {
    expect(abbreviateName('J. Allen')).toBe('J. Allen');
  });

  it('leaves a single-word name alone', () => {
    expect(abbreviateName('Nene')).toBe('Nene');
  });
});

describe('formatMinutes', () => {
  it('rounds to whole minutes', () => {
    expect(formatMinutes(30.2)).toBe('30');
    expect(formatMinutes(28.7)).toBe('29');
    expect(formatMinutes(0)).toBe('0');
  });
});

describe('formatPlusMinus', () => {
  it('signs a positive value', () => {
    expect(formatPlusMinus(7)).toBe('+7');
  });

  it('uses a real minus sign for a negative value', () => {
    expect(formatPlusMinus(-3)).toBe('−3');
  });

  it('renders zero unsigned', () => {
    expect(formatPlusMinus(0)).toBe('0');
  });

  it('dashes a player with no value', () => {
    expect(formatPlusMinus(undefined)).toBe('—');
  });
});

describe('formatAverage', () => {
  it('shows one decimal place', () => {
    expect(formatAverage(24.666666)).toBe('24.7');
    expect(formatAverage(48.51499)).toBe('48.5');
  });

  it('pads a whole number out to a decimal, so the column lines up', () => {
    expect(formatAverage(5)).toBe('5.0');
  });

  it('keeps a genuine zero distinct from a player who has not played', () => {
    expect(formatAverage(0)).toBe('0.0');
    expect(formatAverage(undefined)).toBe('—');
  });
});
