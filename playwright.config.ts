import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [
        ['html', { open: 'never' }],
        ['list'],
        ['github'],
        // Machine-readable results, so scripts/flaky-report.mjs can separate
        // retried-then-passed tests from genuine passes.
        ['json', { outputFile: 'playwright-results.json' }],
      ]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      // iPhone 13 metrics (390x844, touch, 3x DPR) on Chromium. The device
      // descriptor defaults to WebKit; this project exists to catch layout
      // breakage at a phone viewport, so one engine keeps CI lean. A real
      // WebKit project can be added when cross-browser becomes the goal.
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
  // Build and serve the real production bundle so local and CI behave identically.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
