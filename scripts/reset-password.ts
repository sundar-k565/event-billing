// Database-owner maintenance command; never exposed as an HTTP endpoint.
import { Client } from 'pg';
import { z } from 'zod';
import { hashPassword } from '../src/lib/password';
const email = z.email().parse(process.env.RESET_EMAIL).toLowerCase();
const password = z.string().min(12).max(128).parse(process.env.RESET_PASSWORD);
if (!process.env.DATABASE_URL) throw new Error('Database-owner DATABASE_URL is required');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const hash = await hashPassword(password);
  await db.query('begin');
  const changed = await db.query(
    'update auth.users set password_hash=$1 where email=$2 returning id',
    [hash, email],
  );
  if (!changed.rowCount) throw new Error('Account not found');
  await db.query('delete from auth.sessions where user_id=$1', [changed.rows[0].id]);
  await db.query('commit');
  console.log(
    'Password reset and all sessions for this account revoked. Roles and sales were preserved.',
  );
} catch (error) {
  await db.query('rollback');
  throw error;
} finally {
  await db.end();
}
