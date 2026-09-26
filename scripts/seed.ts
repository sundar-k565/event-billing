import { Client } from 'pg';
import { readSeed, seedMenu } from './database';
async function main() {
  const seed = await readSeed();
  console.log(
    `Menu validated: ${seed.categories.length} categories, ${seed.products.length} products, ${seed.products.filter((p) => p.active).length} billable, ${seed.products.filter((p) => p.needs_confirmation).length} awaiting confirmation, ${seed.products.filter((p) => p.price_paise === null).length} unpriced. ${seed.unresolved_menu_rules.length} unresolved modifier rules remain unseeded.`,
  );
  if (process.argv.includes('--validate')) return;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await seedMenu(db);
    console.log('Seed imported. Existing products/prices were preserved.');
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
