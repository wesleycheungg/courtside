/**
 * ESPN athlete + game log -> Player.
 *
 * The game log is label-indexed like the box score, so columns are read by
 * label rather than position.
 */

import type { GameLogEntry, Player, ShootingSplit, StatTile } from '../types';
import type { EspnAthlete, EspnGameLog } from './espnSchemas';

const FALLBACK_COLOR = '#4C5564';

/** statsSummary names mapped to the tile labels the design uses. */
const TILE_LABELS: Record<string, string> = {
  avgPoints: 'PTS',
  avgRebounds: 'REB',
  avgAssists: 'AST',
  fieldGoalPct: 'FG%',
};

export function normalizeSeasonAverages(athlete: EspnAthlete['athlete']): StatTile[] {
  const stats = athlete.statsSummary?.statistics ?? [];

  return stats
    .filter((stat) => stat.name in TILE_LABELS)
    .map((stat) => ({
      label: TILE_LABELS[stat.name] ?? stat.name,
      value: stat.displayValue,
      ...(stat.rank !== undefined ? { rank: stat.rank } : {}),
    }));
}

/** "14-35" -> { made: 14, attempted: 35 } */
function splitMade(raw: string | undefined): { made: number; attempted: number } {
  const match = /^(\d+)-(\d+)$/.exec(raw ?? '');
  return match
    ? { made: Number(match[1]), attempted: Number(match[2]) }
    : { made: 0, attempted: 0 };
}

function percent(made: number, attempted: number): number {
  return attempted === 0 ? 0 : Math.round((made / attempted) * 1000) / 10;
}

interface LogColumns {
  index: (label: string) => number;
  at: (stats: string[], label: string) => string | undefined;
}

function columnsOf(labels: string[]): LogColumns {
  const index = (label: string) => labels.indexOf(label);
  return {
    index,
    at: (stats, label) => {
      const i = index(label);
      return i >= 0 ? stats[i] : undefined;
    },
  };
}

/**
 * Season shooting splits, summed across the game log. ESPN's summary gives
 * percentages but not makes and attempts, and the design shows both.
 *
 * Not by court zone — that needs per-shot coordinates, which these endpoints
 * do not carry. Zones ship with the shot charts.
 */
export function normalizeShootingSplits(log: EspnGameLog): ShootingSplit[] {
  const labels = log.labels ?? [];
  const { at } = columnsOf(labels);
  const rows = log.seasonTypes?.[0]?.categories.flatMap((c) => c.events) ?? [];

  const totals = [
    { label: 'Field goals', column: 'FG' },
    { label: 'Three pointers', column: '3PT' },
    { label: 'Free throws', column: 'FT' },
  ].map(({ label, column }) => {
    let made = 0;
    let attempted = 0;

    for (const row of rows) {
      const split = splitMade(at(row.stats, column));
      made += split.made;
      attempted += split.attempted;
    }

    return { label, made, attempted, percent: percent(made, attempted) };
  });

  return totals.filter((split) => split.attempted > 0);
}

export function normalizeGameLog(log: EspnGameLog, limit = 7): GameLogEntry[] {
  const labels = log.labels ?? [];
  const { at } = columnsOf(labels);
  const rows = log.seasonTypes?.[0]?.categories.flatMap((c) => c.events) ?? [];
  const meta = log.events ?? {};

  return rows.slice(0, limit).map((row) => {
    const event = meta[row.eventId];
    const fg = splitMade(at(row.stats, 'FG'));
    const score = event?.score ? ` ${event.score}` : '';

    return {
      gameId: row.eventId,
      opponentAbbreviation: event?.opponent?.abbreviation ?? '—',
      // ESPN marks away games with "@".
      isHome: event?.atVs !== '@',
      result: `${event?.gameResult ?? ''}${score}`.trim() || '—',
      points: Number(at(row.stats, 'PTS') ?? 0) || 0,
      rebounds: Number(at(row.stats, 'REB') ?? 0) || 0,
      assists: Number(at(row.stats, 'AST') ?? 0) || 0,
      fieldGoalsMade: fg.made,
      fieldGoalsAttempted: fg.attempted,
    };
  });
}

export function normalizeEspnAthlete(response: EspnAthlete, log: EspnGameLog): Player {
  const { athlete, season } = response;
  const debut = athlete.debutYear;
  const seasonYear = season?.year;

  return {
    id: athlete.id,
    name: athlete.displayName,
    teamId: athlete.team?.id ?? '',
    teamName: athlete.team?.displayName ?? '',
    teamColor: athlete.team?.color ? `#${athlete.team.color}` : FALLBACK_COLOR,
    position: athlete.position?.displayName ?? '—',
    jerseyNumber: athlete.jersey ?? '',
    height: athlete.displayHeight ?? '—',
    age: athlete.age ?? 0,
    seasonNumber: debut && seasonYear ? Math.max(1, seasonYear - debut) : 1,
    seasonAverages: normalizeSeasonAverages(athlete),
    shootingSplits: normalizeShootingSplits(log),
    gameLog: normalizeGameLog(log),
  };
}
