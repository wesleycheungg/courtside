import { espnSummarySchema } from '../src/data/espn/espnSchemas';
import { espnUrls, fetchEspn } from './_lib/espn';
import { badRequest, errorResponse, jsonResponse } from './_lib/respond';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const eventId = new URL(request.url).searchParams.get('event');

  if (!eventId || !/^\d+$/.test(eventId)) {
    return badRequest('`event` is required and must be a numeric id');
  }

  try {
    const { data, cached } = await fetchEspn({
      key: `summary:${eventId}`,
      url: espnUrls.summary(eventId),
      schema: espnSummarySchema,
    });
    return jsonResponse(data, cached);
  } catch (error) {
    return errorResponse(error);
  }
}
