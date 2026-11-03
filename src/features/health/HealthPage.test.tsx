import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthPage } from './HealthPage';
import { renderWithProviders } from '../../test/render';
import type { HealthReport } from '../../data/health';

const healthy: HealthReport = {
  status: 'ok',
  checkedAt: '2026-11-03T18:00:30.000Z',
  upstream: {
    status: 'ok',
    probe: 'scoreboard?dates=20261103',
    latencyMs: 88,
    servedFromCache: false,
    detail: null,
  },
  schema: {
    result: 'pass',
    key: 'scoreboard:20261103',
    checkedAt: '2026-11-03T18:00:30.000Z',
    issues: [],
  },
  database: {
    configured: true,
    reachable: true,
    tables: [
      {
        table: 'cached_games',
        rows: 11,
        newestAt: '2026-11-03T17:59:30.000Z',
        ageSeconds: 60,
      },
      { table: 'cached_standings', rows: 0, newestAt: null, ageSeconds: null },
    ],
    detail: null,
  },
};

/** The page fetches `/api/health` itself, so the stub is at the fetch seam. */
function stubFetch(body: unknown, status = 200) {
  const impl = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', impl);
  return impl;
}

/** The panel a fact belongs to, so two panels can share a term name. */
function panel(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HealthPage', () => {
  it('reports a healthy deployment', async () => {
    stubFetch(healthy);
    renderWithProviders(<HealthPage />);

    expect(await screen.findByText('OK')).toBeInTheDocument();
    expect(screen.getByText('Checked 2026-11-03 18:00:30Z')).toBeInTheDocument();

    const proxy = panel('ESPN proxy');
    expect(proxy).toHaveTextContent('Answering, and the payload matched the schema');
    expect(proxy).toHaveTextContent('scoreboard?dates=20261103');
    expect(proxy).toHaveTextContent('88 ms');
    expect(proxy).toHaveTextContent('a fresh upstream fetch');
  });

  it('shows the last schema validation result and the payload it ran against', async () => {
    stubFetch(healthy);
    renderWithProviders(<HealthPage />);

    const schema = within(
      await screen.findByRole('region', { name: 'Last schema validation' }),
    );
    expect(schema.getByText('Pass')).toBeInTheDocument();
    expect(schema.getByText('scoreboard:20261103')).toBeInTheDocument();
  });

  it('lists the offending field paths when the schema failed', async () => {
    stubFetch({
      ...healthy,
      status: 'degraded',
      upstream: {
        ...healthy.upstream,
        status: 'schema_invalid',
        detail: 'events.0.competitions.0.competitors.0.score: expected string',
      },
      schema: {
        result: 'fail',
        key: 'scoreboard:20261103',
        checkedAt: '2026-11-03T18:00:30.000Z',
        issues: ['events.0.competitions.0.competitors.0.score: expected string'],
      },
    } satisfies HealthReport);
    renderWithProviders(<HealthPage />);

    expect(await screen.findByText('Degraded')).toBeInTheDocument();
    expect(
      screen.getAllByText(/competitors\.0\.score: expected string/),
    ).not.toHaveLength(0);
  });

  it('reports cache row counts and staleness, and an empty table as such', async () => {
    stubFetch(healthy);
    renderWithProviders(<HealthPage />);

    const cache = within(await screen.findByRole('region', { name: 'Postgres cache' }));
    expect(cache.getByText('Connected')).toBeInTheDocument();
    expect(cache.getByText(/11 rows · written 1m ago/)).toBeInTheDocument();
    expect(cache.getByText(/0 rows · written no rows yet/)).toBeInTheDocument();
  });

  it('says an unconfigured cache is not configured, without calling it broken', async () => {
    stubFetch({
      ...healthy,
      database: {
        configured: false,
        reachable: false,
        tables: [],
        detail:
          'No DATABASE_URL set — the proxy serves scores and skips the cache write.',
      },
    } satisfies HealthReport);
    renderWithProviders(<HealthPage />);

    expect(await screen.findByText('OK')).toBeInTheDocument();
    const cache = within(screen.getByRole('region', { name: 'Postgres cache' }));
    expect(cache.getByText('Not configured')).toBeInTheDocument();
    expect(cache.getByText(/No DATABASE_URL set/)).toBeInTheDocument();
  });

  it('reports a down deploy from the 503 body rather than as a page error', async () => {
    stubFetch(
      {
        ...healthy,
        status: 'down',
        upstream: {
          ...healthy.upstream,
          status: 'unreachable',
          detail: 'ESPN request failed for scoreboard:20261103',
        },
        schema: { result: 'unknown', key: null, checkedAt: null, issues: [] },
      } satisfies HealthReport,
      503,
    );
    renderWithProviders(<HealthPage />);

    expect(await screen.findByText('Down')).toBeInTheDocument();
    expect(panel('ESPN proxy')).toHaveTextContent('Not answering');
    expect(panel('Last schema validation')).toHaveTextContent(
      'Not run on this instance yet',
    );
  });

  it('shows a skeleton while the report is in flight', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderWithProviders(<HealthPage />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading health report');
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('surfaces an unreachable endpoint as an alert', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Failed to fetch'))),
    );
    renderWithProviders(<HealthPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not reach the health endpoint');
    expect(alert).toHaveTextContent('Failed to fetch');
  });

  it('refetches on demand', async () => {
    const impl = stubFetch(healthy);
    renderWithProviders(<HealthPage />);
    await screen.findByText('OK');

    await userEvent.click(screen.getByRole('button', { name: /^Refresh/ }));

    expect(impl.mock.calls.length).toBeGreaterThan(1);
  });
});
