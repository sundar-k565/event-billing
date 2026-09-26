import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, tokenHash } from '../src/lib/password';
import { newIdempotencyKey } from '../src/lib/idempotency';
describe('local credentials', () => {
  it('creates independent UUID-v4 submission keys without requiring HTTPS randomUUID', () => {
    const keys = Array.from({ length: 100 }, newIdempotencyKey);
    expect(new Set(keys).size).toBe(100);
    for (const key of keys)
      expect(key).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  });
  it('uses unique salts and verifies only the correct password', async () => {
    const a = await hashPassword('A-secure-password-2026!');
    const b = await hashPassword('A-secure-password-2026!');
    expect(a).not.toBe(b);
    expect(a).not.toContain('A-secure-password');
    expect(await verifyPassword('A-secure-password-2026!', a)).toBe(true);
    expect(await verifyPassword('wrong password', a)).toBe(false);
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', 'malformed')).toBe(false);
  });
  it('stores a stable hash rather than raw session tokens', () => {
    expect(tokenHash('token-one')).toHaveLength(64);
    expect(tokenHash('token-one')).not.toBe(tokenHash('token-two'));
  });
});
