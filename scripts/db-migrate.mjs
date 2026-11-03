#!/usr/bin/env node
/**
 * Applies db/migrations/*.sql to the database in DATABASE_URL, in order.
 *
 * Out of band on purpose: an edge function has no business running DDL, and
 * the migrations are plain SQL so they can equally be pasted into Neon's or
 * Supabase's console. Every statement is `if not exists`, so re-running is a
 * no-op.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npm run db:migrate
 *   DATABASE_URL=postgres://... npm run db:migrate -- --validate
 *
 * `--validate` additionally runs db/validations/*.sql against the live data
 * and exits non-zero if any of them returns a row. That is the same suite the
 * PR runs against PGlite, pointed at production.
 */

import { readdir, readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Nothing to migrate.');
  process.exit(1);
}

const sql = neon(url);
const root = new URL('../db/', import.meta.url);

async function sqlFiles(dir) {
  const folder = new URL(`${dir}/`, root);
  const names = (await readdir(folder)).filter((name) => name.endsWith('.sql')).sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      text: await readFile(new URL(name, folder), 'utf8'),
    })),
  );
}

for (const migration of await sqlFiles('migrations')) {
  // Each file holds several statements; the HTTP driver takes one at a time.
  // Comment lines go first, so a leading comment block does not get glued to
  // the statement after it.
  const statements = migration.text
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log(`applied ${migration.name} (${statements.length} statements)`);
}

if (!process.argv.includes('--validate')) {
  process.exit(0);
}

let failed = 0;
for (const validation of await sqlFiles('validations')) {
  const rows = await sql.query(validation.text);
  if (rows.length === 0) {
    console.log(`  ok   ${validation.name}`);
    continue;
  }

  failed += 1;
  console.error(`  FAIL ${validation.name} — ${rows.length} violation(s)`);
  for (const row of rows.slice(0, 10)) {
    console.error(`         ${JSON.stringify(row)}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} validation(s) failed against live data.`);
  process.exit(1);
}
