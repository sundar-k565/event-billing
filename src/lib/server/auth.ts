import 'server-only';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Database, pool } from './db';
import { SESSION_COOKIE } from '@/lib/local-auth';
import { tokenHash } from '@/lib/password';
import { authorize, HttpError } from '@/lib/permissions';
import type { Profile } from '@/lib/types';
export async function requireSession(admin = false) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(401, 'Please sign in again. Your cart is kept in this tab.');
  const hash = tokenHash(token);
  const profile = (await pool().query<Profile>('select * from auth.session_profile($1)', [hash]))
    .rows[0];
  if (!profile) throw new HttpError(401, 'Please sign in again. Your cart is kept in this tab.');
  return { db: new Database(hash), profile: authorize(profile, admin) };
}
export async function pageSession(admin = false) {
  try {
    return await requireSession(admin);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect('/login');
    if (error instanceof HttpError && error.status === 403) redirect('/access-denied');
    throw error;
  }
}
