import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string | null) {
  const parts = encoded?.split('$');
  const valid =
    parts?.length === 3 &&
    parts[0] === 'scrypt' &&
    /^[a-f0-9]{32}$/.test(parts[1]) &&
    /^[a-f0-9]{128}$/.test(parts[2]);
  // Unknown users still pay the same password-derivation cost.
  const actual = await derive(password, valid ? parts[1] : '00000000000000000000000000000000');
  return !!valid && timingSafeEqual(actual, Buffer.from(parts[2], 'hex'));
}
export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
