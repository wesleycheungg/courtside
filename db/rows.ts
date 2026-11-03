/**
 * ESPN payload -> cache rows.
 *
 * Deliberately built on the same normalizers the UI uses, rather than reading
 * the wire format again. If the cache mapped ESPN's shape independently, the
 * SQL assertions would be checking the cache's arithmetic rather than the
 * app's — and the one invariant worth proving is that the score a user sees
 * equals the sum of the quarters a user sees.
 */

import {
  normalizeEspnPeriods,
  normalizeEspnScoreboard,
  normalizeEspnStandings,
  teamsById,
} from '../src/data/espn/normalizeEspn';
import type {
  EspnScoreboard,
  EspnStandings,
  EspnTeams,
} from '../src/data/espn/espnSchemas';
import type { Conference } from '../src/data/types';
import type { CachedGame } from './cache';

export function cachedGamesFrom(scoreboard: EspnScoreboard): CachedGame[] {
  const games = normalizeEspnScoreboard(scoreboard);
  const periodsById = new Map(
    scoreboard.events.map((event) => [
      event.id,
      normalizeEspnPeriods(event.competitions[0]?.competitors ?? []),
    ]),
  );

  return games.map((game) => ({ game, periods: periodsById.get(game.id) ?? [] }));
}

/**
 * @param teams the teams payload, when the caller has one. Standings entries
 * carry no colour, but the cache stores none either, so an absent teams
 * payload costs nothing here.
 */
export function cachedStandingsFrom(
  standings: EspnStandings,
  teams?: EspnTeams,
): Conference[] {
  return normalizeEspnStandings(standings, teams ? teamsById(teams) : new Map());
}
