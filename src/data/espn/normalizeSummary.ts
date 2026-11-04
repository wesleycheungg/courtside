/**
 * ESPN summary -> GameDetail and play-by-play.
 *
 * The summary's box score is label-indexed: `labels` names the columns and each
 * athlete's `stats` holds the values in that order, all as strings. Nothing
 * here may assume a column position — the label is the only reliable key.
 */

import type {
  BoxScore,
  GameDetail,
  Period,
  PlayEvent,
  PlayerStatLine,
  StatLeader,
  TeamStat,
} from '../types';
import type { EspnBoxscoreTeam, EspnPlayerGroup, EspnSummary } from './espnSchemas';
import { normalizeEspnGame, normalizeEspnPeriods, sideOf } from './normalizeEspn';

/** Stats we surface in the comparison, in the order the design shows them. */
const TEAM_STAT_LABELS: { name: string; label: string }[] = [
  { name: 'fieldGoalPct', label: 'Field Goal %' },
  { name: 'threePointFieldGoalPct', label: '3-Point %' },
  { name: 'freeThrowPct', label: 'Free Throw %' },
  { name: 'totalRebounds', label: 'Rebounds' },
  { name: 'assists', label: 'Assists' },
  { name: 'steals', label: 'Steals' },
  { name: 'turnovers', label: 'Turnovers' },
  { name: 'pointsInPaint', label: 'Points in Paint' },
];

/** "12-31" and "43" both need to become a number to size a bar. */
export function statToNumber(displayValue: string): number {
  const made = /^(\d+(?:\.\d+)?)-\d+$/.exec(displayValue);
  if (made) return Number(made[1]);

  const plain = Number(displayValue.replace('%', ''));
  return Number.isFinite(plain) ? plain : 0;
}

/** Away's share of the pair, used to size the comparison bars. Halves on 0-0. */
export function shareOf(away: number, home: number): number {
  const total = away + home;
  return total === 0 ? 0.5 : away / total;
}

function findStat(team: EspnBoxscoreTeam | undefined, name: string): string | undefined {
  return team?.statistics.find((stat) => stat.name === name)?.displayValue;
}

export function normalizeTeamStats(
  away: EspnBoxscoreTeam | undefined,
  home: EspnBoxscoreTeam | undefined,
): TeamStat[] {
  const stats: TeamStat[] = [];

  for (const { name, label } of TEAM_STAT_LABELS) {
    const awayValue = findStat(away, name);
    const homeValue = findStat(home, name);
    // A stat ESPN did not send is omitted rather than rendered as a zero bar.
    if (awayValue === undefined || homeValue === undefined) continue;

    const suffix = name.endsWith('Pct') ? '%' : '';
    stats.push({
      label,
      awayValue: `${awayValue}${suffix}`,
      homeValue: `${homeValue}${suffix}`,
      awayShare: shareOf(statToNumber(awayValue), statToNumber(homeValue)),
    });
  }

  return stats;
}

/** Minutes arrive as "29"; a player who did not appear has "--". */
function toNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** "10-19" -> [10, 19] */
function splitMade(raw: string | undefined): [number, number] {
  const match = /^(\d+)-(\d+)$/.exec(raw ?? '');
  return match ? [Number(match[1]), Number(match[2])] : [0, 0];
}

