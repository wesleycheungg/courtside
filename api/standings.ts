import { espnStandingsSchema } from '../src/data/espn/espnSchemas';
import { cacheQuietly, saveStandings } from '../db/cache';
import { cachedStandingsFrom } from '../db/rows';
import { getSqlClient } from '../db/sql';
import { espnUrls, fetchEspn } from './_lib/espn';
import { errorResponse, jsonResponse } from './_lib/respond';

export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  try {
    const { data, cached } = await fetchEspn({
      key: 'standings',
      url: espnUrls.standings(),
      schema: espnStandingsSchema,
      // Standings move once a game finishes, not second to second.
      ttlMs: 60_000,
    });

    // See the note in scoreboard.ts: fire-and-forget, fresh fetches only.
    if (!cached) {
      void cacheQuietly(
        (client) => saveStandings(client, cachedStandingsFrom(data)),
        getSqlClient,
      );
    }

    return jsonResponse(data, cached);
  } catch (error) {
    return errorResponse(error);
  }
}
