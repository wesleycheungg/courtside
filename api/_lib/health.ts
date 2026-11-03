/**
 * The health report, assembled.
 *
 * Three questions, answered from the three places that can actually answer
 * them: is ESPN answering (a real probe through the real proxy path), did the
 * last payload match the schema (the proxy's own validation log), and how
 * stale is the Postgres cache (`max(fetched_at)` per table).
 *
 * Every dependency is injectable so the route can be tested without a network
 * or a database — the same seam `fetchEspn` already uses.
 */

import {
  overallStatus,
  type DatabaseHealth,
  type HealthReport,
  type SchemaHealth,
  type UpstreamHealth,
} from '../../src/data/health';
import { espnScoreboardSchema } from '../../src/data/espn/espnSchemas';
import { cacheAge } from '../../db/cache';
import { databaseUrl, getSqlClient, type SqlClient } from '../../db/sql';
import { espnUrls, fetchEspn, lastValidation, SchemaError } from './espn';

export interface HealthDeps {
  now?: () => number;
  fetchImpl?: typeof fetch;
  getClient?: () => Promise<SqlClient | null>;
  /** Separate from `getClient` so "not configured" is distinguishable. */
  isDatabaseConfigured?: () => boolean;
}

/** YYYYMMDD in UTC. A probe only needs a valid slate, not the viewer's one. */
function probeDate(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10).replaceAll('-', '');
}

/**
 * Probes the scoreboard under the same cache key the real route uses.
 *
 * Deliberately: a health check during a busy minute is served from the twelve
 * second memory cache rather than adding upstream load, and a fresh check
 * warms the cache the next scoreboard request will read.
 */
async function checkUpstream(
  now: () => number,
  fetchImpl: typeof fetch | undefined,
): Promise<UpstreamHealth> {
  const date = probeDate(now());
  const probe = `scoreboard?dates=${date}`;
  const startedAt = now();

  try {
    const { cached } = await fetchEspn({
      key: `scoreboard:${date}`,
      url: espnUrls.scoreboard(date),
      schema: espnScoreboardSchema,
      now,
      ...(fetchImpl ? { fetchImpl } : {}),
    });

    return {
      status: 'ok',
      probe,
      latencyMs: now() - startedAt,
      servedFromCache: cached,
      detail: null,
    };
  } catch (error) {
    const latencyMs = now() - startedAt;

    if (error instanceof SchemaError) {
      return {
        status: 'schema_invalid',
        probe,
        latencyMs,
        servedFromCache: false,
        detail: error.issues.join('; ') || error.message,
      };
    }

    return {
      status: 'unreachable',
      probe,
      latencyMs,
      servedFromCache: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/** The proxy's last Zod result, whether it came from the probe or from traffic. */
function checkSchema(): SchemaHealth {
  const record = lastValidation();

  // Only reachable when nothing has validated on this instance yet — a cold
  // start whose probe could not reach ESPN.
  if (!record) {
    return { result: 'unknown', key: null, checkedAt: null, issues: [] };
  }

  return {
    result: record.ok ? 'pass' : 'fail',
    key: record.key,
    checkedAt: new Date(record.at).toISOString(),
    issues: record.issues,
  };
}

/** Postgres `timestamptz::text` is not ISO; the report promises ISO. */
function toIso(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

async function checkDatabase(
  now: () => number,
  getClient: () => Promise<SqlClient | null>,
  isConfigured: () => boolean,
): Promise<DatabaseHealth> {
  if (!isConfigured()) {
    return {
      configured: false,
      reachable: false,
      tables: [],
      detail: 'No DATABASE_URL set — the proxy serves scores and skips the cache write.',
    };
  }

  try {
    const client = await getClient();
    if (!client) {
      return {
        configured: true,
        reachable: false,
        tables: [],
        detail: 'DATABASE_URL is set but no client could be created.',
      };
    }

    const ages = await cacheAge(client);

    return {
      configured: true,
      reachable: true,
      tables: ages.map((age) => {
        const newestAt = toIso(age.newest);
        return {
          table: age.table,
          rows: age.rows,
          newestAt,
          ageSeconds: newestAt
            ? Math.max(0, Math.round((now() - Date.parse(newestAt)) / 1000))
            : null,
        };
      }),
      detail: null,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      tables: [],
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function buildHealthReport({
  now = Date.now,
  fetchImpl,
  getClient = getSqlClient,
  isDatabaseConfigured = () => databaseUrl() !== undefined,
}: HealthDeps = {}): Promise<HealthReport> {
  const upstream = await checkUpstream(now, fetchImpl);
  const database = await checkDatabase(now, getClient, isDatabaseConfigured);

  return {
    status: overallStatus(upstream, database),
    checkedAt: new Date(now()).toISOString(),
    upstream,
    // Read after the probe, so a passing probe is what the report shows.
    schema: checkSchema(),
    database,
  };
}
