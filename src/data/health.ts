/**
 * The health report: its shape, and the client that fetches it.
 *
 * Lives in `src/data/` because it is an external response like any other — the
 * page parses it with Zod at the boundary rather than trusting the deploy to
 * be running the same build as the browser. The proxy imports the same schema
 * to type what it returns, so the two sides cannot drift apart silently.
 */

import { z } from 'zod';
import { parseOrThrow } from './schemas';

/** Worst finding wins: see `overallStatus`. */
export const healthStatusSchema = z.enum(['ok', 'degraded', 'down']);

export const upstreamHealthSchema = z.object({
  /** `ok` means ESPN answered *and* the payload matched the schema. */
  status: z.enum(['ok', 'schema_invalid', 'unreachable']),
  /** Which endpoint was probed, so a reader knows what was proven. */
  probe: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  /** True when the proxy answered from its own 12s memory cache. */
  servedFromCache: z.boolean(),
  detail: z.string().nullable(),
});

export const schemaHealthSchema = z.object({
  result: z.enum(['pass', 'fail', 'unknown']),
  /** The proxy cache key whose payload was last validated. */
  key: z.string().nullable(),
  checkedAt: z.iso.datetime().nullable(),
  /** Field paths that broke, straight from Zod. Empty on a pass. */
  issues: z.array(z.string()),
});

export const cachedTableHealthSchema = z.object({
  table: z.string().min(1),
  rows: z.number().int().nonnegative(),
  newestAt: z.iso.datetime().nullable(),
  /** Age of the newest row at check time; null when the table is empty. */
  ageSeconds: z.number().nonnegative().nullable(),
});

export const databaseHealthSchema = z.object({
  /** False when no `DATABASE_URL` is set, which is a supported deployment. */
  configured: z.boolean(),
  reachable: z.boolean(),
  tables: z.array(cachedTableHealthSchema),
  detail: z.string().nullable(),
});

export const healthReportSchema = z.object({
  status: healthStatusSchema,
  checkedAt: z.iso.datetime(),
  upstream: upstreamHealthSchema,
  schema: schemaHealthSchema,
  database: databaseHealthSchema,
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type UpstreamHealth = z.infer<typeof upstreamHealthSchema>;
export type SchemaHealth = z.infer<typeof schemaHealthSchema>;
export type CachedTableHealth = z.infer<typeof cachedTableHealthSchema>;
export type DatabaseHealth = z.infer<typeof databaseHealthSchema>;
export type HealthReport = z.infer<typeof healthReportSchema>;

/**
 * One rule, in one place, for the headline status.
 *
 * A missing database is not a problem — the cache is optional by design — but
 * one that is configured and unreachable is, because then nothing is being
 * recorded and the SQL assertions are running against stale tables.
 */
export function overallStatus(
  upstream: UpstreamHealth,
  database: DatabaseHealth,
): HealthStatus {
  if (upstream.status === 'unreachable') return 'down';
  if (upstream.status === 'schema_invalid') return 'degraded';
  if (database.configured && !database.reachable) return 'degraded';
  return 'ok';
}

/**
 * Fetches `/api/health`.
 *
 * Deliberately not on `DataProvider`: this reports on the proxy itself, so
 * routing it through the provider seam would mean the mock provider inventing
 * a health report, and the page would stop being a diagnostic. A deploy
 * without the proxy — a bare `vite preview`, say — surfaces as the page's
 * error state, which is the honest answer.
 */
export async function fetchHealth(url = '/api/health'): Promise<HealthReport> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  const body: unknown = await response.json().catch(() => null);

  // A `down` report is served with 503 so an uptime monitor sees a failure,
  // but the body is still a full report and the page should render it — a page
  // that says "ESPN is unreachable" is more use than a generic error.
  const parsed = healthReportSchema.safeParse(body);
  if (parsed.success) return parsed.data;

  if (!response.ok) {
    throw new Error(`Health check returned ${response.status}`);
  }

  // 200 with a body that is not a report: name the field that broke.
  return parseOrThrow(healthReportSchema, body, url);
}
