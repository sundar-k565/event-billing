export type Paise = string;
export function paise(value: string | number | bigint): bigint {
  if (typeof value === 'number' && !Number.isSafeInteger(value))
    throw new Error('Money must be an exact integer');
  if (typeof value === 'string' && !/^\d+$/.test(value)) throw new Error('Invalid paise');
  const result = BigInt(value);
  if (result < 0n) throw new Error('Money cannot be negative');
  return result;
}
export function parseRupees(value: string): Paise {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value.trim()))
    throw new Error('Enter a price with at most two decimal places');
  const [whole, fraction = ''] = value.trim().split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result > 1000000000n) throw new Error('Price is too large');
  return result.toString();
}
export function rupeesInput(value: Paise): string {
  const n = paise(value);
  return `${n / 100n}.${(n % 100n).toString().padStart(2, '0')}`;
}
export function formatMoney(value: string | number | bigint): string {
  const n = paise(value);
  const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n / 100n);
  const fraction = n % 100n;
  return `₹${whole}${fraction ? '.' + fraction.toString().padStart(2, '0') : ''}`;
}
export function lineTotal(price: Paise, quantity: number): Paise {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999)
    throw new Error('Quantity must be 1–999');
  return (paise(price) * BigInt(quantity)).toString();
}
export function totalMoney(values: Paise[]): Paise {
  return values.reduce((sum, v) => sum + paise(v), 0n).toString();
}
