# WAAAT POS — Codex Repository Instructions

## Mission
Build a small, reliable, browser-based POS/billing application for WAAAT THE EVENTS, operated on one Windows computer at a Saturday-night pub event.

Read these files before making implementation decisions:
1. `docs/PRD.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DATA_MODEL.md`
4. `docs/API_SPEC.md`
5. `docs/UI_SPEC.md`
6. `docs/PRINTING.md`
7. `docs/ACCEPTANCE_TESTS.md`
8. `data/MENU_SEED.json`
9. `docs/MENU_REVIEW_NOTES.md`

## Non-negotiable rules
- Use Next.js + TypeScript + Tailwind CSS.
- Current owner decision: deploy locally with Docker Compose and PostgreSQL; Supabase/Vercel are deferred to future releases. See docs/LOCAL_POSTGRES.md.
- Use local password authentication and database-backed sessions with the existing SQL billing functions and RLS.
- One billing machine; reliable internet is assumed for V1.
- Staff can create bills and print/reprint receipts.
- Only ADMIN can access reports, menu/prices, user/settings, and void completed bills.
- Never trust client-side role checks. Enforce authorization on the server and with database policies/RLS where applicable.
- Product prices come from the database. Never hard-code menu prices in UI components.
- Use integer paise (`bigint`) or another exact integer money representation. Never use floating-point arithmetic for money.
- Store timestamps as `timestamptz`; reports must use `Asia/Kolkata` local-day boundaries.
- Completed bills are immutable except for an ADMIN void operation.
- Never hard-delete completed/voided bills or products that appear on historical bills.
- Bill numbers are sequentially formatted as `WAAAT-0001`, `WAAAT-0002`, ... . Voided numbers are never reused.
- Bill creation must be transactional and protected against accidental double-submission/idempotency retries.
- Saving a bill must not depend on printer success. Persist the bill first, then print. A print failure must leave a completed bill that can be reprinted.
- V1 has no inventory, no discount engine, no split payment, no customer accounts, and no tax calculation.
- Do not infer or add tax/excise/legal rules. Tax/charge computation is explicitly disabled for this event.
- Keep the implementation small. Prefer a simple, maintainable monolith over abstractions that do not solve a real requirement.
- Do not add cloud queues, Redis, microservices, Kubernetes, background workers, payment gateway integrations, or a mobile app.

## Menu data rules
- Treat `data/MENU_SEED.json` as the initial menu import source.
- Do not silently reconcile conflicting source prices. See `docs/MENU_REVIEW_NOTES.md`.
- Items marked `needs_confirmation` must not become active billable products until an admin confirms the intended price.
- Seasonal items without a numeric price remain inactive/unpriced until configured by ADMIN.
- The supplied food PDF contains a duplicated `Seasame Honey Lotus Stem` line. Do not create duplicate active buttons.
- `Schezwan (₹20 extra)` is not a standalone product price; treat it as a documented unresolved modifier rule rather than inventing a product price.

## UX priorities
Fast billing > visual complexity.
Primary workflow:
Login → category → item → quantity → payment method → save → print.
Make buttons large and usable with a mouse on Windows.
Use browser printing with print CSS. Do not depend on proprietary printer SDKs until the exact printer model is known.

## Development workflow
- Implement in small vertical slices.
- Add tests for money calculations, role enforcement, bill numbering, voiding, and reporting.
- Keep database migrations deterministic.
- Use environment variables for secrets. Never commit Supabase service-role keys.
- Before changing schema or requirements, update the relevant docs first.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
