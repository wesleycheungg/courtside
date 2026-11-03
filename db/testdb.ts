/**
 * A real Postgres for tests, with no Postgres to install.
 *
 * PGlite is Postgres compiled to WASM, so these are genuine server-side
 * assertions — CHECK constraints fire, `numeric(4,1)` rounds, `::numeric`
 * casts behave — rather than a mock agreeing with itself. It keeps the promise
 * in CLAUDE.md that a fresh clone and CI run with no network.
 *
 * Node-only: reads the migrations from disk.
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import type { SqlClient } from './sql';

// path.join rather than `new URL(..., import.meta.url)`, which Vite rewrites
// into an asset reference. See the note in contract/snapshots.ts.
const MIGRATION_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function loadMigrations(): Promise<string[]> {
  const files = (await readdir(MIGRATION_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  return Promise.all(files.map((file) => readFile(join(MIGRATION_DIR, file), 'utf8')));
}

export interface TestDatabase extends SqlClient {
  /** Empties every cache table, so one instance can serve a whole file. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

/**
 * A fresh in-memory database with every migration applied.
 *
 * Booting PGlite compiles the WASM image and costs a few seconds, so a spec
 * creates one in `beforeAll` and calls `reset()` between tests rather than
 * paying it per test. Truncate is not weaker isolation than a new instance
 * here: these tables hold no sequences and no state outside their rows.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const pglite = new PGlite();

  for (const migration of await loadMigrations()) {
    await pglite.exec(migration);
  }

  return {
    async query<Row>(text: string, params: readonly unknown[] = []): Promise<Row[]> {
      const result = await pglite.query<Row>(text, [...params]);
      return result.rows;
    },
    async reset(): Promise<void> {
      await pglite.exec(
        'truncate cached_games, cached_game_periods, cached_standings cascade',
      );
    },
    close: () => pglite.close(),
  };
}
