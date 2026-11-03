import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  comparableType,
  diffShapes,
  formatDiff,
  isEmptyDiff,
  shapeOfPayload,
  shapeOfSchema,
} from './schemaShape';

describe('shapeOfSchema', () => {
  it('flattens nested objects into dotted paths', () => {
    const schema = z.object({
      status: z.object({ type: z.object({ state: z.string() }) }),
    });

    expect(shapeOfSchema(schema)).toEqual({
      status: 'object',
      'status.type': 'object',
      'status.type.state': 'string',
    });
  });

  it('marks array elements with [] and record values with {}', () => {
    const schema = z.object({
      events: z.array(z.object({ id: z.string() })),
      byId: z.record(z.string(), z.object({ score: z.number() })),
    });

    expect(shapeOfSchema(schema)).toEqual({
      events: 'array',
      'events[]': 'object',
      'events[].id': 'string',
      byId: 'record',
      'byId{}': 'object',
      'byId{}.score': 'number',
    });
  });

  it('records optionality and nullability as suffixes', () => {
    const schema = z.object({
      score: z.string().optional(),
      logo: z.string().nullable(),
      note: z.string().nullable().optional(),
    });

    expect(shapeOfSchema(schema)).toEqual({
      score: 'string?',
      logo: 'string|null',
      note: 'string|null?',
    });
  });

  it('keeps enum members, sorted so the snapshot is stable', () => {
    const one = z.object({ state: z.enum(['pre', 'in', 'post']) });
    const other = z.object({ state: z.enum(['post', 'in', 'pre']) });

    expect(shapeOfSchema(one)).toEqual({ state: 'enum(in|post|pre)' });
    expect(shapeOfSchema(other)).toEqual(shapeOfSchema(one));
  });

  it('sees through an optional object to its contents', () => {
    const schema = z.object({
      boxscore: z.object({ teams: z.array(z.string()) }).optional(),
    });

    expect(shapeOfSchema(schema)).toEqual({
      boxscore: 'object?',
      'boxscore.teams': 'array',
      'boxscore.teams[]': 'string',
    });
  });

  it('emits paths in sorted order, so a regenerated snapshot does not reorder', () => {
    const schema = z.object({ zulu: z.string(), alpha: z.string(), mike: z.string() });

    expect(Object.keys(shapeOfSchema(schema))).toEqual(['alpha', 'mike', 'zulu']);
  });
});

describe('shapeOfPayload', () => {
  it('reports the JSON type at every path', () => {
    const shape = shapeOfPayload({
      id: '401',
      status: { period: 4, completed: true },
      logo: null,
    });

    expect(shape).toEqual({
      id: 'string',
      status: 'object',
      'status.period': 'number',
      'status.completed': 'boolean',
      logo: 'null',
    });
  });

  it('unions the types seen across array elements', () => {
    // Exactly the scheduled-vs-finished asymmetry in a real scoreboard.
    const shape = shapeOfPayload({
      events: [{ score: '117' }, { score: null }, {}],
    });

    expect(shape['events[].score']).toBe('null|string');
  });

  it('merges keys that only some elements carry', () => {
    const shape = shapeOfPayload({ events: [{ linescores: [] }, { id: '1' }] });

    expect(shape).toMatchObject({
      'events[].linescores': 'array',
      'events[].id': 'string',
    });
  });
});

