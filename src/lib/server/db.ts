import 'server-only';
import { Pool, type QueryResultRow } from 'pg';
import { dbError } from './http';

const globalDatabase = globalThis as unknown as { waaatPool?: Pool };
export function pool() {
  if (!process.env.DATABASE_URL)
    throw new Error('DATABASE_URL is not configured. Run the local Docker setup in README.md.');
  if (!globalDatabase.waaatPool) {
    globalDatabase.waaatPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    globalDatabase.waaatPool.on('error', () => console.error('An idle database connection failed'));
  }
  return globalDatabase.waaatPool;
}

export class Database {
  constructor(private readonly sessionHash: string) {}
  async query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
    const db = await pool().connect();
    try {
      await db.query('begin');
      await db.query('set local role authenticated');
      await db.query("select set_config('app.session_hash',$1,true)", [this.sessionHash]);
      const result = await db.query<T>(sql, values);
      await db.query('commit');
      return result;
    } catch (error) {
      await db.query('rollback');
      dbError(error as { code?: string; message: string });
      throw error;
    } finally {
      db.release();
    }
  }
  async scalar<T>(sql: string, values: unknown[] = []): Promise<T> {
    return (await this.query<{ result: T }>(sql, values)).rows[0].result;
  }
}
