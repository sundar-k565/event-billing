/** Browser tests use real PostgreSQL and the production local authentication code. */
import { spawn } from 'node:child_process';
import { startDatabase } from './postgres';
const t = await startDatabase();
const next = spawn(
  process.execPath,
  process.env.E2E_PRODUCTION === '1'
    ? ['scripts/start.mjs']
    : ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3100'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: `postgresql://waaat_app@127.0.0.1:${t.config.port}/postgres`,
      COOKIE_SECURE: 'false',
      PORT: '3100',
      HOSTNAME: '127.0.0.1',
    },
  },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  next.kill('SIGTERM');
  await t.stop();
  process.exit(0);
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
next.on('exit', () => void stop());
