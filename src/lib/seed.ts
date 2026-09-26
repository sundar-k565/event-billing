import { z } from 'zod';
import { parseRupees } from './money';
const category = z.object({
  name: z.string().trim().min(1).max(100),
  group_type: z.enum(['ALCOHOL', 'FOOD', 'BEVERAGE']),
  sort_order: z.number().int().nonnegative(),
});
const product = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string(),
  price_rupees: z.number().int().nonnegative().nullable(),
  unit_label: z.string().trim().min(1).max(40),
  active: z.boolean(),
  needs_confirmation: z.boolean(),
  source: z.string(),
  source_page: z.number().optional(),
  notes: z.string().optional(),
});
const schema = z.object({
  version: z.literal(1),
  currency: z.literal('INR'),
  categories: z.array(category),
  products: z.array(product),
  unresolved_menu_rules: z.array(
    z.object({
      name: z.string(),
      source_text: z.string(),
      source_page: z.number(),
      action: z.string(),
    }),
  ),
});
export function validateSeed(raw: unknown) {
  const seed = schema.parse(raw),
    categoryNames = new Set(seed.categories.map((c) => c.name));
  if (categoryNames.size !== seed.categories.length) throw new Error('Duplicate category names');
  const seen = new Set<string>();
  const products = seed.products.map((p, index) => {
    if (!categoryNames.has(p.category)) throw new Error(`Unknown category: ${p.category}`);
    const identity = `${p.category.toLowerCase()}:${p.name.toLowerCase()}`;
    if (seen.has(identity)) throw new Error(`Duplicate seed product: ${identity}`);
    seen.add(identity);
    const missedConflict =
      p.category === 'Beverages' && ['Water', 'Tonic Water', 'Ginger ale'].includes(p.name);
    const confirmation = p.needs_confirmation || missedConflict;
    const price = p.price_rupees === null ? null : parseRupees(String(p.price_rupees));
    return {
      ...p,
      price_paise: price,
      needs_confirmation: confirmation,
      active: p.active && !confirmation && price !== null,
      seed_key: `v1:${p.category}:${p.name}`,
      sort_order: index,
      source_notes: [
        p.source,
        p.source_page ? `Page ${p.source_page}` : '',
        p.notes,
        missedConflict
          ? 'Quarantined: beverage conflict in MENU_REVIEW_NOTES.md; ADMIN must confirm the event price.'
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
    };
  });
  return { ...seed, products };
}
