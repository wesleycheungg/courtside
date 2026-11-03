/** Colour maths for keeping team-coloured surfaces readable. */

/** WCAG relative luminance. */
export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);

  const linear = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );

  return (
    0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

function blendToBlack(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  const mixed = [0, 2, 4]
    .map((i) => Math.round(parseInt(value.slice(i, i + 2), 16) * (1 - amount)))
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('');

  return `#${mixed}`;
}

const WHITE = '#ffffff';
const TARGET_CONTRAST = 4.5;

/**
 * Darkens a team colour just enough for white text to clear AA.
 *
 * Mid-tone NBA colours — Blazers red, Nets grey, Hornets teal — fail 4.5:1
 * against *both* white and near-black at the 10px bold the badge uses, so
 * picking a text colour is not sufficient. Shifting the background keeps the
 * team recognisable while making the abbreviation readable.
 */
export function badgeBackground(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;

  // Already readable: hand back the original rather than a re-cased copy.
  if (contrastRatio(hex, WHITE) >= TARGET_CONTRAST) return hex;

  for (let amount = 0.05; amount <= 0.7; amount += 0.05) {
    const candidate = blendToBlack(hex, amount);
    if (contrastRatio(candidate, WHITE) >= TARGET_CONTRAST) return candidate;
  }

  return blendToBlack(hex, 0.7);
}
