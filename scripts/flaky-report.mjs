#!/usr/bin/env node
/**
 * Reports flaky tests from Playwright's JSON results.
 *
 * A test that failed and then passed on retry is not a pass — it is a signal
 * that something is non-deterministic. Playwright's own summary blends these
 * into the pass count, so this pulls them back out and writes them to the CI
 * step summary where they cannot be missed.
 *
 * Usage: node scripts/flaky-report.mjs [results.json]
 */

import { readFile, appendFile } from 'node:fs/promises';

const path = process.argv[2] ?? 'playwright-results.json';

let report;
try {
  report = JSON.parse(await readFile(path, 'utf8'));
} catch {
  console.log(`No Playwright results at ${path}; nothing to report.`);
  process.exit(0);
}

/** Walks the suite tree, which nests arbitrarily deep. */
function* allTests(suites = []) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        yield { title: spec.title, file: suite.file ?? '', test };
      }
    }
    yield* allTests(suite.suites);
  }
}

const flaky = [];
const failed = [];

for (const { title, file, test } of allTests(report.suites)) {
  const results = test.results ?? [];
  const attempts = results.length;
  const passed = results.some((r) => r.status === 'passed');
  const failedAny = results.some((r) => r.status === 'failed' || r.status === 'timedOut');

  if (passed && failedAny) {
    flaky.push({ title, file, project: test.projectName, attempts });
  } else if (failedAny && !passed) {
    failed.push({ title, file, project: test.projectName });
  }
}

const lines = [];

if (flaky.length > 0) {
  lines.push(`### ⚠️ ${flaky.length} flaky test${flaky.length === 1 ? '' : 's'}`);
  lines.push('');
  lines.push(
    'Passed only after a retry. Fix or quarantine with a note in `docs/NOTES.md`.',
  );
  lines.push('');
  for (const t of flaky) {
    lines.push(`- \`${t.project}\` ${t.title} — ${t.attempts} attempts (${t.file})`);
  }
} else {
  lines.push('### ✅ No flaky tests');
  lines.push('');
  lines.push('Every test reached its result on the first attempt.');
}

if (failed.length > 0) {
  lines.push('');
  lines.push(`### ❌ ${failed.length} failed`);
  lines.push('');
  for (const t of failed) lines.push(`- \`${t.project}\` ${t.title} (${t.file})`);
}

const summary = lines.join('\n');
console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

// Flakiness is reported, not fatal — a genuine failure already failed the run.
process.exit(0);