export function normalizePlayerGroup(
  group: EspnPlayerGroup | undefined,
): PlayerStatLine[] {
  const block = group?.statistics[0];
  if (!block) return [];

  // Column positions vary; read them by label.
  const column = (label: string) => block.labels.indexOf(label);
  const min = column('MIN');
  const pts = column('PTS');
  const reb = column('REB');
  const ast = column('AST');
  const fg = column('FG');
  const plusMinus = column('+/-');

  const at = (stats: string[], index: number): string | undefined =>
    index >= 0 ? stats[index] : undefined;

  return block.athletes
    .filter((entry) => !entry.didNotPlay)
    .map((entry) => {
      const [made, attempted] = splitMade(at(entry.stats, fg));
      const plusMinusRaw = at(entry.stats, plusMinus);
      const parsedPlusMinus = plusMinusRaw === undefined ? NaN : Number(plusMinusRaw);

      return {
        playerId: entry.athlete.id,
        name: entry.athlete.shortName ?? entry.athlete.displayName,
        position: entry.athlete.position?.abbreviation ?? '—',
        minutes: toNumber(at(entry.stats, min)),
        points: toNumber(at(entry.stats, pts)),
        rebounds: toNumber(at(entry.stats, reb)),
        assists: toNumber(at(entry.stats, ast)),
        fieldGoalsMade: made,
        fieldGoalsAttempted: attempted,
        ...(Number.isFinite(parsedPlusMinus) ? { plusMinus: parsedPlusMinus } : {}),
      };
    });
}

/** Highest scorer from each side, which is what the design's panel shows. */
export function pickTopPerformers(box: BoxScore): PlayerStatLine[] {
  const best = (lines: PlayerStatLine[]) =>
    [...lines].sort((a, b) => b.points - a.points)[0];

  return [best(box.home), best(box.away)].filter(
    (line): line is PlayerStatLine => line !== undefined,
  );
}

/** Leaders for points, rebounds, and assists from each side. */
export function pickStatLeaders(box: BoxScore): StatLeader[] {
  const leaderFor = (
    lines: PlayerStatLine[],
    stat: 'points' | 'rebounds' | 'assists',
  ): PlayerStatLine | undefined => {
    return [...lines].sort((a, b) => b[stat] - a[stat])[0];
  };

  const stats: ('points' | 'rebounds' | 'assists')[] = ['points', 'rebounds', 'assists'];

  return stats
    .map((stat) => {
      const away = leaderFor(box.away, stat);
      const home = leaderFor(box.home, stat);
      return away && home ? { stat, away, home } : undefined;
    })
    .filter((leader): leader is StatLeader => leader !== undefined);
}

export function normalizeEspnSummary(summary: EspnSummary): GameDetail {
  const competition = summary.header.competitions[0];
  if (!competition) throw new Error(`Summary ${summary.header.id} has no competition`);

  const game = normalizeEspnGame({
    id: summary.header.id,
    date: competition.date,
    competitions: [competition],
  });
  if (!game) throw new Error(`Summary ${summary.header.id} is missing a team`);

  const awayCompetitor = sideOf(competition.competitors, 'away');
  const homeCompetitor = sideOf(competition.competitors, 'home');

  const periods: Period[] = normalizeEspnPeriods(competition.competitors);

  const boxTeams = summary.boxscore?.teams ?? [];
  const awayBox = boxTeams.find((t) => t.homeAway === 'away');
  const homeBox = boxTeams.find((t) => t.homeAway === 'home');

  const playerGroups = summary.boxscore?.players ?? [];
  const byTeamId = (id: string | undefined) =>
    playerGroups.find((group) => group.team.id === id);

  const boxScore: BoxScore = {
    away: normalizePlayerGroup(byTeamId(awayCompetitor?.team.id)),
    home: normalizePlayerGroup(byTeamId(homeCompetitor?.team.id)),
  };

  return {
    ...game,
    periods,
    teamStats: normalizeTeamStats(awayBox, homeBox),
    boxScore,
    topPerformers: pickTopPerformers(boxScore),
    statLeaders: pickStatLeaders(boxScore),
  };
}

/** Newest first, which is the order the design lists plays in. */
export function normalizeEspnPlays(summary: EspnSummary): PlayEvent[] {
  const plays = summary.plays ?? [];

  return [...plays].reverse().map((play) => ({
    id: play.id,
    periodNumber: play.period.number,
    clock: play.clock.displayValue,
    ...(play.team ? { teamId: play.team.id } : {}),
    description: play.text ?? '—',
    isScoringPlay: play.scoringPlay ?? false,
    awayScore: play.awayScore,
    homeScore: play.homeScore,
  }));
}
