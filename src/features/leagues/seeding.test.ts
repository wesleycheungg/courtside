import { describe, expect, it } from 'vitest';
import { formatGamesBehind, formatWinPercent, seedBand, seedBandLabel } from './seeding';

describe('seedBand', () => {
  it('puts seeds 1-6 in the playoffs', () => {
    for (const rank of [1, 2, 3, 4, 5, 6]) {
      expect(seedBand(rank), `seed ${rank}`).toBe('playoffs');
    }
  });

  it('puts seeds 7-10 in the play-in', () => {
    for (const rank of [7, 8, 9, 10]) {
      expect(seedBand(rank), `seed ${rank}`).toBe('playin');
    }
  });

  it('leaves 11 and below unmarked', () => {
    for (const rank of [11, 12, 15]) {
      expect(seedBand(rank), `seed ${rank}`).toBe('none');
    }
  });

  it('guards the exact cutoffs', () => {
    expect(seedBand(6)).toBe('playoffs');
    expect(seedBand(7)).toBe('playin');
    expect(seedBand(10)).toBe('playin');
    expect(seedBand(11)).toBe('none');
  });
});

describe('seedBandLabel', () => {
  it('gives marked bands a spoken label, so the marker is not colour-only', () => {
    expect(seedBandLabel('playoffs')).toBe('Playoff position');
    expect(seedBandLabel('playin')).toBe('Play-in position');
  });

  it('gives unmarked rows nothing to announce', () => {
    expect(seedBandLabel('none')).toBeNull();
  });
});

describe('formatWinPercent', () => {
  it('drops the leading zero, as the standings do', () => {
    expect(formatWinPercent(0.714)).toBe('.714');
    expect(formatWinPercent(0.143)).toBe('.143');
  });

  it('keeps a perfect record as 1.000', () => {
    expect(formatWinPercent(1)).toBe('1.000');
  });

  it('renders a winless record as .000', () => {
    expect(formatWinPercent(0)).toBe('.000');
  });
});

describe('formatGamesBehind', () => {
  it('shows a dash for the conference leader', () => {
    expect(formatGamesBehind(0)).toBe('—');
  });

  it('shows halves to one decimal and whole numbers plainly', () => {
    expect(formatGamesBehind(1.5)).toBe('1.5');
    expect(formatGamesBehind(3)).toBe('3');
    expect(formatGamesBehind(5.5)).toBe('5.5');
  });
});
