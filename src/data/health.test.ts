import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchHealth,
  overallStatus,
  type DatabaseHealth,
  type HealthReport,
  type UpstreamHealth,
} from './health';

const upstream: UpstreamHealth = {
  status: 'ok',
  probe: 'scoreboard?dates=20261103',
  latencyMs: 88,
  servedFromCache: false,
  detail: null,
};

const database: DatabaseHealth = {
  configured: true,
  reachable: true,
  tables: [
    {
      table: 'cached_games',
      rows: 11,
      newestAt: '2026-11-03T18:00:00.000Z',
      ageSeconds: 30,
    },
  ],
  detail: null,
};

const report: HealthReport = {
  status: 'ok',
  checkedAt: '2026-11-03T18:00:30.000Z',
  upstream,
  schema: {
    result: 'pass',
    key: 'scoreboard:20261103',
    checkedAt: '2026-11-03T18:00:30.000Z',
    issues: [],
  },
  database,
};

function respond(body: unknown, status = 200): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('overallStatus', () => {
  it('is ok when ESPN answers and the cache is connected', () => {
    expect(overallStatus(upstream, database)).toBe('ok');
  });

  it('is ok with no database at all — the cache is optional by design', () => {
    expect(
      overallStatus(upstream, {
        configured: false,
        reachable: false,
        tables: [],
        detail: 'No DATABASE_URL set',
      }),
    ).toBe('ok');
  });

  it('is degraded when a configured database is unreachable', () => {
    expect(overallStatus(upstream, { ...database, reachable: false, tables: [] })).toBe(
      'degraded',
    );
  });

  it('is degraded on schema drift — scores still serve, but from a schema we no longer trust', () => {
    expect(overallStatus({ ...upstream, status: 'schema_invalid' }, database)).toBe(
      'degraded',
    );
  });

  it('is down when ESPN cannot be reached, whatever the cache says', () => {
    expect(overallStatus({ ...upstream, status: 'unreachable' }, database)).toBe('down');
  });
});

describe('fetchHealth', () => {
  it('parses a report', async () => {
    vi.stubGlobal('fetch', respond(report));

    await expect(fetchHealth()).resolves.toEqual(report);
  });

  it('returns the report even on the 503 a down deploy answers with', async () => {
    const down: HealthReport = {
      ...report,
      status: 'down',
      upstream: { ...upstream, status: 'unreachable', detail: 'ECONNREFUSED' },
    };
    vi.stubGlobal('fetch', respond(down, 503));

    // The body is the whole point of the check; a generic error would throw it away.
    await expect(fetchHealth()).resolves.toEqual(down);
  });

  it('names the field that broke when the body is not a report', async () => {
    vi.stubGlobal('fetch', respond({ status: 'fine' }));

    await expect(fetchHealth()).rejects.toThrow(/status/);
  });

  it('throws on an error status with no usable body', async () => {
    vi.stubGlobal('fetch', respond('<html>502 Bad Gateway</html>', 502));

    await expect(fetchHealth()).rejects.toThrow(/502/);
  });
});
