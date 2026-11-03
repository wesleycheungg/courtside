/**
 * Runs the SQL files in db/validations/ and reports which returned rows.
 *
 * Each file is a query that selects *violations*, so the assertion is always
 * "zero rows". Keeping them as .sql rather than embedding them in TypeScript
 * is deliberate: they are the artifact a data engineer would read, they run
 * unchanged in psql against the production database, and a reviewer can check
 * the arithmetic without reading around a test harness.
 *
 * Node-only — it reads from disk. Nothing in api/ imports it.
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SqlClient } from './sql';

// path.join rather than `new URL(..., import.meta.url)`, which Vite rewrites
// into an asset reference. See the note in contract/snapshots.ts.
const VALIDATION_DIR = join(dirname(fileURLToPath(import.meta.url)), 'validations');

export interface Validation {
  name: string;
  sql: string;
}

export interface ValidationResult extends Validation {
  /** Rows the query returned. Any row at all is a failure. */
  violations: Record<string, unknown>[];
}

export async function loadValidations(): Promise<Validation[]> {
  const files = (await readdir(VALIDATION_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  return Promise.all(
    files.map(async (file) => ({
      name: file.replace(/\.sql$/, ''),
      sql: await readFile(join(VALIDATION_DIR, file), 'utf8'),
    })),
  );
}

export async function runValidations(client: SqlClient): Promise<ValidationResult[]> {
  const validations = await loadValidations();
  const results: ValidationResult[] = [];

  for (const validation of validations) {
    const violations = await client.query<Record<string, unknown>>(validation.sql);
    results.push({ ...validation, violations });
  }

  return results;
}

/** A readable failure: which check, and the offending rows. */
export function formatViolations(results: ValidationResult[]): string {
  return results
    .filter((result) => result.violations.length > 0)
    .map(
      (result) =>
        `${result.name} returned ${result.violations.length} violation(s):\n${result.violations
          .map((row) => `  ${JSON.stringify(row)}`)
          .join('\n')}`,
    )
    .join('\n\n');
}
