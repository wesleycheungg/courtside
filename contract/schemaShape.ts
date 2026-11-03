/**
 * Flattens a schema — or a live JSON payload — into a sorted `path -> type` map.
 *
 * Flat rather than nested on purpose. A snapshot in this form diffs one line
 * per field, so ESPN adding an optional key shows up as a single added line in
 * a PR rather than a reindented block. Both halves emit the same type
 * vocabulary, so a committed schema snapshot and a live response are directly
 * comparable.
 *
 * Path syntax: `a.b` for object keys, `a[]` for array elements, `a{}` for
 * record values. Type suffixes: `?` optional, `|null` nullable.
 */

import type { z } from 'zod';

/** Sorted `path -> type` map. Plain strings so it serializes as readable JSON. */
export type Shape = Record<string, string>;

/* ── reading Zod's internals ──────────────────────────────────────────────── */

/**
 * The slice of Zod 4's internal definition we walk. Narrowed by hand rather
 * than reached for with `any`: the whole point of this file is to describe
 * foreign shapes precisely.
 */
interface ZodDef {
  type: string;
  shape?: Record<string, ZodLike>;
  innerType?: ZodLike;
  element?: ZodLike;
  keyType?: ZodLike;
  valueType?: ZodLike;
  entries?: Record<string, string | number>;
  options?: ZodLike[];
  values?: unknown[];
}

interface ZodLike {
  _zod: { def: ZodDef };
}

/** Wrappers that do not change a field's path, only its modifiers. */
const WRAPPERS = new Set([
  'optional',
  'nullable',
  'default',
  'prefault',
  'catch',
  'nonoptional',
  'readonly',
]);

interface Unwrapped {
  def: ZodDef;
  optional: boolean;
  nullable: boolean;
}

function unwrap(schema: ZodLike): Unwrapped {
  let def = schema._zod.def;
  let optional = false;
  let nullable = false;

  while (WRAPPERS.has(def.type) && def.innerType) {
    if (def.type === 'optional' || def.type === 'default' || def.type === 'prefault') {
      optional = true;
    }
    if (def.type === 'nullable') nullable = true;
    if (def.type === 'nonoptional') optional = false;
    def = def.innerType._zod.def;
  }

  return { def, optional, nullable };
}

function leafType(def: ZodDef): string {
  switch (def.type) {
    case 'enum': {
      const values = Object.values(def.entries ?? {})
        .map(String)
        .sort();
      return `enum(${values.join('|')})`;
    }
    case 'literal': {
      const values = (def.values ?? []).map((value) => JSON.stringify(value)).sort();
      return `literal(${values.join('|')})`;
    }
    case 'union': {
      const members = (def.options ?? [])
        .map((option) => leafType(unwrap(option).def))
        .sort();
      return `union(${[...new Set(members)].join('|')})`;
    }
    default:
      // string, number, boolean, bigint, date, unknown, any, null, undefined,
      // and anything Zod adds later — recorded as-is rather than guessed at.
      return def.type;
  }
}

function modifiers(base: string, { optional, nullable }: Unwrapped): string {
  return `${base}${nullable ? '|null' : ''}${optional ? '?' : ''}`;
}

function walkSchema(schema: ZodLike, path: string, into: Shape): void {
  const node = unwrap(schema);
  const { def } = node;

  if (def.type === 'object' && def.shape) {
    if (path) into[path] = modifiers('object', node);
    for (const key of Object.keys(def.shape).sort()) {
      const child = def.shape[key];
      if (child) walkSchema(child, path ? `${path}.${key}` : key, into);
    }
    return;
  }

  if (def.type === 'array' && def.element) {
    if (path) into[path] = modifiers('array', node);
    walkSchema(def.element, `${path}[]`, into);
    return;
  }

  if (def.type === 'record' && def.valueType) {
    if (path) into[path] = modifiers('record', node);
    walkSchema(def.valueType, `${path}{}`, into);
    return;
  }

  if (path) into[path] = modifiers(leafType(def), node);
}

/** The committed side of the contract: what our schema says ESPN sends. */
export function shapeOfSchema(schema: z.ZodType): Shape {
  const shape: Shape = {};
  walkSchema(schema as unknown as ZodLike, '', shape);
  return sortShape(shape);
}

/* ── reading a live payload ───────────────────────────────────────────────── */

function jsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'object':
      return 'object';
    case 'string':
    case 'number':
    case 'boolean':
      return typeof value;
    default:
      return 'unknown';
  }
}

function walkPayload(value: unknown, path: string, into: Map<string, Set<string>>): void {
  if (path) {
    const seen = into.get(path) ?? new Set<string>();
    seen.add(jsonType(value));
    into.set(path, seen);
  }

  if (Array.isArray(value)) {
    // Every element, merged: ESPN's arrays are not homogeneous — a scheduled
    // game carries no `linescores` where a finished one does — and the union
    // is what the contract actually has to tolerate.
    for (const element of value) walkPayload(element, `${path}[]`, into);
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      walkPayload(child, path ? `${path}.${key}` : key, into);
    }
  }
}

