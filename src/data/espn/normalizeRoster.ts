/**
 * ESPN team roster -> RosterEntry[].
 *
 * The four season averages are spread across named categories — REB under
 * `general`, PTS/AST/FG% under `offensive` — so the categories are flattened
 * and stats read by name, never by position. An athlete with no games played
 * arrives with a `splits` object holding no categories at all; that becomes an
 * absent `seasonAverages`, not a row of zeros.
 */

import type { RosterEntry, SeasonAverages } from '../types';
import { sortRoster } from '../roster';
import type { EspnRoster, EspnRosterAthlete } from './espnSchemas';

const MISSING_POSITION = '—';

/** The stat names the table's four columns are built from. */
const AVERAGE_NAMES = {
  points: 'avgPoints',
  rebounds: 'avgRebounds',
  assists: 'avgAssists',
  fieldGoalPercent: 'fieldGoalPct',
} as const;

function seasonAveragesOf(athlete: EspnRosterAthlete): SeasonAverages | undefined {
  const byName = new Map(
    (athlete.statistics?.splits?.categories ?? [])
      .flatMap((category) => category.stats)
      .map((stat) => [stat.name, stat.value]),
  );

  const points = byName.get(AVERAGE_NAMES.points);
  const rebounds = byName.get(AVERAGE_NAMES.rebounds);
  const assists = byName.get(AVERAGE_NAMES.assists);
  const fieldGoalPercent = byName.get(AVERAGE_NAMES.fieldGoalPercent);

  // All four or none. A partial row would mean guessing whether a missing
  // stat is a zero or an absence, and those read very differently in a table.
  if (
    points === undefined ||
    rebounds === undefined ||
    assists === undefined ||
    fieldGoalPercent === undefined
  ) {
    return undefined;
  }

  return { points, rebounds, assists, fieldGoalPercent };
}

export function normalizeRosterAthlete(athlete: EspnRosterAthlete): RosterEntry {
  const averages = seasonAveragesOf(athlete);

  return {
    playerId: athlete.id,
    // The full name: the table abbreviates it itself, as the box score does.
    name: athlete.displayName,
    position: athlete.position?.abbreviation ?? MISSING_POSITION,
    jerseyNumber: athlete.jersey ?? '',
    ...(averages ? { seasonAverages: averages } : {}),
  };
}

export function normalizeEspnRoster(roster: EspnRoster): RosterEntry[] {
  const seen = new Set<string>();
  const athletes = roster.positionGroups
    .flatMap((group) => group.athletes)
    // NBA sends a single group, but the shape allows several and a repeated
    // athlete would be a repeated React key.
    .filter((athlete) => {
      if (seen.has(athlete.id)) return false;
      seen.add(athlete.id);
      return true;
    });

  return sortRoster(athletes.map(normalizeRosterAthlete));
}
