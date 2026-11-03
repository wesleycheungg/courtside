import { z } from 'zod';
import { espnCompetitionSchema } from '../src/data/espn/espnSchemas';
import { espnUrls, fetchEspn } from './_lib/espn';
import { badRequest, errorResponse, jsonResponse } from './_lib/respond';

export const config = { runtime: 'edge' };

/**
 * Minimal for now: this route exists so the game-detail screen in M3 has a
 * proxy to call, and validates only the header competition it will certainly
 * need. The boxscore, plays and winprobability blocks are passed through
 * unvalidated until M3 builds against them and their shapes are captured.
 */
const summarySchema = z.object({
  header: z.object({
    id: z.string(),
    competitions: z.array(espnCompetitionSchema).min(1),
  }),
  boxscore: z.unknown().optional(),
  plays: z.unknown().optional(),
});

export default async function handler(request: Request): Promise<Response> {
  const eventId = new URL(request.url).searchParams.get('event');

  if (!eventId || !/^\d+$/.test(eventId)) {
    return badRequest('`event` is required and must be a numeric id');
  }

  try {
    const { data, cached } = await fetchEspn({
      key: `summary:${eventId}`,
      url: espnUrls.summary(eventId),
      schema: summarySchema,
    });
    return jsonResponse(data, cached);
  } catch (error) {
    return errorResponse(error);
  }
}
