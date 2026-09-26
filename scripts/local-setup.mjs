import { randomBytes } from 'node:crypto';
import { writeFile, access } from 'node:fs/promises';

try {
  await access('.env');
  console.log('.env already exists; credentials were preserved. Run docker compose up --build -d.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const secret = () => randomBytes(24).toString('hex');
  await writeFile(
    '.env',
    [
      '# Generated locally. Keep private; never commit or send with the Docker image.',
      `POSTGRES_PASSWORD=${secret()}`,
      `APP_DATABASE_PASSWORD=${secret()}`,
      'BOOTSTRAP_ADMIN_EMAIL=admin@waaat.local',
      `BOOTSTRAP_ADMIN_PASSWORD=${randomBytes(18).toString('base64url')}`,
      'APP_BIND_ADDRESS=127.0.0.1',
      'APP_PORT=3000',
      'COOKIE_SECURE=false',
      '',
    ].join('\n'),
    { flag: 'wx', mode: 0o600 },
  );
  console.log('Created private .env with random database and initial admin passwords.');
  console.log('Run docker compose up --build -d, then open http://localhost:3000.');
  console.log('Sign in with BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD from .env.');
}
