import { cp, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
try {
  process.loadEnvFile('.env.local');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
try {
  await access('public');
  await cp('public', '.next/standalone/public', { recursive: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
process.env.HOSTNAME ??= '127.0.0.1';
await import('../.next/standalone/server.js');
