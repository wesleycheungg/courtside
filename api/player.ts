import { espnAthleteSchema, espnGameLogSchema } from '../src/data/espn/espnSchemas';
import { espnUrls, fetchEspn } from './_lib/espn';
import { badRequest, errorResponse, jsonResponse } from './_lib/respond';

export const config = { runtime: 'edge' };

/**
 * Returns the athlete profile and game log together, so the client makes one
 * request instead of two. Cached for a minute — a player's season averages
 * only move when a game finishes.
 */
export default async function handler(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id');

  if (!id || !/^\d+$/.test(id)) {
    return badRequest('`id` is required and must be a numeric athlete id');
  }

  try {
    const [athlete, gamelog] = await Promise.all([
      fetchEspn({
        key: `athlete:${id}`,
        url: espnUrls.athlete(id),
        schema: espnAthleteSchema,
        ttlMs: 60_000,
      }),
      fetchEspn({
        key: `athlete-gamelog:${id}`,
        url: espnUrls.athleteGameLog(id),
        schema: espnGameLogSchema,
        ttlMs: 60_000,
      }),
    ]);

    return jsonResponse(
      { athlete: athlete.data, gamelog: gamelog.data },
      athlete.cached && gamelog.cached,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
