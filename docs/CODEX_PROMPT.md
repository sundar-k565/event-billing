# Master Prompt for Codex

You are implementing **WAAAT POS V1**, a small browser-based point-of-sale application.

## Start here
Before writing code:
1. Read `AGENTS.md`.
2. Read all files under `docs/`.
3. Read `data/MENU_SEED.json` and `docs/MENU_REVIEW_NOTES.md`.
4. Do not invent missing business rules.

## Product
One Windows computer, one Saturday-night pub event, reliable internet, Vercel hosting, Supabase PostgreSQL/Auth.

## Required stack
- Next.js
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase PostgreSQL
- Vercel

## Roles
ADMIN:
- full access
- reports
- bill history
- menu/prices
- settings/users
- void bills

STAFF:
- billing
- operational reprint
- no admin/report/settings/void access

## Billing
- Categories/products are database-driven.
- No menu prices hard-coded in UI.
- One payment method per bill: Cash, UPI, Card.
- No tax/discount/split payment/inventory in V1.
- Total equals subtotal.
- Bill number format: `WAAAT-0001`.
- Never reuse a bill number, including after VOID.
- Completed bill is immutable except ADMIN void metadata.
- Store product name + price snapshot on each bill item.
- Use integer paise; no floating point for money.
- Use idempotency to prevent duplicate bills.
- Save bill before printing.

## Printing
- Browser print.
- Print-friendly receipt route and CSS.
- Printer model is TBD; do not add printer SDK dependencies yet.
- A print failure must not roll back or invalidate a saved bill.
- Reprint must always be possible.

## Menu
- `data/MENU_SEED.json` is the initial source.
- Do not silently resolve price conflicts or ambiguous source text.
- Unpriced seasonal items remain inactive.
- `Schezwan (₹20 extra)` is not a standalone priced product.
- Preserve historical accuracy of bills even when menu prices are changed.

## Quality bar
The finished implementation must:
- enforce authorization server-side;
- validate all bill totals on the server;
- use transactions for bill creation;
- use deterministic migrations;
- include tests for core business rules;
- have clear loading/error states;
- be usable with a mouse on a Windows desktop;
- have no secrets in client code;
- be deployable to Vercel.

## Build strategy
Implement in vertical slices:

### Slice 1
Project bootstrap + auth + roles.

### Slice 2
Database schema + seed import.

### Slice 3
POS category/product browsing + cart.

### Slice 4
Bill creation + numbering + idempotency.

### Slice 5
Receipt view + browser print.

### Slice 6
Bill history + reprint + void.

### Slice 7
Admin dashboard + reports.

### Slice 8
Menu/user/settings administration.

### Slice 9
Tests + production hardening.

Do not skip directly to a polished UI before the business logic is correct.

## Output expectations
For each implementation step:
- state what you are changing;
- show the files created/changed;
- run tests/typecheck/lint;
- fix failures;
- avoid unrelated refactors.
