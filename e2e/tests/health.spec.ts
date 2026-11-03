import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { HealthPage } from '../pages/HealthPage';

const HEALTHY = {
  status: 'ok',
  checkedAt: '2026-11-03T18:00:30.000Z',
  upstream: {
    status: 'ok',
    probe: 'scoreboard?dates=20261103',
    latencyMs: 91,
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
      {
        table: 'cached_standings',
        rows: 30,
        newestAt: '2026-11-03T17:55:30.000Z',
        ageSeconds: 300,
      },
    ],
    detail: null,
  },
};

const DRIFTED = {
  ...HEALTHY,
  status: 'degraded',
  upstream: {
    ...HEALTHY.upstream,
    status: 'schema_invalid',
    detail: 'events.0.competitions.0.competitors.0.score: expected string',
  },
  schema: {
    result: 'fail',
    key: 'scoreboard:20261103',
    checkedAt: '2026-11-03T18:00:30.000Z',
    issues: ['events.0.competitions.0.competitors.0.score: expected string'],
  },
};

test.describe('health page', () => {
  test('reports proxy status, cache age and the last schema check @smoke', async ({
    page,
  }) => {
    const health = new HealthPage(page);
    await health.stubHealth(HEALTHY);
    await health.goto();

    await expect(health.status).toHaveText('OK');
    await expect(health.checkedAt).toHaveText('Checked 2026-11-03 18:00:30Z');

    await expect(health.panel('ESPN proxy')).toContainText('91 ms');
    await expect(health.panel('Last schema validation')).toContainText('Pass');
    await expect(health.panel('Postgres cache')).toContainText(
      '11 rows · written 1m ago',
    );
  });

  test('shows schema drift as degraded, with the field path @regression', async ({
    page,
  }) => {
    const health = new HealthPage(page);
    await health.stubHealth(DRIFTED);
    await health.goto();

    await expect(health.status).toHaveText('Degraded');
    await expect(health.panel('Last schema validation')).toContainText(
      'competitors.0.score: expected string',
    );
  });

  test('renders the report a down deploy answers 503 with @regression', async ({
    page,
  }) => {
    const health = new HealthPage(page);
    await health.stubHealth(
      {
        ...HEALTHY,
        status: 'down',
        upstream: {
          ...HEALTHY.upstream,
          status: 'unreachable',
          detail: 'ESPN request failed for scoreboard:20261103',
        },
        schema: { result: 'unknown', key: null, checkedAt: null, issues: [] },
      },
      503,
    );
    await health.goto();

    await expect(health.status).toHaveText('Down');
    await expect(health.panel('ESPN proxy')).toContainText('Not answering');
  });

  test('refetches when asked @regression', async ({ page }) => {
    const health = new HealthPage(page);
    const calls = await health.stubHealth(HEALTHY);
    await health.goto();
    await expect(health.status).toHaveText('OK');

    const before = calls();
    await health.refresh.click();

    await expect.poll(() => calls()).toBeGreaterThan(before);
  });

  test('fills a skeleton rather than appearing out of nothing @regression', async ({
    page,
  }) => {
    const health = new HealthPage(page);
    const release = await health.stubHealthWhenReleased(HEALTHY);
    await health.goto();

    const loading = page.getByRole('status');
    await expect(loading).toContainText('Loading health report');
    await expect(loading).toHaveAttribute('aria-busy', 'true');
    // The skeleton stands in the content's place, so the panels are already
    // the height they will be.
    expect(await page.locator('.panel').count()).toBe(3);

    release();

    await expect(health.status).toHaveText('OK');
    await expect(page.locator('.skeleton')).toHaveCount(0);
  });

  // The a11y spec walks paths without stubs, so this screen is scanned here,
  // where its report can be pinned.
  test('has no serious or critical a11y violations @regression', async ({ page }) => {
    const health = new HealthPage(page);
    await health.stubHealth(DRIFTED);
    await health.goto();
    await expect(health.status).toHaveText('Degraded');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
  });

  test('says so when the endpoint cannot be reached @regression', async ({ page }) => {
    const health = new HealthPage(page);
    await health.breakHealth();
    await health.goto();

    await expect(health.failure).toContainText('Could not reach the health endpoint');
  });
});
