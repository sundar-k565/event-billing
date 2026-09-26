import { Client } from 'pg';
import { migrate, seedMenu } from './database';
import { hashPassword } from '../src/lib/password';
import { newUserSchema } from '../src/lib/validation';

async function main() {
  const url = process.env.DATABASE_URL;
  const appPassword = process.env.APP_DATABASE_PASSWORD;
  if (!url || !appPassword || !/^[A-Za-z0-9_-]{24,128}$/.test(appPassword))
    throw new Error('Run node scripts/local-setup.mjs to generate local database credentials.');
  const owner = newUserSchema.parse({
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    display_name: 'WAAAT Owner',
  });
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await migrate(db);
    await seedMenu(db);
    await db.query('begin');
    await db.query('select pg_advisory_xact_lock(88004)');
    const roleSql = (
      await db.query(
        "select format('alter role waaat_app with login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password %L', $1::text) as sql",
        [appPassword],
      )
    ).rows[0].sql;
    await db.query(roleSql);
    const existing = await db.query('select id from public.profiles limit 1');
    if (!existing.rowCount) {
      const hash = await hashPassword(owner.password);
      const user = await db.query(
        'insert into auth.users(email,password_hash,raw_user_meta_data) values($1,$2,$3) returning id',
        [owner.email.toLowerCase(), hash, JSON.stringify({ display_name: owner.display_name })],
      );
      await db.query("update public.profiles set role='ADMIN',active=true where id=$1", [
        user.rows[0].id,
      ]);
      console.log('Initial administrator created. Credentials are in your local .env file.');
    }
    await db.query('commit');
    console.log(
      'Local PostgreSQL ready: schema migrated, menu seeded, existing accounts and prices preserved.',
    );
  } catch (error) {
    await db.query('rollback');
    throw error;
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(
    'Local initialization failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exitCode = 1;
});