/**
 * The live side of the contract: what ESPN actually sent. Types observed at
 * the same path across array elements are unioned, so `string|null` means both
 * turned up.
 */
export function shapeOfPayload(payload: unknown): Shape {
  const observed = new Map<string, Set<string>>();
  walkPayload(payload, '', observed);

  const shape: Shape = {};
  for (const [path, types] of observed) {
    shape[path] = [...types].sort().join('|');
  }
  return sortShape(shape);
}

/* ── comparing the two ────────────────────────────────────────────────────── */

/**
 * Reduces a type to what a JSON payload can be compared against: optionality
 * is dropped (the payload cannot report it) and refinements collapse to the
 * underlying JSON type. Zod's own parse is what enforces enum values and
 * formats — this comparison exists to catch fields appearing and vanishing.
 */
export function comparableType(spec: string): string {
  const base = spec.replace(/\?$/, '').replace(/\|null$/, '');
  if (base.startsWith('enum(') || base.startsWith('literal(')) return 'string';
  if (base.startsWith('union(')) return 'union';
  if (base === 'record') return 'object';
  return base;
}

/**
 * A payload has literal record keys — `events.401909907` — where the schema
 * has `events{}`. Rewrites the former into the latter so the two line up,
 * using the record positions the schema itself declares.
 */
export function canonicalizePath(path: string, recordRoots: readonly string[]): string {
  let result = path;

  for (const root of recordRoots) {
    if (!result.startsWith(`${root}.`)) continue;
    const rest = result.slice(root.length + 1);
    const dot = rest.indexOf('.');
    result = dot === -1 ? `${root}{}` : `${root}{}${rest.slice(dot)}`;
  }

  return result;
}

function recordRootsOf(expected: Shape): string[] {
  return (
    Object.keys(expected)
      .filter((path) => path.endsWith('{}'))
      .map((path) => path.slice(0, -2))
      // Shortest first, so an outer record collapses before an inner one.
      .sort((a, b) => a.length - b.length)
  );
}

function parentOf(path: string): string {
  const trimmed = path.replace(/(\[\]|\{\})$/, '');
  if (trimmed !== path) return trimmed;
  const dot = trimmed.lastIndexOf('.');
  return dot === -1 ? '' : trimmed.slice(0, dot);
}

export interface ShapeDiff {
  /**
   * New fields sitting beside ones we read.
   *
   * Scoped to direct children of a path the schema already models, because
   * the schemas describe only the fraction of each response we consume —
   * reporting every unmodelled key would bury the signal under a few hundred
   * lines of ESPN's payload. A renamed field still shows up, as a `missing`
   * and an `added` under the same parent, which is the case worth catching.
   */
  added: string[];
  /** Paths the schema expects that the payload never carried. */
  missing: string[];
  /** Paths whose JSON type changed under us. */
  changed: { path: string; expected: string; actual: string }[];
}

export function diffShapes(expected: Shape, actual: Shape): ShapeDiff {
  const diff: ShapeDiff = { added: [], missing: [], changed: [] };
  const roots = recordRootsOf(expected);

  // Collapse record keys, unioning the types seen across them.
  const observed = new Map<string, Set<string>>();
  for (const [path, spec] of Object.entries(actual)) {
    const key = canonicalizePath(path, roots);
    const types = observed.get(key) ?? new Set<string>();
    for (const type of spec.split('|')) types.add(type);
    observed.set(key, types);
  }

  for (const [path, spec] of Object.entries(expected)) {
    const seen = observed.get(path);
    if (seen === undefined) {
      diff.missing.push(path);
      continue;
    }

    const want = comparableType(spec);
    // `union` tolerates anything by construction; `unknown` and `any` are
    // fields we deliberately do not constrain.
    if (want === 'union' || want === 'unknown' || want === 'any') continue;

    const got = [...seen].filter((type) => type !== 'null').sort();
    if (got.length > 0 && !got.every((type) => type === want)) {
      diff.changed.push({ path, expected: want, actual: got.join('|') });
    }
  }

  for (const path of observed.keys()) {
    if (expected[path] !== undefined) continue;
    const parent = parentOf(path);
    if (parent !== '' && expected[parent] !== undefined) diff.added.push(path);
  }

  return diff;
}

export function isEmptyDiff(diff: ShapeDiff): boolean {
  return (
    diff.added.length === 0 && diff.missing.length === 0 && diff.changed.length === 0
  );
}

export function formatDiff(diff: ShapeDiff): string {
  const lines: string[] = [];
  for (const entry of diff.changed) {
    lines.push(`  ~ ${entry.path}: expected ${entry.expected}, got ${entry.actual}`);
  }
  for (const path of diff.missing) lines.push(`  - ${path} (not sent)`);
  for (const path of diff.added) lines.push(`  + ${path} (new, beside a field we read)`);
  return lines.join('\n');
}

function sortShape(shape: Shape): Shape {
  return Object.fromEntries(
    Object.entries(shape).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}
