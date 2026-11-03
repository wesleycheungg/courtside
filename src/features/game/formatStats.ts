/** Display formatting for the box score. Pure, and shared across components. */

/**
 * "Jayson Tatum" -> "J. Tatum", so the name column leaves room for the stats.
 * Already-short names ESPN sends, like "J. Allen", pass through unchanged.
 */
export function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const [first, ...rest] = parts;
  if (!first || rest.length === 0) return name;
  if (first.endsWith('.')) return name;

  return `${first[0]}. ${rest.join(' ')}`;
}

/** Minutes can arrive fractional; the box score shows whole minutes. */
export function formatMinutes(minutes: number): string {
  return String(Math.round(minutes));
}

/** A real minus sign rather than a hyphen, matching the design. */
export function formatPlusMinus(value: number | undefined): string {
  if (value === undefined) return '—';
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
}
