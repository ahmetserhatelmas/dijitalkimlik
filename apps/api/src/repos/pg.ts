import pg from "pg";
import type { Database } from "./database.js";

export function createPgDatabase(connectionString: string): Database {
  const ssl = /supabase\.(co|com)|sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined;
  const onVercel = Boolean(process.env.VERCEL);
  const pool = new pg.Pool({
    connectionString,
    ssl,
    max: onVercel ? 1 : 3,
    idleTimeoutMillis: onVercel ? 1000 : 10_000,
    connectionTimeoutMillis: 8000,
    allowExitOnIdle: onVercel,
  });
  return databaseFromQuery(async (sql, params) => {
    const result = await pool.query(sql, params);
    return { rows: result.rows };
  }, async (fn) => {
    const client = await pool.connect();
    const tx = databaseFromQuery(async (sql, params) => {
      const result = await client.query(sql, params);
      return { rows: result.rows };
    }, async (inner) => inner(tx));
    try {
      await client.query("begin");
      const result = await fn(tx);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  });
}

export function databaseFromQuery(
  query: Database["query"],
  transaction: Database["transaction"],
): Database {
  return { query, transaction };
}
