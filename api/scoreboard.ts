import { espnScoreboardSchema } from '../src/data/espn/espnSchemas';
import { cacheQuietly, saveGames } from '../db/cache';
import { cachedGamesFrom } from '../db/rows';
import { getSqlClient } from '../db/sql';
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

    // Write through to Postgres on a fresh fetch only, and never block the
    // response on it: the cache is where the SQL data-validation suite reads
    // from, not something a score depends on.
    if (!cached) {
      void cacheQuietly(
        (client) => saveGames(client, cachedGamesFrom(data)),
        getSqlClient,
      );
    }

    return jsonResponse(data, cached);
  } catch (error) {
    return errorResponse(error);
  }
}
