import type { CartLine, Product } from './types';
import { lineTotal, totalMoney } from './money';
export function addItem(cart: CartLine[], product: Product): CartLine[] {
  const existing = cart.find((i) => i.id === product.id);
  if (!existing && cart.length >= 200) throw new Error('Maximum 200 distinct items per bill');
  return existing
    ? setQuantity(cart, product.id, existing.quantity + 1)
    : [...cart, { ...product, quantity: 1 }];
}
export function setQuantity(cart: CartLine[], id: string, quantity: number): CartLine[] {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999)
    throw new Error('Quantity must be 0–999');
  return quantity === 0
    ? cart.filter((i) => i.id !== id)
    : cart.map((i) => (i.id === id ? { ...i, quantity } : i));
}
export function cartTotal(cart: CartLine[]): string {
  return totalMoney(cart.map((i) => lineTotal(i.pricePaise, i.quantity)));
}
