import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { migrate, seedMenu } from '../database';
import { hashPassword, tokenHash } from '../../src/lib/password';
export async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  return port;
}
export async function startDatabase() {
  const directory = await mkdtemp(join(tmpdir(), 'waaat-pos-db-')),
    port = await freePort(),
    data = join(directory, 'data');
  execFileSync(
    'initdb',
    ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale', '-E', 'UTF8'],
    { stdio: 'pipe' },
  );
  execFileSync(
    'pg_ctl',
    [
      '-D',
      data,
      '-l',
      join(directory, 'postgres.log'),
      '-o',
      `-p ${port} -h 127.0.0.1 -k ${directory}`,
      '-w',
      'start',
    ],
    { stdio: 'pipe' },
  );
  const config = { host: '127.0.0.1', port, user: 'postgres', database: 'postgres' };
  const root = new Client(config);
  await root.connect();
  await migrate(root);
  await seedMenu(root);
  const admin = randomUUID(),
    staff = randomUUID(),
    other = randomUUID();
  await root.query(
    'insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3),($4,$5,$6),($7,$8,$9)',
    [
      admin,
      'admin@example.test',
      JSON.stringify({ display_name: 'Owner', role: 'ADMIN' }),
      staff,
      'staff@example.test',
      JSON.stringify({ display_name: 'Cashier' }),
      other,
      'other@example.test',
      JSON.stringify({ display_name: 'Other cashier' }),
    ],
  );
  await root.query(
    "update profiles set active=true,role=case when id=$1 then 'ADMIN'::user_role else 'STAFF'::user_role end",
    [admin],
  );
  await root.query('update auth.users set password_hash=$1', [
    await hashPassword('Test-password-2026!'),
  ]);
  async function asUser<T>(
    user: string | null,
    work: (db: Client) => Promise<T>,
    role = 'authenticated',
  ): Promise<T> {
    const db = new Client(config);
    await db.connect();
    try {
      if (user)
        await db.query(
          "insert into auth.sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour') on conflict do nothing",
          [tokenHash(user), user],
        );
      await db.query('begin');
      await db.query(`set local role ${role === 'anon' ? 'anon' : 'authenticated'}`);
      await db.query("select set_config('app.session_hash',$1,true)", [
        user ? tokenHash(user) : '',
      ]);
      const result = await work(db);
      await db.query('commit');
      return result;
    } catch (e) {
      await db.query('rollback');
      throw e;
    } finally {
      await db.end();
    }
  }
  async function stop() {
    await root.end();
    execFileSync('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'pipe' });
    console.log(`Temporary PostgreSQL stopped; isolated test files: ${directory}`);
  }
  return { root, config, admin, staff, other, asUser, stop };
}
