/**
 * The seam between the cache and whatever Postgres it is talking to.
 *
 * Same idea as `DataProvider`: one narrow interface, two implementations, and
 * nothing above it knows which is in play. Production uses Neon's serverless
 * driver, which speaks HTTP and therefore works inside an edge function where
 * `pg`'s TCP socket does not. Tests use PGlite — real Postgres compiled to
 * WASM — so a fresh clone runs the SQL assertions with no database, no
 * container, and no network.
 */

/**
 * Vercel's edge runtime exposes `process.env`, but this project's api/
 * tsconfig declares no Node types on purpose. Declared locally and read
 * through a guard rather than pulling @types/node into the edge build.
 */
declare const process: { env: Record<string, string | undefined> } | undefined;

export interface SqlClient {
  query<Row>(text: string, params?: readonly unknown[]): Promise<Row[]>;
}

export function databaseUrl(): string | undefined {
  if (typeof process === 'undefined') return undefined;
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
}

/**
 * A client for the configured database, or `null` when none is configured.
 *
 * Null rather than throwing: the cache is an addition to the proxy, not a
 * dependency of it. A deploy with no `DATABASE_URL` serves scores exactly as
 * it did before M6, which is also what keeps CI and a fresh clone working.
 */
export async function getSqlClient(): Promise<SqlClient | null> {
  const url = databaseUrl();
  if (!url) return null;

  // Imported lazily so the driver is never loaded — or bundled into a test
  // run — unless a database is actually configured.
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);

  return {
    async query<Row>(text: string, params: readonly unknown[] = []): Promise<Row[]> {
      const rows = await sql.query(text, [...params]);
      return rows as Row[];
    },
  };
}
