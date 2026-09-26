import { describe, it, expect } from 'vitest';
import { addItem, setQuantity, cartTotal } from '../src/lib/cart';
import { formatMoney, lineTotal, parseRupees, paise, totalMoney } from '../src/lib/money';
import { dayBounds, indiaDate } from '../src/lib/date';
import { authorize } from '../src/lib/permissions';
import { billSchema } from '../src/lib/validation';
import { validateSeed } from '../src/lib/seed';
import seed from '../data/MENU_SEED.json';
import { assertSameOrigin } from '../src/lib/origin';
const product = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Teachers',
  pricePaise: '39900',
  unitLabel: '30 ml',
};
describe('request origin', () => {
  it('supports proxy-normalized URLs without trusting forwarded-host', () => {
    expect(() =>
      assertSameOrigin(
        new Request('http://localhost:3100/api/bills', {
          headers: { host: '127.0.0.1:3100', origin: 'http://127.0.0.1:3100' },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      assertSameOrigin(
        new Request('https://pos.example/api/bills', {
          headers: {
            host: 'pos.example',
            origin: 'https://evil.example',
            'x-forwarded-host': 'evil.example',
          },
        }),
      ),
    ).toThrow();
    expect(() => assertSameOrigin(new Request('https://pos.example/api/bills'))).toThrow();
  });
});
describe('exact money', () => {
  it('399 × 2 = 798; subtotal equals total', () => {
    expect(lineTotal('39900', 2)).toBe('79800');
    expect(totalMoney(['79800', '29900', '20000'])).toBe('129700');
  });
  it('preserves fractional rupees without floating point', () => {
    expect(parseRupees('0.29')).toBe('29');
    expect(lineTotal('29', 3)).toBe('87');
    expect(formatMoney('129700')).toBe('₹1,297');
    expect(formatMoney('101')).toBe('₹1.01');
  });
  it('rejects fractions, negative quantities and unsafe numeric money', () => {
    expect(() => paise(0.1)).toThrow();
    expect(() => paise(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => lineTotal('39900', 1.5)).toThrow();
    expect(() => lineTotal('39900', 0)).toThrow();
    expect(() => parseRupees('-1')).toThrow();
    expect(() => parseRupees('1.001')).toThrow();
  });
  it('supports exact values beyond Number precision', () => {
    expect(totalMoney(['9007199254740993', '7'])).toBe('9007199254741000');
  });
});
describe('cart', () => {
  it('adds, increments, decrements and removes at zero', () => {
    let cart = addItem([], product);
    expect(cart[0].quantity).toBe(1);
    cart = addItem(cart, product);
    expect(cart[0].quantity).toBe(2);
    expect(cartTotal(cart)).toBe('79800');
    cart = setQuantity(cart, product.id, 1);
    expect(cartTotal(cart)).toBe('39900');
    expect(setQuantity(cart, product.id, 0)).toEqual([]);
  });
  it('bounds quantity', () => {
    expect(() => setQuantity([{ ...product, quantity: 1 }], product.id, 1000)).toThrow();
  });
});
describe('authorization', () => {
  const staff = {
    id: '1',
    email: 'staff@example.test',
    display_name: 'Staff',
    role: 'STAFF' as const,
    active: true,
  };
  it('rejects STAFF for admin operations', () => {
    expect(() => authorize(staff, true)).toThrow('Administrator');
  });
  it('allows ADMIN, rejects inactive and anonymous', () => {
    expect(authorize({ ...staff, role: 'ADMIN' }, true).role).toBe('ADMIN');
    expect(() => authorize(null)).toThrow();
    expect(() => authorize({ ...staff, active: false })).toThrow();
  });
});
describe('India date boundaries', () => {
  it('converts local midnight and exclusive end to UTC', () => {
    expect(dayBounds('2026-09-25')).toEqual({
      start: '2026-09-24T18:30:00.000Z',
      end: '2026-09-25T18:30:00.000Z',
    });
    expect(indiaDate(new Date('2026-09-24T18:30:00Z'))).toBe('2026-09-25');
  });
  it('handles month/year rollover and invalid dates', () => {
    expect(dayBounds('2026-12-31').end).toBe('2026-12-31T18:30:00.000Z');
    expect(() => dayBounds('2026-02-30')).toThrow();
    expect(() => dayBounds('bad')).toThrow();
  });
});
describe('request and menu validation', () => {
  const input = {
    idempotencyKey: '00000000-0000-4000-8000-000000000002',
    paymentMethod: 'CASH',
    items: [{ productId: product.id, quantity: 1 }],
  };
  it('rejects client price/role/total and missing payment', () => {
    expect(billSchema.safeParse(input).success).toBe(true);
    expect(billSchema.safeParse({ ...input, totalPaise: 1 }).success).toBe(false);
    expect(billSchema.safeParse({ ...input, role: 'ADMIN' }).success).toBe(false);
    expect(billSchema.safeParse({ ...input, paymentMethod: null }).success).toBe(false);
    expect(billSchema.safeParse({ ...input, items: [] }).success).toBe(false);
    expect(
      billSchema.safeParse({ ...input, items: [...input.items, ...input.items] }).success,
    ).toBe(false);
  });
  it('quarantines all conflicts and seasonal records', () => {
    const s = validateSeed(seed);
    expect(s.products).toHaveLength(205);
    expect(s.products.filter((p) => p.active)).toHaveLength(193);
    expect(s.products.filter((p) => p.needs_confirmation)).toHaveLength(10);
    expect(s.products.filter((p) => p.price_paise === null)).toHaveLength(2);
    expect(
      s.products.some((p) => p.active && (p.needs_confirmation || p.price_paise === null)),
    ).toBe(false);
    expect(s.products.filter((p) => p.name === 'Seasame Honey Lotus Stem')).toHaveLength(1);
    expect(s.unresolved_menu_rules).toHaveLength(2);
  });
  it('rejects duplicates, unknown categories and bad prices', () => {
    expect(() => validateSeed({ ...seed, products: [seed.products[0], seed.products[0]] })).toThrow(
      'Duplicate',
    );
    expect(() =>
      validateSeed({ ...seed, products: [{ ...seed.products[0], category: 'Unknown' }] }),
    ).toThrow('Unknown');
    expect(() =>
      validateSeed({ ...seed, products: [{ ...seed.products[0], price_rupees: -1 }] }),
    ).toThrow();
  });
});
