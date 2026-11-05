import { espnRosterSchema } from '../src/data/espn/espnSchemas';
import { ROSTER_CACHE_TTL_MS, espnUrls, fetchEspn } from './_lib/espn';
import { badRequest, errorResponse, jsonResponse } from './_lib/respond';

export const config = { runtime: 'edge' };

/**
 * A team's roster with season averages, for the box score before tip-off. The
 * pre-game summary carries neither, so this is a separate endpoint — fetched
 * lazily and only for the team on show, so a finished game never pays for it.
 */
export default async function handler(request: Request): Promise<Response> {
  const teamId = new URL(request.url).searchParams.get('team');

  if (!teamId || !/^\d+$/.test(teamId)) {
    return badRequest('`team` is required and must be a numeric team id');
  }

  try {
    const { data, cached } = await fetchEspn({
      key: `roster:${teamId}`,
      url: espnUrls.teamRoster(teamId),
      schema: espnRosterSchema,
      ttlMs: ROSTER_CACHE_TTL_MS,
    });
    return jsonResponse(data, cached);
  } catch (error) {
    return errorResponse(error);
  }
}
