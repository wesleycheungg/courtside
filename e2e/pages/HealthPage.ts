import type { Locator, Page } from '@playwright/test';

/**
 * The health screen.
 *
 * `/api/health` is a serverless function, and e2e runs against `vite preview`,
 * which serves static files only — so every test here stubs the endpoint.
 * That is the right seam anyway: these tests are about how the page renders a
 * report, and the report itself is covered against the real proxy core in
 * `api/_lib/health.test.ts`.
 */
export class HealthPage {
  readonly status: Locator;
  readonly checkedAt: Locator;
  readonly refresh: Locator;
  readonly failure: Locator;

  constructor(private readonly page: Page) {
    this.status = page.locator('.health__pill');
    this.checkedAt = page.getByText(/^Checked /);
    this.refresh = page.getByRole('button', { name: /^Refresh/ });
    this.failure = page.getByRole('alert');
  }

  panel(name: string): Locator {
    return this.page.getByRole('region', { name });
  }

  /** Serves `report` for every health request; returns the call count so far. */
  async stubHealth(report: unknown, httpStatus = 200): Promise<() => number> {
    let calls = 0;
    await this.page.route('**/api/health', async (route) => {
      calls += 1;
      await route.fulfill({
        status: httpStatus,
        contentType: 'application/json',
        body: JSON.stringify(report),
      });
    });
    return () => calls;
  }

  /**
   * Holds the request open until the returned function is called.
   *
   * A gate rather than a delay: the test controls exactly when the report
   * lands, so asserting on the loading state needs no timer and cannot flake.
   */
  async stubHealthWhenReleased(report: unknown): Promise<() => void> {
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    await this.page.route('**/api/health', async (route) => {
      await gate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(report),
      });
    });

    return () => release();
  }

  /** Fails the request outright, as a deploy with no proxy would. */
  async breakHealth(): Promise<void> {
    await this.page.route('**/api/health', (route) => route.abort('failed'));
  }

  async goto(): Promise<void> {
    await this.page.goto('/health');
  }
}
