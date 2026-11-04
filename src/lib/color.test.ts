import { describe, expect, it } from 'vitest';
import { badgeBackground, barColor, contrastRatio, relativeLuminance } from './color';

describe('relativeLuminance', () => {
  it('spans black to white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('gives 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('is order independent', () => {
    expect(contrastRatio('#007A33', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#007A33'),
      5,
    );
  });
});

describe('badgeBackground', () => {
  /** Every NBA colour the fixtures use, including the awkward mid-tones. */
  const teamColors = [
    '#E03A3E', // Hawks / Blazers red — fails against both white and black raw
    '#007A33', // Celtics green
    '#7A7A7A', // Nets grey
    '#1D9099', // Hornets teal
    '#860038', // Cavaliers wine
    '#FDB927', // a bright gold, the hardest case
    '#0E2240', // Nuggets navy, already dark enough
  ];

  it('always reaches AA for white text', () => {
    for (const color of teamColors) {
      const adjusted = badgeBackground(color);
      expect(
        contrastRatio(adjusted, '#ffffff'),
        `${color} -> ${adjusted}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('leaves an already-dark colour alone', () => {
    expect(badgeBackground('#0E2240')).toBe('#0E2240');
  });

  it('only ever darkens, so the team stays recognisable', () => {
    for (const color of teamColors) {
      expect(relativeLuminance(badgeBackground(color))).toBeLessThanOrEqual(
        relativeLuminance(color) + 1e-9,
      );
    }
  });

  it('passes through a value that is not a hex colour', () => {
    expect(badgeBackground('rebeccapurple')).toBe('rebeccapurple');
  });
});

describe('barColor', () => {
  const surface = '#171b22';

  /** The dark end of the league, where a raw bar vanishes into the panel. */
  const darkTeamColors = [
    '#000000', // Nets black, the worst case
    '#0E2240', // Nuggets navy
    '#002B5C', // Jazz navy
    '#1D428A', // Warriors royal
    '#860038', // Cavaliers wine
  ];

  it('always clears 3:1 against the surface', () => {
    for (const color of [...darkTeamColors, '#007AC1', '#FDB927']) {
      const adjusted = barColor(color);
      expect(
        contrastRatio(adjusted, surface),
        `${color} -> ${adjusted}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('leaves an already-visible colour alone', () => {
    expect(barColor('#007AC1')).toBe('#007AC1');
    expect(barColor('#FDB927')).toBe('#FDB927');
  });

  it('only ever lightens, so the team stays recognisable', () => {
    for (const color of darkTeamColors) {
      expect(relativeLuminance(barColor(color))).toBeGreaterThanOrEqual(
        relativeLuminance(color) - 1e-9,
      );
    }
  });

  it('passes through a value that is not a hex colour', () => {
    expect(barColor('rebeccapurple')).toBe('rebeccapurple');
  });
});
