import type { RosterEntry } from './types';

/**
 * Best scorers first.
 *
 * Shared by the ESPN normalizer and the mock so a roster reads the same
 * whichever provider produced it, and so fixtures do not have to be stored
 * pre-sorted. A player with no games yet has no average to rank on, so they
 * sort last rather than alongside a genuine 0.0 scorer. Name breaks ties, which
 * keeps the order stable for a snapshot or a screenshot.
 */
export function sortRoster(entries: RosterEntry[]): RosterEntry[] {
  return [...entries].sort((a, b) => {
    const aPoints = a.seasonAverages?.points;
    const bPoints = b.seasonAverages?.points;

    if (aPoints === undefined || bPoints === undefined) {
      if (aPoints !== bPoints) return aPoints === undefined ? 1 : -1;
    } else if (aPoints !== bPoints) {
      return bPoints - aPoints;
    }

    return a.name.localeCompare(b.name);
  });
}
