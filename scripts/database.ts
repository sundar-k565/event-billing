import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Client } from 'pg';
import { validateSeed } from '../src/lib/seed';
export async function migrate(db: Client) {
  await db.query('begin');
  try {
    await db.query('select pg_advisory_xact_lock(88002)');
    await db.query(
      'create table if not exists public.schema_migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())',
    );
    const files = [
      'database/local/000_identity.sql',
      ...(await readdir('supabase/migrations'))
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => `supabase/migrations/${n}`),
      'database/local/003_local_auth.sql',
    ];
    for (const file of files) {
      const name = file.split('/').at(-1)!;
      const sql = await readFile(file, 'utf8'),
        checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await db.query(
        'select checksum from public.schema_migrations where name=$1',
        [name],
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await db.query(sql);
      await db.query('insert into public.schema_migrations(name,checksum) values($1,$2)', [
        name,
        checksum,
      ]);
    }
    await db.query('revoke all on public.schema_migrations from anon, authenticated');
    await db.query('commit');
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}
export async function readSeed() {
  return validateSeed(JSON.parse(await readFile('data/MENU_SEED.json', 'utf8')));
}
export async function seedMenu(db: Client) {
  const seed = await readSeed();
  await db.query('begin');
  try {
    await db.query('select pg_advisory_xact_lock(88003)');
    for (const c of seed.categories)
      await db.query(
        'insert into public.categories(name,group_type,sort_order) values($1,$2,$3) on conflict(name,group_type) do nothing',
        [c.name, c.group_type, c.sort_order],
      );
    const categories = await db.query('select id,name from public.categories');
    const ids = new Map(categories.rows.map((c) => [c.name, c.id]));
    for (const p of seed.products)
      await db.query(
        `insert into public.products(category_id,name,price_paise,unit_label,active,needs_confirmation,sort_order,seed_key,source_notes)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(seed_key) do nothing`,
        [
          ids.get(p.category),
          p.name,
          p.price_paise,
          p.unit_label,
          p.active,
          p.needs_confirmation,
          p.sort_order,
          p.seed_key,
          p.source_notes,
        ],
      );
    await db.query('commit');
    return seed;
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}
