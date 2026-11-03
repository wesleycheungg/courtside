#!/usr/bin/env node
/**
 * Lighthouse, mobile preset, as a build gate.
 *
 * Runs against the production bundle served by `vite preview` — the same
 * artifact Playwright tests and Vercel deploys — on the mobile emulation and
 * throttling Lighthouse defaults to, because that is where this app is used.
 *
 * Scores below the threshold exit non-zero, so a change that costs 15 points
 * of performance fails a run rather than being noticed a month later. Metrics
 * are printed alongside the scores, since "performance 94" says less than
 * "LCP 1.2s, CLS 0".
 *
 * Usage: node scripts/lighthouse.mjs [--port 4180] [--url /path ...]
 */

import { spawn } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

/** Every category Lighthouse scores has to clear this. SEO is reported only. */
const THRESHOLD = 90;
const GATED = ['performance', 'accessibility', 'best-practices'];

const DEFAULT_PATHS = [
  '/',
  // A data-heavy screen and a table-heavy one, so the budget covers more than
  // the lightest page in the app.
  '/game/mock-final-gsw-okc',
  '/leagues',
];

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const port = Number(arg('port', '4180'));
/** Odd, so the median is a run rather than an average of two. */
const runs = Number(arg('runs', '3'));
const paths = process.argv.includes('--url')
  ? process.argv.filter((_, i) => process.argv[i - 1] === '--url')
  : DEFAULT_PATHS;
const origin = `http://localhost:${port}`;

/** Starts `vite preview` and resolves once it answers. */
async function startServer() {
  const server = spawn(
    'npm',
    ['run', 'preview', '--', '--port', String(port), '--strictPort'],
    { stdio: 'ignore' },
  );

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin);
      if (response.ok) return server;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  server.kill();
  throw new Error(`preview server did not start on ${origin}`);
}

function score(result, category) {
  return Math.round((result.lhr.categories[category]?.score ?? 0) * 100);
}

function metric(result, id) {
  return result.lhr.audits[id]?.displayValue ?? '—';
}

/**
 * Lower-median, so the reported figure is one a run actually produced.
 *
 * A single Lighthouse run is a measurement of the machine as much as of the
 * page — a busy CI runner can cost 20 points of performance. Taking the
 * median of several is Lighthouse's own advice, and it is what stops this
 * gate from failing a PR because something else was compiling.
 */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

const server = await startServer();
// Playwright's Chromium, so this needs no system Chrome — in CI the browser is
// already installed and cached for the e2e job.
const chrome = await launch({
  chromePath: process.env.CHROME_PATH ?? chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});

const rows = [];
const failures = [];

try {
  for (const path of paths) {
    const results = [];
    for (let run = 0; run < runs; run += 1) {
      results.push(
        await lighthouse(
          `${origin}${path}`,
          { port: chrome.port, output: 'json', logLevel: 'error' },
          // No config override: the defaults are the mobile preset.
          undefined,
        ),
      );
    }

    const scores = Object.fromEntries(
      [...GATED, 'seo'].map((category) => [
        category,
        median(results.map((result) => score(result, category))),
      ]),
    );

    // Metrics come from the run whose performance score is the median, so the
    // numbers in a row describe one real load rather than a blend of several.
    const byPerformance = [...results].sort(
      (a, b) => score(a, 'performance') - score(b, 'performance'),
    );
    const representative = byPerformance[Math.floor((byPerformance.length - 1) / 2)];

    rows.push({
      path,
      ...scores,
      lcp: metric(representative, 'largest-contentful-paint'),
      cls: metric(representative, 'cumulative-layout-shift'),
      tbt: metric(representative, 'total-blocking-time'),
    });

    for (const category of GATED) {
      if (scores[category] < THRESHOLD) {
        failures.push(`${path} — ${category} ${scores[category]} < ${THRESHOLD}`);
      }
    }
  }
} finally {
  await chrome.kill();
  server.kill();
}

const header =
  '| Screen | Perf | A11y | Best practices | SEO | LCP | CLS | TBT |\n' +
  '| ------ | ---- | ---- | -------------- | --- | --- | --- | --- |';

const table = rows
  .map(
    (row) =>
      `| \`${row.path}\` | ${row.performance} | ${row.accessibility} | ` +
      `${row['best-practices']} | ${row.seo} | ${row.lcp} | ${row.cls} | ${row.tbt} |`,
  )
  .join('\n');

const summary = [
  `### Lighthouse (mobile) — threshold ${THRESHOLD}, median of ${runs} runs`,
  '',
  header,
  table,
  '',
  failures.length === 0
    ? '✅ Every gated category clears the threshold.'
    : `❌ ${failures.length} below threshold:\n${failures.map((f) => `- ${f}`).join('\n')}`,
].join('\n');

console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

process.exit(failures.length === 0 ? 0 : 1);
