import { Client } from 'pg';
import { migrate } from './database';
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await migrate(db);
    console.log('All migrations applied successfully.');
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
