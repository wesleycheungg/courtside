/**
 * Wire format -> domain types.
 *
 * This is the highest-risk code in the data layer (R1 in the test plan): a
 * mistake here shows a user the wrong score. It is pure and takes no clock, so
 * it is cheap to cover exhaustively with unit tests.
 */

import type {
  Conference,
  Game,
  GameState,
  Period,
  RosterEntry,
  Standing,
  TeamRef,
} from '../types';
import { sortRoster } from '../roster';
import type {
  WireGame,
  WireLineScore,
  WireRosterPlayer,
  WireStandings,
  WireTeam,
} from './wire';

export function normalizeTeam(
  wire: WireTeam,
  record?: { wins: number; losses: number },
): TeamRef {
  return {
    id: wire.teamId,
    name: wire.nickname,
    displayName: `${wire.market} ${wire.nickname}`,
    abbreviation: wire.abbrev,
    color: `#${wire.colorHex}`,
    ...(record ? { record: `${record.wins}-${record.losses}` } : {}),
  };
}

/** Periods 1-4 are quarters; anything beyond is overtime, numbered from 1. */
export function periodLabel(periodNumber: number): string {
  return periodNumber <= 4 ? `Q${periodNumber}` : `OT${periodNumber - 4}`;
}

export function normalizePeriods(linescores: WireLineScore[]): Period[] {
  return linescores.map((line) => ({
    number: line.period,
    label: periodLabel(line.period),
    awayScore: line.away,
    homeScore: line.home,
  }));
}

/**
 * Totals are summed from the period scores rather than trusted as a separate
 * field, so a final score can never disagree with its own box (R4).
 */
export function totalsFromPeriods(periods: Period[]): { away: number; home: number } {
  return periods.reduce(
    (sum, period) => ({
      away: sum.away + period.awayScore,
      home: sum.home + period.homeScore,
    }),
    { away: 0, home: 0 },
  );
}

export function normalizeGameState(wire: WireGame, startsAt: string): GameState {
  switch (wire.statusCode) {
    case 'pre':
      return { status: 'scheduled', tipoff: startsAt };
    case 'post':
      return {
        status: 'final',
        wentToOvertime: wire.linescores.some((line) => line.period > 4),
      };
    case 'in': {
      // A live wire game's current period is simply its last reported one.
      const periodNumber = wire.linescores.length || 1;
      return {
        status: 'live',
        periodNumber,
        periodLabel: periodLabel(periodNumber),
        clock: '',
      };
    }
  }
}

/**
 * Combines a YYYY-MM-DD date with a fixture's UTC time of day, optionally
 * rolling forward a day for games that tip after midnight UTC.
 */
export function toIsoInstant(date: string, timeUtc: string, dayOffset = 0): string {
  const instant = new Date(`${date}T${timeUtc}Z`);
  instant.setUTCDate(instant.getUTCDate() + dayOffset);
  return instant.toISOString();
}

export function normalizeGame(
  wire: WireGame,
  date: string,
  teamsById: ReadonlyMap<string, WireTeam>,
): Game {
  const awayTeam = teamsById.get(wire.awayTeamId);
  const homeTeam = teamsById.get(wire.homeTeamId);
  if (!awayTeam || !homeTeam) {
    throw new Error(
      `Game ${wire.gameId} references an unknown team (${wire.awayTeamId} vs ${wire.homeTeamId})`,
    );
  }

  const startsAt = toIsoInstant(date, wire.tipoffUtc, wire.tipoffDayOffset ?? 0);
  const periods = normalizePeriods(wire.linescores);
  const totals = totalsFromPeriods(periods);

  return {
    id: wire.gameId,
    league: 'nba',
    startsAt,
    state: normalizeGameState(wire, startsAt),
    away: normalizeTeam(awayTeam, wire.awayRecord),
    home: normalizeTeam(homeTeam, wire.homeRecord),
    awayScore: totals.away,
    homeScore: totals.home,
  };
}

export function normalizeRosterPlayer(wire: WireRosterPlayer): RosterEntry {
  return {
    playerId: wire.playerId,
    name: `${wire.firstName} ${wire.lastName}`,
    position: wire.positionAbbrev,
    jerseyNumber: wire.jersey,
    // A player with no games yet has no average. Parsing an absent stat to 0
    // would put a rookie alongside a genuine 0.0 scorer in the table and the
    // sort order alike.
    ...(wire.stats
      ? {
          seasonAverages: {
            points: Number(wire.stats.avgPoints),
            rebounds: Number(wire.stats.avgRebounds),
            assists: Number(wire.stats.avgAssists),
            fieldGoalPercent: Number(wire.stats.fieldGoalPct),
          },
        }
      : {}),
  };
}

export function normalizeRoster(players: WireRosterPlayer[]): RosterEntry[] {
  return sortRoster(players.map(normalizeRosterPlayer));
}

/** Standard NBA games-behind: average of the win and loss gaps to the leader. */
export function gamesBehind(
  leader: { wins: number; losses: number },
  team: { wins: number; losses: number },
): number {
  return (leader.wins - team.wins + (team.losses - leader.losses)) / 2;
}

export function winPercent(wins: number, losses: number): number {
  const played = wins + losses;
  return played === 0 ? 0 : wins / played;
}

export function normalizeConference(
  id: 'east' | 'west',
  name: string,
  rows: WireStandings[keyof WireStandings],
  teamsById: ReadonlyMap<string, WireTeam>,
): Conference {
  // Sort before ranking: the feed's order is not authoritative.
  const sorted = [...rows].sort((a, b) => {
    const byPct = winPercent(b.wins, b.losses) - winPercent(a.wins, a.losses);
    return byPct !== 0 ? byPct : b.wins - a.wins;
  });

  const leader = sorted[0];
  const standings: Standing[] = sorted.map((row, index) => {
    const team = teamsById.get(row.teamId);
    if (!team) throw new Error(`Standings reference an unknown team: ${row.teamId}`);

    return {
      rank: index + 1,
      team: normalizeTeam(team),
      wins: row.wins,
      losses: row.losses,
      winPercent: winPercent(row.wins, row.losses),
      gamesBehind: leader ? gamesBehind(leader, row) : 0,
      streak: row.streak,
    };
  });

  return { id, name, standings };
}
