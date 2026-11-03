/** NBA postseason cutoffs: seeds 1-6 go straight through, 7-10 play in. */

export type SeedBand = 'playoffs' | 'playin' | 'none';

export function seedBand(rank: number): SeedBand {
  if (rank >= 1 && rank <= 6) return 'playoffs';
  if (rank >= 7 && rank <= 10) return 'playin';
  return 'none';
}

/**
 * Spoken label for the band. The marker is colour-coded, so this is what keeps
 * the distinction available to a screen reader or a colour-blind reader.
 */
export function seedBandLabel(band: SeedBand): string | null {
  switch (band) {
    case 'playoffs':
      return 'Playoff position';
    case 'playin':
      return 'Play-in position';
    case 'none':
      return null;
  }
}

/** Win percentage as the ".714" form the design uses. */
export function formatWinPercent(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}

/** Games behind, with a dash for the leader. */
export function formatGamesBehind(value: number): string {
  if (value === 0) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
