import type { BoxScore, PlayerStatLine, StatLeader } from './types';

const LEADER_STATS: StatLeader['stat'][] = ['points', 'rebounds', 'assists'];

/** Highest line for a stat. Strict `>` keeps the first player on a tie. */
function leaderFor(
  lines: PlayerStatLine[],
  stat: StatLeader['stat'],
): PlayerStatLine | undefined {
  return lines.reduce<PlayerStatLine | undefined>(
    (best, line) => (best === undefined || line[stat] > best[stat] ? line : best),
    undefined,
  );
}

/**
 * Points, rebounds, and assists leaders from each side. Shared by the ESPN
 * normalizer and the mock so both pick the same player on a tie. Returns an
 * empty list when either side has no lines.
 */
export function pickStatLeaders(box: BoxScore): StatLeader[] {
  return LEADER_STATS.flatMap((stat) => {
    const away = leaderFor(box.away, stat);
    const home = leaderFor(box.home, stat);
    return away && home ? [{ stat, away, home }] : [];
  });
}
