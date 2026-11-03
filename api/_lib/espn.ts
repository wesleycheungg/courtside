/**
 * Shared proxy core: fetch from ESPN, validate, cache.
 *
 * The browser never talks to ESPN directly. Everything goes through here, so
 * there is exactly one place that knows ESPN's hostnames, one cache, and one
 * place where a schema failure gets logged with the field that broke.
 */

import type { z } from 'zod';

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const ESPN_V2 = 'https://site.api.espn.com/apis/v2/sports/basketball/nba';
// Athlete data lives on a different host to the rest.
const ESPN_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';

/** Scores go stale fast; this is the window the brief asked for. */
export const CACHE_TTL_MS = 12_000;
/** Team metadata changes about once a year. */
export const TEAMS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  payload: unknown;
}

// Module scope persists across invocations on a warm serverless instance. A
// cold start just means one extra upstream call, which is acceptable.
const cache = new Map<string, CacheEntry>();

export function clearCache(): void {
  cache.clear();
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export class SchemaError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(message);
    this.name = 'SchemaError';
  }
}

export interface FetchOptions<T> {
  /** Cache key; also the label used in logs. */
  key: string;
  url: string;
  schema: z.ZodType<T>;
  ttlMs?: number;
  now?: () => number;
  fetchImpl?: typeof fetch;
}

/**
 * Fetches, validates, and caches. Only validated payloads are cached, so a
 * malformed response is never served twice.
 */
export async function fetchEspn<T>({
  key,
  url,
  schema,
  ttlMs = CACHE_TTL_MS,
  now = Date.now,
  fetchImpl = fetch,
}: FetchOptions<T>): Promise<{ data: T; cached: boolean }> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now()) {
    return { data: hit.payload as T, cached: true };
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (cause) {
    throw new UpstreamError(`ESPN request failed for ${key}: ${String(cause)}`, 502);
  }

  if (!response.ok) {
    throw new UpstreamError(`ESPN returned ${response.status} for ${key}`, 502);
  }

  const body: unknown = await response.json();
  const result = schema.safeParse(body);

  if (!result.success) {
    // The whole point of validating here: name the field that broke, so a
    // schema drift is a readable log line rather than a mystery.
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    console.error(`[espn-proxy] schema validation failed for ${key}`, { issues });
    throw new SchemaError(`Response from ESPN did not match the expected shape`, issues);
  }

  cache.set(key, { expiresAt: now() + ttlMs, payload: result.data });
  return { data: result.data, cached: false };
}

export const espnUrls = {
  scoreboard: (date: string) => `${ESPN_SITE}/scoreboard?dates=${date}`,
  summary: (eventId: string) => `${ESPN_SITE}/summary?event=${eventId}`,
  standings: () => `${ESPN_V2}/standings`,
  teams: () => `${ESPN_SITE}/teams`,
  athlete: (id: string) => `${ESPN_WEB}/athletes/${id}`,
  athleteGameLog: (id: string) => `${ESPN_WEB}/athletes/${id}/gamelog`,
};

/** YYYYMMDD, which is what the scoreboard endpoint expects. */
export function isEspnDate(value: string): boolean {
  return /^\d{8}$/.test(value);
}
