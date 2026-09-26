# WAAAT POS V1 — Implementation Plan

## Phase 0 — Project bootstrap
- Create Next.js TypeScript app.
- Configure Tailwind CSS.
- Configure ESLint/Prettier if desired.
- Create `.env.example`.
- Create Supabase project config.
- Add `AGENTS.md` and `/docs`.

## Phase 1 — Database + auth
- Create tables/migrations.
- Configure RLS.
- Add profiles and roles.
- Create one ADMIN account and at least one STAFF account.
- Add server-side authorization helpers.

## Phase 2 — Menu
- Import `data/MENU_SEED.json`.
- Create categories/products.
- Keep `needs_confirmation` records inactive.
- Verify all menu prices before event.

## Phase 3 — POS
- Build login.
- Build category/product navigation.
- Build cart.
- Build quantity editing.
- Build payment selection.
- Add server-side total calculation.

## Phase 4 — Bill creation
- Implement transactional bill creation.
- Implement bill number generation.
- Implement idempotency.
- Implement bill history.
- Implement receipt detail view.

## Phase 5 — Printing
- Implement print CSS.
- Implement receipt view.
- Test against the real Windows printer.
- Tune receipt width after printer model is known.

## Phase 6 — Admin
- Dashboard.
- Daily report.
- Bill search.
- Reprint.
- Void flow.
- Menu/price management.
- User management.

## Phase 7 — Hardening
- Add automated tests.
- Add authorization tests.
- Add money calculation tests.
- Add seed validation.
- Test duplicate submission.
- Test void/report interaction.
- Test historical price snapshots.
- Test print failure behavior.

## Phase 8 — Deployment
- Push to GitHub.
- Deploy to Vercel.
- Configure production environment variables.
- Configure Supabase production policies.
- Perform one end-to-end bill in production.
- Print physical receipt.
- Verify daily report.

## Definition of done
The project is not done when the UI looks correct. It is done when the complete workflow works in the actual venue environment:
login → bill → payment selection → database save → bill number → physical print → reprint → admin report.
