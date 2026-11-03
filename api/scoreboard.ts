import { espnScoreboardSchema } from '../src/data/espn/espnSchemas';
import { espnUrls, fetchEspn, isEspnDate } from './_lib/espn';
import { badRequest, errorResponse, jsonResponse } from './_lib/respond';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const date = new URL(request.url).searchParams.get('dates');

  if (!date || !isEspnDate(date)) {
    return badRequest('`dates` is required and must be YYYYMMDD');
  }

  try {
    const { data, cached } = await fetchEspn({
      key: `scoreboard:${date}`,
      url: espnUrls.scoreboard(date),
      schema: espnScoreboardSchema,
    });
    return jsonResponse(data, cached);
  } catch (error) {
    return errorResponse(error);
  }
}
