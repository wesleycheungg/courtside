/** Shared response shaping, so every route fails the same way. */

import { CACHE_TTL_MS, SchemaError, UpstreamError } from './espn';

export function jsonResponse(body: unknown, cached: boolean): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Let Vercel's edge hold it for the same window as the in-memory cache.
      'cache-control': `public, max-age=0, s-maxage=${Math.floor(
        CACHE_TTL_MS / 1000,
      )}, stale-while-revalidate=30`,
      'x-courtside-cache': cached ? 'hit' : 'miss',
    },
  });
}

/**
 * Turns a thrown error into a typed JSON body. Schema failures report as 502
 * with the offending field paths — the client cannot fix them, but whoever
 * reads the response can see exactly what drifted.
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof SchemaError) {
    return Response.json(
      { error: 'schema_validation_failed', message: error.message, issues: error.issues },
      { status: 502 },
    );
  }

  if (error instanceof UpstreamError) {
    return Response.json(
      { error: 'upstream_unavailable', message: error.message },
      { status: error.status },
    );
  }

  console.error('[espn-proxy] unexpected error', error);
  return Response.json(
    { error: 'internal_error', message: 'Unexpected proxy failure' },
    { status: 500 },
  );
}

export function badRequest(message: string): Response {
  return Response.json({ error: 'bad_request', message }, { status: 400 });
}