describe('diffShapes', () => {
  const expected = shapeOfSchema(
    z.object({
      id: z.string(),
      score: z.string().optional(),
      state: z.enum(['pre', 'in', 'post']),
    }),
  );

  it('finds nothing wrong when the payload matches', () => {
    const diff = diffShapes(
      expected,
      shapeOfPayload({ id: '1', score: '99', state: 'in' }),
    );

    expect(isEmptyDiff(diff)).toBe(true);
  });

  it('reports a field the schema expects and ESPN stopped sending', () => {
    const diff = diffShapes(expected, shapeOfPayload({ id: '1', state: 'in' }));

    expect(diff.missing).toEqual(['score']);
    expect(diff.added).toEqual([]);
  });

  it('reports a new field sitting beside one we read', () => {
    const nested = shapeOfSchema(z.object({ team: z.object({ id: z.string() }) }));

    const diff = diffShapes(
      nested,
      shapeOfPayload({ team: { id: '2', isAllStar: false } }),
    );

    expect(diff.added).toEqual(['team.isAllStar']);
    expect(diff.missing).toEqual([]);
  });

  it('ignores an unmodelled subtree rather than listing all of it', () => {
    // ESPN sends several hundred fields we never read. Reporting them would
    // bury the handful that matter.
    const nested = shapeOfSchema(z.object({ team: z.object({ id: z.string() }) }));

    const diff = diffShapes(
      nested,
      shapeOfPayload({
        team: { id: '2' },
        glossary: [{ abbreviation: 'PTS', displayName: 'Points' }],
      }),
    );

    expect(diff.added).toEqual([]);
    expect(isEmptyDiff(diff)).toBe(true);
  });

  it('reads a rename as a missing field and an added one under the same parent', () => {
    const nested = shapeOfSchema(z.object({ team: z.object({ color: z.string() }) }));

    const diff = diffShapes(nested, shapeOfPayload({ team: { colour: 'ce1141' } }));

    expect(diff.missing).toEqual(['team.color']);
    expect(diff.added).toEqual(['team.colour']);
  });

  it('matches a record against its literal keys', () => {
    // The game log keys its events by event id, so the payload reads
    // `events.401909907.score` where the schema reads `events{}.score`.
    const record = shapeOfSchema(
      z.object({ events: z.record(z.string(), z.object({ score: z.string() })) }),
    );

    const diff = diffShapes(
      record,
      shapeOfPayload({
        events: { '401909907': { score: '117-105' }, '401909908': { score: '99-90' } },
      }),
    );

    expect(isEmptyDiff(diff)).toBe(true);
  });

  it('reports a type change inside a record, collapsed to one path', () => {
    const record = shapeOfSchema(
      z.object({ events: z.record(z.string(), z.object({ score: z.string() })) }),
    );

    const diff = diffShapes(
      record,
      shapeOfPayload({ events: { a: { score: 117 }, b: { score: 99 } } }),
    );

    expect(diff.changed).toEqual([
      { path: 'events{}.score', expected: 'string', actual: 'number' },
    ]);
  });

  it('reports a type that changed under us, naming the path', () => {
    // The string-score quirk, reversed: this is what we would see if ESPN
    // started sending a number.
    const diff = diffShapes(
      expected,
      shapeOfPayload({ id: '1', score: 99, state: 'in' }),
    );

    expect(diff.changed).toEqual([
      { path: 'score', expected: 'string', actual: 'number' },
    ]);
    expect(formatDiff(diff)).toContain('~ score: expected string, got number');
  });

  it('accepts null for a field the schema declared nullable', () => {
    const nullable = shapeOfSchema(z.object({ logo: z.string().nullable() }));

    expect(isEmptyDiff(diffShapes(nullable, shapeOfPayload({ logo: null })))).toBe(true);
  });

  it('does not flag an enum member it has never seen — Zod owns that', () => {
    const diff = diffShapes(
      expected,
      shapeOfPayload({ id: '1', score: '9', state: 'delayed' }),
    );

    expect(isEmptyDiff(diff)).toBe(true);
  });
});

describe('comparableType', () => {
  it.each([
    ['string?', 'string'],
    ['string|null', 'string'],
    ['string|null?', 'string'],
    ['enum(in|post|pre)', 'string'],
    ['literal("nba")', 'string'],
    ['record', 'object'],
    ['array', 'array'],
  ])('reduces %s to %s', (spec, want) => {
    expect(comparableType(spec)).toBe(want);
  });
});
