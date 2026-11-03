/**
 * Offline half of the contract. Runs on every PR and touches no network.
 *
 * It asserts the committed snapshots still describe the live schemas, so a
 * schema edit that is not accompanied by a snapshot diff fails the build. The
 * scheduled suite in ./espn.contract.ts is the half that calls ESPN.
 *
 * Regenerate with `npm run contract:snapshot`, then read the diff.
 */

import { describe, expect, it } from 'vitest';
import { contractSchemaNames } from './registry';
import {
  buildSnapshot,
  fingerprintOf,
  readSnapshot,
  SNAPSHOT_FORMAT_VERSION,
  writeSnapshot,
} from './snapshots';

const UPDATING = process.env.UPDATE_SCHEMA_SNAPSHOTS === '1';

describe('schema snapshots', () => {
  if (UPDATING) {
    it.each(contractSchemaNames)('rewrites the %s snapshot', async (name) => {
      await writeSnapshot(buildSnapshot(name));
      expect(await readSnapshot(name)).toEqual(buildSnapshot(name));
    });
    return;
  }

  it.each(contractSchemaNames)('%s matches its committed snapshot', async (name) => {
    const committed = await readSnapshot(name);
    // Not toMatchObject: a field the schema dropped has to fail too.
    expect(committed).toEqual(buildSnapshot(name));
  });

  it.each(contractSchemaNames)(
    '%s fingerprint is derived, not asserted',
    async (name) => {
      const committed = await readSnapshot(name);
      expect(committed.fingerprint).toBe(fingerprintOf(committed.fields));
      expect(committed.snapshotVersion).toBe(SNAPSHOT_FORMAT_VERSION);
    },
  );

  it('records every field path the proxy depends on', async () => {
    const scoreboard = await readSnapshot('scoreboard');

    // A spot-check that the snapshot is the real shape and not an empty
    // object that would make every assertion above vacuous.
    expect(scoreboard.fields).toMatchObject({
      'events[].competitions[].competitors[].homeAway': 'enum(away|home)',
      'events[].competitions[].competitors[].score': 'string?',
      'events[].competitions[].competitors[].linescores': 'array?',
      'events[].competitions[].status.type.state': 'enum(in|post|pre)',
    });
  });
});
