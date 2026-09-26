import { z } from 'zod';
import { dayBounds } from './date';
const name = z.string().trim().min(1).max(160);
export const uuid = z.uuid();
export const billSchema = z
  .object({
    idempotencyKey: uuid,
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD']),
    items: z
      .array(z.object({ productId: uuid, quantity: z.number().int().min(1).max(999) }).strict())
      .min(1)
      .max(200),
  })
  .strict()
  .refine(
    (v) => new Set(v.items.map((i) => i.productId)).size === v.items.length,
    'Duplicate items',
  );
export const productSchema = z
  .object({
    name,
    category_id: uuid,
    price_paise: z
      .string()
      .regex(/^\d+$/)
      .refine((v) => BigInt(v) <= 1000000000n)
      .nullable(),
    unit_label: z.string().trim().min(1).max(40),
    active: z.boolean(),
    needs_confirmation: z.boolean(),
    sort_order: z.number().int().min(0).max(100000),
  })
  .strict();
export const categorySchema = z
  .object({
    name: name.max(100),
    group_type: z.enum(['ALCOHOL', 'FOOD', 'BEVERAGE']),
    sort_order: z.number().int().min(0).max(100000),
    active: z.boolean(),
  })
  .strict();
export const userSchema = z
  .object({ display_name: name.max(100), role: z.enum(['STAFF', 'ADMIN']), active: z.boolean() })
  .strict();
export const newUserSchema = z
  .object({
    email: z.email().max(254),
    password: z.string().min(12).max(128),
    display_name: name.max(100),
  })
  .strict();
export const settingsSchema = z
  .object({ display_name: name.max(100), receipt_footer: z.string().trim().min(1).max(200) })
  .strict();
export const dateSchema = z.string().refine((v) => {
  try {
    dayBounds(v);
    return true;
  } catch {
    return false;
  }
}, 'Invalid date');
