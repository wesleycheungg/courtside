/**
 * Reading and writing the committed schema snapshots in ./snapshots.
 *
 * A snapshot is the versioned record of what we believe ESPN sends. It is
 * generated from the Zod schemas, never hand-edited: `npm run
 * contract:snapshot` rewrites them, and the diff is what a reviewer reads to
 * see a shape change land. The `fingerprint` is derived from the fields, so a
 * snapshot cannot be edited into agreeing with itself.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shapeOfSchema, type Shape } from './schemaShape';
import { contractSchemas, type ContractSchemaName } from './registry';

/** Bumped only when the snapshot *file format* changes, not the schemas. */
export const SNAPSHOT_FORMAT_VERSION = 1;

export interface SchemaSnapshot {
  schema: string;
  snapshotVersion: number;
  /** sha256 of the fields block, first 12 hex chars. */
  fingerprint: string;
  fields: Shape;
}

/**
 * Built with `path.join`, not `new URL(..., import.meta.url)`: Vite rewrites
 * that pattern into a bundled asset reference, which silently resolves to
 * `undefined` for a file it cannot see at build time.
 */
const SNAPSHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'snapshots');

export function snapshotPath(name: string): string {
  return join(SNAPSHOT_DIR, `${name}.json`);
}

export function fingerprintOf(fields: Shape): string {
  const canonical = Object.entries(fields)
    .map(([path, spec]) => `${path}=${spec}`)
    .join('\n');
  return createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

export function buildSnapshot(name: ContractSchemaName): SchemaSnapshot {
  const fields = shapeOfSchema(contractSchemas[name]);
  return {
    schema: name,
    snapshotVersion: SNAPSHOT_FORMAT_VERSION,
    fingerprint: fingerprintOf(fields),
    fields,
  };
}

export async function readSnapshot(name: string): Promise<SchemaSnapshot> {
  const raw = await readFile(snapshotPath(name), 'utf8');
  return JSON.parse(raw) as SchemaSnapshot;
}

export async function writeSnapshot(snapshot: SchemaSnapshot): Promise<void> {
  await writeFile(
    snapshotPath(snapshot.schema),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    'utf8',
  );
}
