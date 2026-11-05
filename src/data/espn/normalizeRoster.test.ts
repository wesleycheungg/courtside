import { describe, expect, it } from 'vitest';
import { normalizeEspnRoster, normalizeRosterAthlete } from './normalizeRoster';
import { espnRosterSchema, type EspnRosterAthlete } from './espnSchemas';
import { parseOrThrow, rosterEntrySchema } from '../schemas';
import rosterFixture from './fixtures/roster-21-2026-11-05.json';

/** Phoenix, captured 2026-11-05: 17 athletes, 2 of them with no games played. */
const roster = espnRosterSchema.parse(rosterFixture);

describe('normalizeEspnRoster', () => {
  it('still parses the captured payload against the schema the proxy uses', () => {
    expect(() => espnRosterSchema.parse(rosterFixture)).not.toThrow();
  });

  it('turns every athlete into exactly one entry', () => {
    const entries = normalizeEspnRoster(roster);
    const athletes = roster.positionGroups.flatMap((group) => group.athletes);

    expect(entries).toHaveLength(athletes.length);
    expect(entries).toHaveLength(17);
  });

  it('produces entries that satisfy the domain schema', () => {
    for (const entry of normalizeEspnRoster(roster)) {
      expect(() => parseOrThrow(rosterEntrySchema, entry, entry.playerId)).not.toThrow();
    }
  });

  it('reads all four averages across the general and offensive categories', () => {
    const booker = normalizeEspnRoster(roster).find(
      (entry) => entry.name === 'Devin Booker',
    );

    // REB arrives under `general`, the other three under `offensive`.
    expect(booker?.seasonAverages).toEqual({
      points: expect.closeTo(24.67, 1),
      rebounds: expect.closeTo(3.17, 1),
      assists: expect.closeTo(4.67, 1),
      fieldGoalPercent: expect.closeTo(48.51, 1),
    });
  });

  it('leaves the athletes with no games played without averages', () => {
    const unplayed = normalizeEspnRoster(roster).filter(
      (entry) => entry.seasonAverages === undefined,
    );

    // Their `statistics.splits` carries no `categories` key at all.
    expect(unplayed.map((entry) => entry.name).sort()).toEqual([
      'Drew Timme',
      'Mark Williams',
    ]);
  });

  it('sorts the best scorers first and the unplayed athletes last', () => {
    const entries = normalizeEspnRoster(roster);

    expect(entries[0]?.name).toBe('Devin Booker');
    expect(entries.at(-1)?.seasonAverages).toBeUndefined();
  });

  it('keeps the full name, leaving the table to abbreviate it', () => {
    expect(normalizeEspnRoster(roster)[0]?.name).toBe('Devin Booker');
  });
});

describe('normalizeRosterAthlete', () => {
  const bare: EspnRosterAthlete = { id: '1', displayName: 'Nameless Rookie' };

  it('tolerates an athlete with no statistics at all', () => {
    expect(normalizeRosterAthlete(bare).seasonAverages).toBeUndefined();
  });

  it('turns a null jersey into an empty string', () => {
    // ESPN sends null here, not an absent key.
    expect(normalizeRosterAthlete({ ...bare, jersey: null }).jerseyNumber).toBe('');
  });

  it('falls back to a dash when the position is missing', () => {
    expect(normalizeRosterAthlete(bare).position).toBe('—');
  });

  it('ignores a partial stat set rather than guessing the missing ones', () => {
    const partial = normalizeRosterAthlete({
      ...bare,
      statistics: {
        splits: {
          categories: [
            { name: 'offensive', stats: [{ name: 'avgPoints', value: 12.5 }] },
          ],
        },
      },
    });

    expect(partial.seasonAverages).toBeUndefined();
  });

  it('collapses an athlete repeated across position groups', () => {
    const entries = normalizeEspnRoster({
      positionGroups: [{ athletes: [bare] }, { athletes: [bare] }],
    });

    expect(entries).toHaveLength(1);
  });
});
