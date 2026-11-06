/**
 * Live half of the contract. Calls ESPN for real.
 *
 * Runs on a schedule, never on a PR — upstream drift is not an unrelated
 * author's problem, and a flaky third party must not be able to red a merge.
 * `npm run test:contract` runs it on demand.
 *
 * Three things are asserted, in order of how badly a failure hurts:
 *
 *  1. The response still parses against the schema the proxy validates with.
 *     A failure names the field path, which is the whole reason for validating
 *     at the boundary.
 *  2. The quirks the normalizer is built on still hold — a string `score`,
 *     home-first `competitors`, a `#`-less colour. Each of these is a silently
 *     wrong score if it changes, not a parse error.
 *  3. The observed shape still matches the committed snapshot. A changed JSON
 *     type fails; fields appearing or vanishing are reported, because the
 *     schemas are deliberately permissive about keys we do not read.
 */

import { appendFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { espnUrls } from '../api/_lib/espn';
import { contractSchemas, type ContractSchemaName } from './registry';
import { readSnapshot } from './snapshots';
import { diffShapes, formatDiff, isEmptyDiff, shapeOfPayload } from './schemaShape';

/** ESPN is slower than a local fixture, and the suite is not on the PR path. */
const TIMEOUT = 30_000;

const notes: string[] = [];

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Parses with the production schema and, on failure, fails with every
 * offending field path rather than Zod's default blob.
 */
function expectParses<T extends ContractSchemaName>(name: T, payload: unknown): void {
  const result = contractSchemas[name].safeParse(payload);
  if (result.success) return;

  const paths = result.error.issues.map(
    (issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  expect.fail(
    `ESPN ${name} no longer matches our schema. Offending field paths:\n${paths.join('\n')}`,
  );
}

/** Compares the live shape to the committed snapshot and records the drift. */
async function expectNoTypeDrift(
  name: ContractSchemaName,
  payload: unknown,
): Promise<void> {
  const snapshot = await readSnapshot(name);
  const diff = diffShapes(snapshot.fields, shapeOfPayload(payload));

  if (!isEmptyDiff(diff)) {
    notes.push(
      `### ${name} (snapshot ${snapshot.fingerprint})\n\n\`\`\`\n${formatDiff(diff)}\n\`\`\``,
    );
  }

  expect(
    diff.changed,
    `ESPN changed the JSON type of a field ${name} depends on:\n${formatDiff(diff)}`,
  ).toEqual([]);
}

/* ── discovery ────────────────────────────────────────────────────────────── */

interface Slate {
  date: string;
  payload: unknown;
}

function espnDate(offsetDays: number): string {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() - offsetDays);
  return day.toISOString().slice(0, 10).replaceAll('-', '');
}

/**
 * Walks back from today for a date that actually has games. The NBA has dark
 * days and an offseason, and "no games today" must not read as a contract
 * failure — but an empty response proves nothing either.
 */
async function findSlate(): Promise<Slate> {
  for (let back = 0; back < 10; back += 1) {
    const date = espnDate(back);
    const payload = await fetchJson(espnUrls.scoreboard(date));
    const events = (payload as { events?: unknown[] }).events;
    if (Array.isArray(events) && events.length > 0) return { date, payload };
  }
  throw new Error('No ESPN scoreboard in the last 10 days carried any events');
}

let slate: Slate;

beforeAll(async () => {
  slate = await findSlate();
}, TIMEOUT);

afterAll(() => {
  if (notes.length === 0) return;
  const report = `## ESPN schema drift\n\n${notes.join('\n\n')}\n`;
  console.warn(report);

  // Surfaced in the scheduled run's job summary, so drift is visible without
  // opening the log.
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) appendFileSync(summaryFile, report);
});

/* ── scoreboard ───────────────────────────────────────────────────────────── */

describe('ESPN scoreboard', () => {
  it(
    'still matches the schema the proxy validates with',
    () => {
      expectParses('scoreboard', slate.payload);
    },
    TIMEOUT,
  );

  it(
    'has not changed the type of a field we read',
    async () => {
      await expectNoTypeDrift('scoreboard', slate.payload);
    },
    TIMEOUT,
  );

  it(
    'still sends score as a string, not a number',
    () => {
      const parsed = contractSchemas.scoreboard.parse(slate.payload);
      const scores = parsed.events
        .flatMap((event) => event.competitions[0]?.competitors ?? [])
        .map((competitor) => competitor.score)
        .filter((score): score is string => score !== undefined);

      expect(scores.length).toBeGreaterThan(0);
      expect(scores.every((score) => typeof score === 'string')).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'still orders competitors home first',
    () => {
      const parsed = contractSchemas.scoreboard.parse(slate.payload);
      const firstSides = parsed.events
        .map((event) => event.competitions[0]?.competitors[0]?.homeAway)
        .filter((side): side is 'home' | 'away' => side !== undefined);

      // The normalizer looks the side up rather than indexing, so a change
      // here is not a bug — but it is worth knowing the day it happens.
      expect(firstSides.length).toBeGreaterThan(0);
      expect(new Set(firstSides)).toEqual(new Set(['home']));
    },
    TIMEOUT,
  );

  it(
    'still sends team colours without a leading hash',
    () => {
      const parsed = contractSchemas.scoreboard.parse(slate.payload);
      const colors = parsed.events
        .flatMap((event) => event.competitions[0]?.competitors ?? [])
        .map((competitor) => competitor.team.color)
        .filter((color): color is string => color !== undefined);

      expect(colors.length).toBeGreaterThan(0);
      expect(colors.every((color) => /^[0-9a-fA-F]{6}$/.test(color))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'omits linescores before tip-off rather than sending an empty array',
    () => {
      const parsed = contractSchemas.scoreboard.parse(slate.payload);
      const scheduled = parsed.events.filter(
        (event) => event.competitions[0]?.status.type.state === 'pre',
      );

      if (scheduled.length === 0) {
        notes.push(
          '_No scheduled game in the slate; the absent-linescores quirk was not exercised._',
        );
        return;
      }

      for (const event of scheduled) {
        for (const competitor of event.competitions[0]?.competitors ?? []) {
          expect(competitor.linescores ?? []).toHaveLength(0);
        }
      }
    },
    TIMEOUT,
  );

  it(
    'keeps a finished game score equal to the sum of its line scores',
    () => {
      const parsed = contractSchemas.scoreboard.parse(slate.payload);
      const finals = parsed.events.filter(
        (event) => event.competitions[0]?.status.type.completed === true,
      );

      if (finals.length === 0) {
        notes.push(
          '_No completed game in the slate; the score-vs-quarters check was not exercised._',
        );
        return;
      }

      for (const event of finals) {
        for (const competitor of event.competitions[0]?.competitors ?? []) {
          const lines = competitor.linescores ?? [];
          expect(
            lines.length,
            `event ${event.id} has no line scores`,
          ).toBeGreaterThanOrEqual(4);
          const sum = lines.reduce((total, line) => total + (line.value ?? 0), 0);
          expect(sum, `event ${event.id}, team ${competitor.team.abbreviation}`).toBe(
            Number(competitor.score),
          );
        }
      }
    },
    TIMEOUT,
  );
});

/* ── summary ──────────────────────────────────────────────────────────────── */

describe('ESPN summary', () => {
  let summary: unknown;
  let eventId: string;

  beforeAll(async () => {
    const parsed = contractSchemas.scoreboard.parse(slate.payload);
    const completed = parsed.events.find(
      (event) => event.competitions[0]?.status.type.completed === true,
    );
    const event = completed ?? parsed.events[0];
    if (!event) throw new Error('No event to fetch a summary for');
    eventId = event.id;
    summary = await fetchJson(espnUrls.summary(eventId));
  }, TIMEOUT);

  it(
    'still matches the schema the proxy validates with',
    () => {
      expectParses('summary', summary);
    },
    TIMEOUT,
  );

  it(
    'has not changed the type of a field we read',
    async () => {
      await expectNoTypeDrift('summary', summary);
    },
    TIMEOUT,
  );

  it(
    'still sends the record key in singular form, or the plural one we also accept',
    () => {
      const parsed = contractSchemas.summary.parse(summary);
      const competitors = parsed.header.competitions[0]?.competitors ?? [];

      expect(competitors.length).toBeGreaterThan(0);
      for (const competitor of competitors) {
        expect(
          competitor.record ?? competitor.records,
          `summary ${eventId} carries neither record nor records`,
        ).toBeDefined();
      }
    },
    TIMEOUT,
  );

  it(
    'still label-indexes the box score rather than using fixed columns',
    () => {
      const parsed = contractSchemas.summary.parse(summary);
      const groups = parsed.boxscore?.players ?? [];

      if (groups.length === 0) {
        notes.push(
          `_Summary ${eventId} carried no player box score; label indexing was not exercised._`,
        );
        return;
      }

      for (const group of groups) {
        for (const block of group.statistics) {
          expect(block.labels.length).toBeGreaterThan(0);
          for (const athlete of block.athletes) {
            // Every stat line has to line up with the labels, or the box
            // score reads the wrong column.
            if (athlete.didNotPlay === true) continue;
            expect(athlete.stats.length, `athlete ${athlete.athlete.id}`).toBe(
              block.labels.length,
            );
          }
        }
      }
    },
    TIMEOUT,
  );

  it(
    'still carries a jersey number on each box score athlete',
    () => {
      const parsed = contractSchemas.summary.parse(summary);
      const athletes = (parsed.boxscore?.players ?? []).flatMap((group) =>
        group.statistics.flatMap((block) => block.athletes),
      );

      if (athletes.length === 0) {
        notes.push(
          `_Summary ${eventId} carried no player box score; the jersey column was not exercised._`,
        );
        return;
      }

      // The schema keeps `jersey` nullish, so a disappearance would empty the
      // box score's first column in silence rather than failing to parse.
      const numbered = athletes.filter(
        (entry) => (entry.athlete.jersey ?? '').length > 0,
      );
      expect(numbered.length).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  /** The eight the pre-game Summary tab compares, by ESPN's own names. */
  const SEASON_AVERAGE_NAMES = [
    'avgPoints',
    'avgPointsAgainst',
    'fieldGoalPct',
    'threePointFieldGoalPct',
    'avgRebounds',
    'avgAssists',
    'avgSteals',
    'avgTotalTurnovers',
  ];

  it(
    'still carries the season averages the pre-game panel reads',
    async () => {
      const slateEvents = contractSchemas.scoreboard.parse(slate.payload).events;
      const scheduled = slateEvents.find(
        (event) => event.competitions[0]?.status.type.state === 'pre',
      );
      if (!scheduled) {
        notes.push(
          '_No scheduled game on the sampled slate; the pre-game season averages were not exercised._',
        );
        return;
      }

      const pregame = contractSchemas.summary.parse(
        await fetchJson(espnUrls.summary(scheduled.id)),
      );

      // Before tip-off ESPN reuses `boxscore.teams[].statistics` for season
      // averages instead of played stats. A rename here costs the panel a row
      // in silence — the normalizer skips what it cannot find — so the names
      // are asserted rather than the shape.
      const teams = pregame.boxscore?.teams ?? [];
      expect(teams.length).toBe(2);

      for (const team of teams) {
        const names = new Set(team.statistics.map((stat) => stat.name));
        for (const name of SEASON_AVERAGE_NAMES) {
          expect(names, `${team.team.abbreviation} is missing ${name}`).toContain(name);
        }
      }
    },
    TIMEOUT,
  );
});

/* ── standings and teams ──────────────────────────────────────────────────── */

describe('ESPN standings', () => {
  let standings: unknown;

  beforeAll(async () => {
    standings = await fetchJson(espnUrls.standings());
  }, TIMEOUT);

  it(
    'still matches the schema the proxy validates with',
    () => {
      expectParses('standings', standings);
    },
    TIMEOUT,
  );

  it(
    'has not changed the type of a field we read',
    async () => {
      await expectNoTypeDrift('standings', standings);
    },
    TIMEOUT,
  );

  it(
    'still keys stats by name in a flat array',
    () => {
      const parsed = contractSchemas.standings.parse(standings);
      const entries = parsed.children.flatMap((child) => child.standings.entries);

      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        const names = entry.stats.map((stat) => stat.name);
        for (const required of ['wins', 'losses']) {
          expect(names, `team ${entry.team.abbreviation}`).toContain(required);
        }
      }
    },
    TIMEOUT,
  );

  it(
    'still omits team colour, which is why standings joins against teams',
    () => {
      const parsed = contractSchemas.standings.parse(standings);
      const withColor = parsed.children
        .flatMap((child) => child.standings.entries)
        .filter((entry) => entry.team.color !== undefined);

      if (withColor.length > 0) {
        notes.push(
          `_Standings entries now carry \`team.color\` (${withColor.length} of them). The teams join in \`normalizeEspnStandings\` could be dropped._`,
        );
      }
    },
    TIMEOUT,
  );
});

describe('ESPN teams', () => {
  it(
    'still matches the schema, and still has thirty teams',
    async () => {
      const payload = await fetchJson(espnUrls.teams());
      expectParses('teams', payload);
      await expectNoTypeDrift('teams', payload);

      const parsed = contractSchemas.teams.parse(payload);
      expect(parsed.sports[0]?.leagues[0]?.teams).toHaveLength(30);
    },
    TIMEOUT,
  );
});

/* ── athlete ──────────────────────────────────────────────────────────────── */

describe('ESPN athlete', () => {
  let athleteId: string | undefined;

  beforeAll(async () => {
    const parsed = contractSchemas.scoreboard.parse(slate.payload);
    const completed = parsed.events.find(
      (event) => event.competitions[0]?.status.type.completed === true,
    );
    if (!completed) return;

    const summary = contractSchemas.summary.parse(
      await fetchJson(espnUrls.summary(completed.id)),
    );
    athleteId = summary.boxscore?.players?.[0]?.statistics[0]?.athletes[0]?.athlete.id;
  }, TIMEOUT);

  it(
    'still matches the schema the proxy validates with',
    async () => {
      if (!athleteId) {
        notes.push(
          '_No completed game to pull an athlete id from; the athlete endpoints were not exercised._',
        );
        return;
      }

      const profile = await fetchJson(espnUrls.athlete(athleteId));
      expectParses('athlete', profile);
      await expectNoTypeDrift('athlete', profile);

      const gamelog = await fetchJson(espnUrls.athleteGameLog(athleteId));
      expectParses('gamelog', gamelog);
      await expectNoTypeDrift('gamelog', gamelog);
    },
    TIMEOUT,
  );

  it(
    'still serves athletes from the web host, not the site host',
    () => {
      // Recorded because it has bitten us: everything else is on
      // site.api.espn.com and these two are not.
      expect(espnUrls.athlete('1')).toContain('site.web.api.espn.com');
      expect(espnUrls.scoreboard('20261103')).toContain('site.api.espn.com');
    },
    TIMEOUT,
  );
});

/* ── roster ───────────────────────────────────────────────────────────────── */

describe('ESPN team roster', () => {
  /** The four averages the pre-game roster table is built from. */
  const AVERAGE_NAMES = ['avgPoints', 'avgRebounds', 'avgAssists', 'fieldGoalPct'];

  let roster: unknown;

  beforeAll(async () => {
    const parsed = contractSchemas.scoreboard.parse(slate.payload);
    const teamId = parsed.events[0]?.competitions[0]?.competitors[0]?.team.id;
    if (!teamId) return;

    roster = await fetchJson(espnUrls.teamRoster(teamId));
  }, TIMEOUT);

  it(
    'still matches the schema the proxy validates with',
    async () => {
      expectParses('roster', roster);
      await expectNoTypeDrift('roster', roster);
    },
    TIMEOUT,
  );

  it(
    'still carries the four season averages the roster table reads',
    () => {
      const parsed = contractSchemas.roster.parse(roster);
      const athletes = parsed.positionGroups.flatMap((group) => group.athletes);

      // Spread across `general` and `offensive`, so they are read by name
      // rather than by category — this asserts the names have not moved.
      const complete = athletes.filter((athlete) => {
        const names = new Set(
          (athlete.statistics?.splits?.categories ?? [])
            .flatMap((category) => category.stats)
            .map((stat) => stat.name),
        );
        return AVERAGE_NAMES.every((name) => names.has(name));
      });

      expect(athletes.length).toBeGreaterThan(0);
      expect(complete.length).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    'still omits the categories entirely for a player with no games played',
    () => {
      const parsed = contractSchemas.roster.parse(roster);
      const unplayed = parsed.positionGroups
        .flatMap((group) => group.athletes)
        .filter((athlete) => athlete.statistics?.splits?.categories === undefined);

      // Reported, never failed: late in a season every athlete may have
      // played, and that is not a contract break.
      if (unplayed.length === 0) {
        notes.push(
          '_Every athlete on the sampled roster had season averages; the "no games played" branch was not exercised._',
        );
      }
    },
    TIMEOUT,
  );

  it(
    'still finds no roster on a pre-game summary',
    async () => {
      const parsed = contractSchemas.scoreboard.parse(slate.payload);
      const scheduled = parsed.events.find(
        (event) => event.competitions[0]?.status.type.state === 'pre',
      );
      if (!scheduled) return;

      const summary = await fetchJson(espnUrls.summary(scheduled.id));
      const hasRoster = 'rosters' in (summary as Record<string, unknown>);

      // The whole reason the roster endpoint exists. If this ever flips, the
      // separate fetch can be dropped — so report it rather than fail.
      if (hasRoster) {
        notes.push(
          '_A pre-game summary now carries a `rosters` key. The separate roster fetch may no longer be needed._',
        );
      }
    },
    TIMEOUT,
  );
});
