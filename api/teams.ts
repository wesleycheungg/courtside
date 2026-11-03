import { espnTeamsSchema } from '../src/data/espn/espnSchemas';
import { TEAMS_CACHE_TTL_MS, espnUrls, fetchEspn } from './_lib/espn';
import { errorResponse, jsonResponse } from './_lib/respond';

export const config = { runtime: 'edge' };

/**
 * Team colors and logos. Standings entries carry no color, so the client joins
 * against this. Cached for a day — rosters change, branding does not.
 */
export default async function handler(): Promise<Response> {
  try {
    const { data, cached } = await fetchEspn({
      key: 'teams',
      url: espnUrls.teams(),
      schema: espnTeamsSchema,
      ttlMs: TEAMS_CACHE_TTL_MS,
    });
    return jsonResponse(data, cached);
  } catch (error) {
    return errorResponse(error);
  }
}
