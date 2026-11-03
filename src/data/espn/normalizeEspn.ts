/**
 * ESPN wire format -> domain types.
 *
 * The highest-risk code in the live path: a mistake here shows a user the wrong
 * score. Pure and clock-free, so it is cheap to cover exhaustively.
 */

import type {
  Conference,
  ConferenceId,
  Game,
  GameState,
  Standing,
  TeamRef,
} from '../types';
import { periodLabel, winPercent } from '../mock/normalize';
import type {
  EspnCompetitor,
  EspnEvent,
  EspnScoreboard,
  EspnStandings,
  EspnStandingsEntry,
  EspnTeam,
  EspnTeams,
} from './espnSchemas';

/** Used when ESPN omits a team color, which it does on standings entries. */
const FALLBACK_COLOR = '#4C5564';

export function normalizeEspnTeam(team: EspnTeam, record?: string): TeamRef {
  return {
    id: team.id,
    name: team.shortDisplayName ?? team.name ?? team.displayName,
    displayName: team.displayName,
    abbreviation: team.abbreviation,
    color: team.color ? `#${team.color}` : FALLBACK_COLOR,
    ...(team.logo ? { logoUrl: team.logo } : {}),
    ...(record ? { record } : {}),
  };
}

/** `score` arrives as a string, and is absent before tip-off. */
export function parseScore(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** The overall W-L record, ignoring the home/road/division splits. */
export function overallRecord(competitor: EspnCompetitor): string | undefined {
  // `records` on the scoreboard, `record` on the summary header.
  const all = competitor.records ?? competitor.record ?? [];
  return all.find((record) => record.type === 'total')?.summary;
}

/**
 * A period's points, from whichever field the endpoint happened to use: the
 * scoreboard sends a numeric `value`, the summary header a `displayValue`
 * string.
 */
export function lineScoreValue(line: {
  value?: number | undefined;
  displayValue?: string | undefined;
}): number {
  if (typeof line.value === 'number') return line.value;
  const parsed = Number(line.displayValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Competitors are ordered home-first, so the side must be looked up, not indexed. */
export function sideOf(
  competitors: EspnCompetitor[],
  side: 'home' | 'away',
): EspnCompetitor | undefined {
  return competitors.find((competitor) => competitor.homeAway === side);
}

export function normalizeEspnState(
  state: 'pre' | 'in' | 'post',
  period: number,
  displayClock: string,
  tipoff: string,
): GameState {
  switch (state) {
    case 'pre':
      return { status: 'scheduled', tipoff };
    case 'post':
      return { status: 'final', wentToOvertime: period > 4 };
    case 'in':
      return {
        status: 'live',
        periodNumber: Math.max(1, period),
        periodLabel: periodLabel(Math.max(1, period)),
        // ESPN sends "0.0" at a period break; an empty clock reads better than
        // a stopped one, and matches how the design shows halftime.
        clock: displayClock === '0.0' ? '' : displayClock,
      };
  }
}

export function normalizeEspnGame(event: EspnEvent): Game | null {
  const competition = event.competitions[0];
  if (!competition) return null;

  const away = sideOf(competition.competitors, 'away');
  const home = sideOf(competition.competitors, 'home');
  // A competition missing a side is malformed; skipping it loses one game
  // rather than failing the whole slate.
  if (!away || !home) return null;

  const { status } = competition;
  // The summary header omits both, so fall back to what the line scores imply.
  const period = status.period ?? away.linescores?.length ?? 0;
  const displayClock = status.displayClock ?? '';

  return {
    id: event.id,
    league: 'nba',
    startsAt: new Date(event.date).toISOString(),
    state: normalizeEspnState(
      status.type.state,
      period,
      displayClock,
      new Date(event.date).toISOString(),
    ),
    away: normalizeEspnTeam(away.team, overallRecord(away)),
    home: normalizeEspnTeam(home.team, overallRecord(home)),
    awayScore: parseScore(away.score),
    homeScore: parseScore(home.score),
  };
}

export function normalizeEspnScoreboard(scoreboard: EspnScoreboard): Game[] {
  return scoreboard.events
    .map(normalizeEspnGame)
    .filter((game): game is Game => game !== null);
}

/** Pulls a numeric stat out of the flat stat bag. */
export function statValue(entry: EspnStandingsEntry, name: string): number | undefined {
  return entry.stats.find((stat) => stat.name === name)?.value;
}

export function statDisplay(entry: EspnStandingsEntry, name: string): string | undefined {
  return entry.stats.find((stat) => stat.name === name)?.displayValue;
}

export function conferenceIdFromName(name: string): ConferenceId | null {
  const lower = name.toLowerCase();
  if (lower.includes('eastern')) return 'east';
  if (lower.includes('western')) return 'west';
  return null;
}

/**
 * @param colorsById team colors from the teams endpoint — standings entries
 * carry none, so the color has to be joined in.
 */
export function normalizeEspnStandings(
  standings: EspnStandings,
  colorsById: ReadonlyMap<string, EspnTeam>,
): Conference[] {
  const conferences: Conference[] = [];

  for (const child of standings.children) {
    const id = conferenceIdFromName(child.name);
    if (!id) continue;

    const rows: Standing[] = child.standings.entries.map((entry) => {
      const wins = statValue(entry, 'wins') ?? 0;
      const losses = statValue(entry, 'losses') ?? 0;
      const team = colorsById.get(entry.team.id) ?? entry.team;

      return {
        // Trust ESPN's own seeding where it exists; fall back to the order we
        // sort into below.
        rank: statValue(entry, 'playoffSeed') ?? 0,
        team: normalizeEspnTeam(
          { ...team, id: entry.team.id },
          statDisplay(entry, 'overall'),
        ),
        wins,
        losses,
        winPercent: statValue(entry, 'winPercent') ?? winPercent(wins, losses),
        gamesBehind: statValue(entry, 'gamesBehind') ?? 0,
        streak: statDisplay(entry, 'streak') ?? '—',
      };
    });

    // Entries arrive unsorted, so order by seed and renumber anything ESPN
    // left unseeded.
    rows.sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      return b.winPercent - a.winPercent;
    });
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });

    conferences.push({ id, name: child.name, standings: rows });
  }

  return conferences;
}

export function teamsById(teams: EspnTeams): Map<string, EspnTeam> {
  const entries = teams.sports[0]?.leagues[0]?.teams ?? [];
  return new Map(entries.map(({ team }) => [team.id, team]));
}
