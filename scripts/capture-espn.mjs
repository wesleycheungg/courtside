#!/usr/bin/env node
/**
 * Captures live ESPN responses into src/data/espn/fixtures/.
 *
 * Usage:
 *   npm run capture:espn                 # today's scoreboard, standings, teams
 *   npm run capture:espn -- 20261104     # a specific date's scoreboard
 *
 * Responses are written verbatim. If you trim events to keep the file small,
 * remove whole events — never edit one, or the fixture stops being evidence of
 * what ESPN actually sends.
 */

import { mkdir, writeFile } from 'node:fs/promises';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const V2 = 'https://site.api.espn.com/apis/v2/sports/basketball/nba';
const OUT = new URL('../src/data/espn/fixtures/', import.meta.url);

const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');
const date = process.argv[2] ?? today;

if (!/^\d{8}$/.test(date)) {
  console.error(`Expected a YYYYMMDD date, got "${date}"`);
  process.exit(1);
}

const isoDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
const capturedOn = new Date().toISOString().slice(0, 10);

async function capture(name, url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    console.error(`  ${name}: HTTP ${response.status}`);
    return null;
  }

  const body = await response.json();
  const file = new URL(`${name}.json`, OUT);
  await writeFile(file, `${JSON.stringify(body, null, 2)}\n`);

  const events = Array.isArray(body.events) ? body.events.length : null;
  const states = events
    ? ` [${[...new Set(body.events.map((e) => e.competitions[0].status.type.state))].join(', ')}]`
    : '';
  console.log(`  ${name}.json${events === null ? '' : ` — ${events} events${states}`}`);
  return body;
}

await mkdir(OUT, { recursive: true });
console.log(`Capturing ESPN responses for ${isoDate} (captured ${capturedOn}):`);

const scoreboard = await capture(
  `scoreboard-${isoDate}`,
  `${SITE}/scoreboard?dates=${date}`,
);
await capture(`standings-${capturedOn}`, `${V2}/standings`);
await capture(`teams-${capturedOn}`, `${SITE}/teams`);

const live = scoreboard?.events?.filter(
  (e) => e.competitions[0].status.type.state === 'in',
);
if (live?.length) {
  console.log(
    `\n${live.length} live game(s) captured — rename this to scoreboard-live-<date>.json`,
  );
} else {
  console.log('\nNo live games in this capture. The live fixture gap is still open.');
}

console.log('Remember to record the capture date in the fixtures README.');
