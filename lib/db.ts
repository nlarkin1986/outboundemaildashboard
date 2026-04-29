import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const globalForDb = globalThis as unknown as { __outboundPgPool?: Pool };

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function databaseConnectionString() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  const url = new URL(process.env.DATABASE_URL);
  // pg/pg-connection-string can let sslmode=require override the explicit
  // rejectUnauthorized:false setting and fail against Supabase pooler certs.
  // We control SSL through the Pool ssl option below instead.
  url.searchParams.delete('sslmode');
  return url.toString();
}

export function getPool() {
  if (!globalForDb.__outboundPgPool) {
    globalForDb.__outboundPgPool = new Pool({
      connectionString: databaseConnectionString(),
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    });
  }
  return globalForDb.__outboundPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export function iso(value: string | Date | null | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
