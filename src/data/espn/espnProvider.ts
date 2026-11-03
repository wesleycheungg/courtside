/**
 * Live data, via our own proxy.
 *
 * This never names an ESPN host — it only ever calls `/api/*`. That is what
 * makes the "browser never calls ESPN directly" rule structural rather than a
 * convention someone has to remember.
 */

import type { DataProvider } from '../provider';
import type { Conference, Game, GameDetail, PlayEvent, Player } from '../types';
import {
  espnScoreboardSchema,
  espnStandingsSchema,
  espnTeamsSchema,
  type EspnTeam,
} from './espnSchemas';
import {
  normalizeEspnScoreboard,
  normalizeEspnStandings,
  teamsById,
} from './normalizeEspn';
import { parseOrThrow } from '../schemas';

/** YYYY-MM-DD -> YYYYMMDD, which is what the scoreboard endpoint wants. */
export function toEspnDate(date: string): string {
  return date.replaceAll('-', '');
}

interface ProxyErrorBody {
  error?: string;
  message?: string;
  issues?: string[];
}

async function getJson<T>(
  path: string,
  schema: Parameters<typeof parseOrThrow<T>>[0],
): Promise<T> {
  const response = await fetch(path, { headers: { accept: 'application/json' } });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ProxyErrorBody;
    const detail = body.issues?.length ? ` (${body.issues.join('; ')})` : '';
    throw new Error(
      body.message ? `${body.message}${detail}` : `Request to ${path} failed`,
    );
  }

  return parseOrThrow(schema, await response.json(), path);
}

export interface EspnProviderOptions {
  /** Overridden in tests; defaults to this origin's proxy. */
  baseUrl?: string;
}

export function createEspnProvider({
  baseUrl = '/api',
}: EspnProviderOptions = {}): DataProvider {
  // Team branding is stable for a season, so it is fetched once per page load
  // and shared by every standings call.
  let teamCache: Promise<Map<string, EspnTeam>> | null = null;

  function loadTeams(): Promise<Map<string, EspnTeam>> {
    teamCache ??= getJson(`${baseUrl}/teams`, espnTeamsSchema)
      .then(teamsById)
      .catch((error: unknown) => {
        // Let the next call retry rather than caching a failure forever.
        teamCache = null;
        throw error;
      });
    return teamCache;
  }

  return {
    name: 'espn',

    async getGames(date: string): Promise<Game[]> {
      const scoreboard = await getJson(
        `${baseUrl}/scoreboard?dates=${toEspnDate(date)}`,
        espnScoreboardSchema,
      );
      return normalizeEspnScoreboard(scoreboard);
    },

    async getStandings(): Promise<Conference[]> {
      const [standings, teams] = await Promise.all([
        getJson(`${baseUrl}/standings`, espnStandingsSchema),
        loadTeams(),
      ]);
      return normalizeEspnStandings(standings, teams);
    },

    // M3 builds the detail screen; the proxy route exists, but normalizing the
    // boxscore and plays blocks waits until there is UI to validate against.
    async getGame(): Promise<GameDetail> {
      throw new Error('EspnProvider.getGame arrives with the game detail screen (M3).');
    },

    async getPlayByPlay(): Promise<PlayEvent[]> {
      throw new Error(
        'EspnProvider.getPlayByPlay arrives with the game detail screen (M3).',
      );
    },

    async getPlayer(): Promise<Player> {
      throw new Error('EspnProvider.getPlayer arrives with the player screen (M5).');
    },
  };
}
