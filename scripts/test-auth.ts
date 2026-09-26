import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { startDatabase } from './test-support/postgres';
import { authenticate } from '../src/lib/local-auth';
import { tokenHash, hashPassword } from '../src/lib/password';
import { HttpError } from '../src/lib/permissions';

const t = await startDatabase();
const pool = new Pool({ ...t.config, user: 'waaat_app' });
let count = 0;
const test = async (name: string, work: () => Promise<void>) => {
  await work();
  count++;
  console.log(`PASS ${name}`);
};
try {
  await test('runtime role is restricted and cannot directly alter financial/auth records', async () => {
    const role = (
      await pool.query(
        'select rolsuper,rolbypassrls,rolinherit from pg_roles where rolname=current_user',
      )
    ).rows[0];
    assert.deepEqual(role, { rolsuper: false, rolbypassrls: false, rolinherit: false });
    for (const sql of [
      'select * from public.bills',
      'delete from public.bills',
      "update auth.users set password_hash='hacked'",
      'select * from public.schema_migrations',
    ])
      await assert.rejects(pool.query(sql), /permission denied/);
  });
  let token: string;
  await test('real local passwords log in, normalize email, and store only session hashes', async () => {
    const result = await authenticate(pool, 'STAFF@example.test', 'Test-password-2026!');
    token = result.token;
    assert.equal(result.profile.id, t.staff);
    const stored = (
      await t.root.query('select token_hash from auth.sessions where user_id=$1', [t.staff])
    ).rows;
    assert.ok(stored.some((r) => r.token_hash === tokenHash(token)));
    assert.ok(stored.every((r) => r.token_hash !== token));
  });
  await test('session hashes resolve identity; random tokens and client UUIDs do not', async () => {
    assert.equal(
      (await pool.query('select * from auth.session_profile($1)', [tokenHash(token!)])).rows[0].id,
      t.staff,
    );
    assert.equal(
      (await pool.query('select * from auth.session_profile($1)', [t.staff])).rowCount,
      0,
    );
    const db = await pool.connect();
    try {
      await db.query('begin');
      await db.query('set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [t.admin]);
      assert.equal((await db.query('select * from products')).rowCount, 0);
      await db.query('commit');
      assert.equal((await db.query('select current_user')).rows[0].current_user, 'waaat_app');
    } finally {
      db.release();
    }
  });
  await test('expired and revoked sessions lose access', async () => {
    await t.root.query('update auth.sessions set expires_at=now() where token_hash=$1', [
      tokenHash(token!),
    ]);
    assert.equal(
      (await pool.query('select * from auth.session_profile($1)', [tokenHash(token!)])).rowCount,
      0,
    );
    const session = await authenticate(pool, 'staff@example.test', 'Test-password-2026!');
    await pool.query('delete from auth.sessions where token_hash=$1', [tokenHash(session.token)]);
    assert.equal(
      (await pool.query('select * from auth.session_profile($1)', [tokenHash(session.token)]))
        .rowCount,
      0,
    );
  });
  await test('deactivated accounts cannot log in', async () => {
    await t.root.query('update profiles set active=false where id=$1', [t.other]);
    await assert.rejects(
      authenticate(pool, 'other@example.test', 'Test-password-2026!'),
      (e) => e instanceof HttpError && e.status === 403,
    );
  });
  await test('failed login throttling persists across pool connections', async () => {
    for (let i = 0; i < 10; i++)
      await assert.rejects(
        authenticate(pool, 'missing@example.test', 'wrong'),
        (e) => e instanceof HttpError && e.status === 401,
      );
    await assert.rejects(
      authenticate(pool, 'MISSING@example.test', 'wrong'),
      (e) => e instanceof HttpError && e.status === 429,
    );
    await t.root.query("update auth.login_attempts set window_start=now()-interval '16 minutes'");
    await assert.rejects(
      authenticate(pool, 'missing@example.test', 'wrong'),
      (e) => e instanceof HttpError && e.status === 401,
    );
  });
  await test('staff provisioning is admin-only and atomic, with a real usable password', async () => {
    const hash = await hashPassword('New-staff-password!');
    await assert.rejects(
      t.asUser(t.staff, (db) =>
        db.query('select create_local_user($1,$2,$3)', ['new@example.test', hash, 'New staff']),
      ),
      /Administrator/,
    );
    await t.asUser(t.admin, (db) =>
      db.query('select create_local_user($1,$2,$3)', ['new@example.test', hash, 'New staff']),
    );
    const session = await authenticate(pool, 'new@example.test', 'New-staff-password!');
    assert.equal(session.profile.role, 'STAFF');
    assert.equal(session.profile.active, true);
    await assert.rejects(
      t.asUser(t.admin, (db) =>
        db.query('select create_local_user($1,$2,$3)', ['NEW@example.test', hash, 'Duplicate']),
      ),
      /unique/,
    );
    assert.equal(
      (await t.root.query("select count(*) from profiles where email='new@example.test'")).rows[0]
        .count,
      '1',
    );
  });
  console.log(`${count} local authentication checks passed.`);
} finally {
  await pool.end();
  await t.stop();
}
