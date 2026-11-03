import { beforeEach, describe, expect, it, vi } from 'vitest';
import { healthReportSchema } from '../../src/data/health';
import type { SqlClient } from '../../db/sql';
import { clearCache, clearValidationLog } from './espn';
import { buildHealthReport } from './health';

/** Enough of a scoreboard to satisfy the real schema; no events needed. */
const EMPTY_SLATE = { events: [] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** 2026-11-03T18:00:00Z, so the probe date is predictable. */
const NOW = Date.UTC(2026, 10, 3, 18, 0, 0);
const now = () => NOW;

const noDatabase = {
  getClient: async () => null,
  isDatabaseConfigured: () => false,
};

/** A client that answers `cacheAge`'s count/max query and nothing else. */
function stubClient(newest: string | null, rows = 2): SqlClient {
  return {
    query: async <Row>() => [{ rows: String(rows), newest }] as Row[],
  };
}

beforeEach(() => {
  clearCache();
  clearValidationLog();
});

describe('buildHealthReport upstream probe', () => {
  it('probes the scoreboard and reports ok with a latency', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(EMPTY_SLATE));

    const report = await buildHealthReport({ now, fetchImpl, ...noDatabase });

    expect(report.status).toBe('ok');
    expect(report.upstream.status).toBe('ok');
    expect(report.upstream.probe).toBe('scoreboard?dates=20261103');
    expect(report.upstream.latencyMs).toBeGreaterThanOrEqual(0);
    expect(report.upstream.detail).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('is served from the proxy cache on a second check', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(EMPTY_SLATE));
    const deps = { now, fetchImpl, ...noDatabase };

    await buildHealthReport(deps);
    const second = await buildHealthReport(deps);

    // The probe shares the real route's cache key, so checking health during a
    // busy minute must not add upstream load.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(second.upstream.servedFromCache).toBe(true);
  });

  it('reports down when ESPN cannot be reached', async () => {
    const fetchImpl = async () => {
      throw new Error('ECONNREFUSED');
    };

    const report = await buildHealthReport({ now, fetchImpl, ...noDatabase });

    expect(report.status).toBe('down');
    expect(report.upstream.status).toBe('unreachable');
    expect(report.upstream.detail).toContain('ECONNREFUSED');
  });

  it('reports down when ESPN answers with an error status', async () => {
    const fetchImpl = async () => jsonResponse({}, 503);

    const report = await buildHealthReport({ now, fetchImpl, ...noDatabase });

    expect(report.status).toBe('down');
    expect(report.upstream.status).toBe('unreachable');
    expect(report.upstream.detail).toContain('503');
  });
});

describe('buildHealthReport schema validation', () => {
  it('reports a pass with the key that was validated', async () => {
    const fetchImpl = async () => jsonResponse(EMPTY_SLATE);

    const report = await buildHealthReport({ now, fetchImpl, ...noDatabase });

    expect(report.schema).toEqual({
      result: 'pass',
      key: 'scoreboard:20261103',
      checkedAt: new Date(NOW).toISOString(),
      issues: [],
    });
  });

  it('degrades with the offending field path when ESPN changes shape', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // `events` is an array of objects in the schema; a string is drift.
    const fetchImpl = async () => jsonResponse({ events: 'nope' });

    const report = await buildHealthReport({ now, fetchImpl, ...noDatabase });

    expect(report.status).toBe('degraded');
    expect(report.upstream.status).toBe('schema_invalid');
    expect(report.schema.result).toBe('fail');
    expect(report.schema.issues.join()).toMatch(/events/);
    spy.mockRestore();
  });

  it('says unknown when nothing has validated on this instance yet', async () => {
    const fetchImpl = async () => {
      throw new Error('offline');
    };

    const report = await buildHealthReport({ now, fetchImpl, ...noDatabase });

    expect(report.schema).toEqual({
      result: 'unknown',
      key: null,
      checkedAt: null,
      issues: [],
    });
  });
});

describe('buildHealthReport database', () => {
  const fetchImpl = async () => jsonResponse(EMPTY_SLATE);

  it('treats an unconfigured database as ok, not a failure', async () => {
    const report = await buildHealthReport({ now, fetchImpl, ...noDatabase });

    expect(report.status).toBe('ok');
    expect(report.database.configured).toBe(false);
    expect(report.database.tables).toEqual([]);
    expect(report.database.detail).toContain('DATABASE_URL');
  });

  it('reports row counts and the age of the newest row', async () => {
    const fetchedAt = new Date(NOW - 90_000).toISOString();

    const report = await buildHealthReport({
      now,
      fetchImpl,
      getClient: async () => stubClient(fetchedAt),
      isDatabaseConfigured: () => true,
    });

    expect(report.status).toBe('ok');
    expect(report.database.reachable).toBe(true);
    expect(report.database.tables).toEqual([
      { table: 'cached_games', rows: 2, newestAt: fetchedAt, ageSeconds: 90 },
      { table: 'cached_standings', rows: 2, newestAt: fetchedAt, ageSeconds: 90 },
    ]);
  });

  it("normalizes Postgres's timestamp format to ISO", async () => {
    const report = await buildHealthReport({
      now,
      fetchImpl,
      // What `max(fetched_at)::text` actually returns: a space, not a T.
      getClient: async () => stubClient('2026-11-03 17:59:00+00'),
      isDatabaseConfigured: () => true,
    });

    expect(report.database.tables[0]?.newestAt).toBe('2026-11-03T17:59:00.000Z');
    expect(report.database.tables[0]?.ageSeconds).toBe(60);
  });

  it('reports an empty table as no age rather than an age of zero', async () => {
    const report = await buildHealthReport({
      now,
      fetchImpl,
      getClient: async () => stubClient(null, 0),
      isDatabaseConfigured: () => true,
    });

    expect(report.database.tables[0]).toEqual({
      table: 'cached_games',
      rows: 0,
      newestAt: null,
      ageSeconds: null,
    });
  });

  it('degrades when a configured database cannot be reached', async () => {
    const report = await buildHealthReport({
      now,
      fetchImpl,
      getClient: async () => {
        throw new Error('connection terminated');
      },
      isDatabaseConfigured: () => true,
    });

    expect(report.status).toBe('degraded');
    expect(report.database.reachable).toBe(false);
    expect(report.database.detail).toContain('connection terminated');
  });
});

describe('the report itself', () => {
  it('matches the schema the page parses it with', async () => {
    const report = await buildHealthReport({
      now,
      fetchImpl: async () => jsonResponse(EMPTY_SLATE),
      getClient: async () => stubClient(new Date(NOW).toISOString()),
      isDatabaseConfigured: () => true,
    });

    // Both sides of the wire share one schema; this is what proves it.
    expect(healthReportSchema.safeParse(report).success).toBe(true);
  });
});
