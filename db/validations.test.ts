// @vitest-environment node
/**
 * The SQL data-validation suite.
 *
 * Two halves, and the second is the one that matters. First: every check
 * passes over real captured ESPN data, which proves the queries run and that
 * what we cache is internally consistent. Second: each check is fed a
 * deliberately corrupted row and has to catch it — a validation that has never
 * failed is a validation nobody has tested.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  espnScoreboardSchema,
  espnStandingsSchema,
  espnTeamsSchema,
} from '../src/data/espn/espnSchemas';
import scoreboardFixture from '../src/data/espn/fixtures/scoreboard-final-2026-11-02.json';
import standingsFixture from '../src/data/espn/fixtures/standings-2026-11-03.json';
import teamsFixture from '../src/data/espn/fixtures/teams-2026-11-03.json';
import { saveGames, saveStandings } from './cache';
import { cachedGamesFrom, cachedStandingsFrom } from './rows';
import { createTestDatabase, type TestDatabase } from './testdb';
import {
  formatViolations,
  loadValidations,
  runValidations,
  type ValidationResult,
} from './validations';
import type { SqlClient } from './sql';

const scoreboard = espnScoreboardSchema.parse(scoreboardFixture);
const standings = espnStandingsSchema.parse(standingsFixture);
const teams = espnTeamsSchema.parse(teamsFixture);

let db: TestDatabase;

// One PGlite per file; see the note on createTestDatabase.
beforeAll(async () => {
  db = await createTestDatabase();
}, 60_000);

beforeEach(async () => {
  await db.reset();
  await saveGames(db, cachedGamesFrom(scoreboard));
  await saveStandings(db, cachedStandingsFrom(standings, teams));
});

afterAll(() => db.close());

function violationsOf(
  results: ValidationResult[],
  name: string,
): Record<string, unknown>[] {
  const result = results.find((candidate) => candidate.name === name);
  expect(result, `no validation named ${name}`).toBeDefined();
  return result!.violations;
}

describe('validation suite', () => {
  it('loads every .sql file in db/validations', async () => {
    const names = (await loadValidations()).map((validation) => validation.name);

    expect(names).toEqual([
      'final_game_has_four_periods',
      'final_score_matches_quarters',
      'standings_gb_matches_record',
      'standings_seeds_are_dense',
    ]);
  });

  it('passes over real captured ESPN data', async () => {
    const results = await runValidations(db);

    expect(formatViolations(results)).toBe('');
  });

  it('passes on an empty cache, rather than failing vacuously', async () => {
    await db.reset();

    expect(formatViolations(await runValidations(db))).toBe('');
  });
});

describe('a corrupted score', () => {
  it('is caught by final_score_matches_quarters', async () => {
    const id = await someFinalGameId(db);
    await db.query('update cached_games set away_score = away_score + 1 where id = $1', [
      id,
    ]);

    const violations = violationsOf(
      await runValidations(db),
      'final_score_matches_quarters',
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ game_id: id });
  });

  it('names the total and the quarter sum it disagrees with', async () => {
    const id = await someFinalGameId(db);
    await db.query('update cached_games set home_score = 999 where id = $1', [id]);

    const results = await runValidations(db);
    const [violation] = violationsOf(results, 'final_score_matches_quarters');

    expect(violation?.home_total).toBe(999);
    expect(Number(violation?.home_quarter_sum)).not.toBe(999);
    expect(formatViolations(results)).toContain('final_score_matches_quarters');
  });

  it('is caught when a single quarter is altered, not just the total', async () => {
    const id = await someFinalGameId(db);
    await db.query(
      'update cached_game_periods set away_score = away_score + 3 where game_id = $1 and period = 1',
      [id],
    );

    expect(
      violationsOf(await runValidations(db), 'final_score_matches_quarters'),
    ).toHaveLength(1);
  });
});

describe('a final game with its quarters missing', () => {
  it('is caught by final_game_has_four_periods', async () => {
    const id = await someFinalGameId(db);
    await db.query('delete from cached_game_periods where game_id = $1', [id]);

    const results = await runValidations(db);

    expect(violationsOf(results, 'final_game_has_four_periods')).toMatchObject([
      { game_id: id },
    ]);
    // The sum check cannot see it — an inner join drops a game with no
    // periods. That gap is exactly why this second query exists.
    expect(violationsOf(results, 'final_score_matches_quarters')).toEqual([]);
  });

  it('is caught when only three quarters survive', async () => {
    const id = await someFinalGameId(db);
    await db.query('delete from cached_game_periods where game_id = $1 and period > 3', [
      id,
    ]);

    expect(
      violationsOf(await runValidations(db), 'final_game_has_four_periods'),
    ).toHaveLength(1);
  });
});

describe('corrupted standings', () => {
  it('a wrong games-behind is caught by standings_gb_matches_record', async () => {
    await db.query(
      `update cached_standings set games_behind = 99.0 where conference = 'east' and seed = 4`,
    );

    const violations = violationsOf(
      await runValidations(db),
      'standings_gb_matches_record',
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ conference: 'east', reported: '99.0' });
  });

  it('a record edited without its games-behind is caught too', async () => {
    // The realistic failure: a partial write updates W/L and leaves GB behind.
    await db.query(
      `update cached_standings set wins = wins + 10, losses = losses - 1
       where conference = 'west' and seed = 8`,
    );

    expect(
      violationsOf(await runValidations(db), 'standings_gb_matches_record'),
    ).toHaveLength(1);
  });

  it('a seed gap is caught by standings_seeds_are_dense', async () => {
    await db.query(`delete from cached_standings where conference = 'east' and seed = 5`);

    const violations = violationsOf(
      await runValidations(db),
      'standings_seeds_are_dense',
    );

    expect(violations).toMatchObject([{ conference: 'east' }]);
  });

  it('seeds starting at 2 are caught as well as a gap in the middle', async () => {
    await db.query(`delete from cached_standings where conference = 'west' and seed = 1`);

    // Without the leader there is no row to measure GB against, so only the
    // density check should speak.
    const results = await runValidations(db);
    expect(violationsOf(results, 'standings_seeds_are_dense')).toHaveLength(1);
    expect(violationsOf(results, 'standings_gb_matches_record')).toEqual([]);
  });
});

async function someFinalGameId(client: SqlClient): Promise<string> {
  const [row] = await client.query<{ id: string }>(
    `select id from cached_games where status = 'final' order by id limit 1`,
  );
  expect(row, 'the fixture slate has no final game').toBeDefined();
  return row!.id;
}
