import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { tokenHash, verifyPassword } from './password';
import { HttpError } from './permissions';
import type { Profile } from './types';

export const SESSION_COOKIE = 'waaat-session';
export const SESSION_SECONDS = 12 * 60 * 60;

export async function authenticate(pool: Pool, email: string, password: string, oldToken?: string) {
  const db = await pool.connect();
  const normalized = email.trim().toLowerCase();
  try {
    await db.query('begin');
    await db.query("delete from auth.login_attempts where window_start < now()-interval '1 day'");
    await db.query('insert into auth.login_attempts(email) values($1) on conflict do nothing', [
      normalized,
    ]);
    const attempt = (
      await db.query(
        "select failures,window_start>now()-interval '15 minutes' as recent from auth.login_attempts where email=$1 for update",
        [normalized],
      )
    ).rows[0];
    if (attempt.recent && attempt.failures >= 10) {
      await db.query('commit');
      throw new HttpError(429, 'Too many sign-in attempts. Try again in 15 minutes.');
    }
    const account = (
      await db.query('select id,password_hash from auth.users where email=$1', [normalized])
    ).rows[0];
    const valid = await verifyPassword(password, account?.password_hash ?? null);
    if (!valid) {
      await db.query(
        "update auth.login_attempts set failures=case when window_start>now()-interval '15 minutes' then failures+1 else 1 end,window_start=case when window_start>now()-interval '15 minutes' then window_start else now() end where email=$1",
        [normalized],
      );
      await db.query('commit');
      throw new HttpError(401, 'Could not sign in. Check your email and password.');
    }
    const token = randomBytes(32).toString('hex');
    await db.query('delete from auth.sessions where expires_at<=now() or token_hash=$1', [
      oldToken ? tokenHash(oldToken) : '',
    ]);
    await db.query(
      "insert into auth.sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '12 hours')",
      [tokenHash(token), account.id],
    );
    const profile = (
      await db.query<Profile>('select * from auth.session_profile($1)', [tokenHash(token)])
    ).rows[0];
    if (!profile?.active)
      throw new HttpError(403, 'This account is inactive. Ask the administrator.');
    await db.query('delete from auth.login_attempts where email=$1', [normalized]);
    await db.query('commit');
    return { token, profile };
  } catch (error) {
    await db.query('rollback');
    throw error;
  } finally {
    db.release();
  }
}
