# V1 implementation decisions

## Current local release

On 25 September 2026 the owner requested local PostgreSQL and Docker Compose, deferring Supabase to future releases. [LOCAL_POSTGRES.md](LOCAL_POSTGRES.md) supersedes the cloud-auth/deployment decisions below. Existing business migrations and billing contracts are preserved; runtime data access now uses `pg` with session-backed RLS and real local password authentication. Browser tests no longer use a simulated Supabase adapter.

The starting repository contained specifications, JSON data and a ZIP, with no application. The ZIP's documents are restored at their documented paths. Original root files are preserved as reference copies; `docs/`, `data/` and `supabase/migrations/` are authoritative for the implementation.

## Schema adaptations (before implementation)

- Nullable `products.price_paise` represents seasonal/unpriced products. Active products require a non-null, non-negative integer price and must not need confirmation.
- Profiles have `active` and `email`. An auth trigger creates STAFF profiles; user metadata never determines role. The initial ADMIN is promoted with an operator-run SQL command. In-app administration cannot deactivate/demote the final active administrator.
- Settings are one row with business display name and receipt footer. Receipt branding and unit labels are snapshotted at sale alongside product names/prices.
- Seed records have an immutable import key and source notes. Reseeding is insert-only and never restores old prices over admin edits.
- Review notes identify Water, Tonic Water and Ginger ale in the food menu as conflicting, although the seed flags omit them. Import quarantines these three in addition to the seven explicitly flagged records. Both source prices are retained. Thus 193 initially billable, 10 awaiting confirmation, and 2 seasonal products (205 total).
- STAFF can list and reprint their own bills. ADMIN can access all bills. This gives an explicit least-privilege interpretation of “operational reprint”; use the same operator account for shift reprints or request admin assistance.
- PostgreSQL functions own all financial mutations. Direct authenticated writes to bills/items/profiles are denied. An idempotency key is global, bound to actor and canonical request; reuse with different items/payment is a conflict. Transaction advisory locking serializes retries; a sequence provides non-reusable numbers (gaps after rollback are allowed).
- Row locks keep product/category state stable during billing. Paise are PostgreSQL bigint and JavaScript BigInt; JSON money fields are decimal strings to avoid precision loss. Quantities are integers 1–999, max 200 distinct lines; money inputs are bounded to safe storage limits.
- Completed bill rows/items cannot be deleted or edited. Only a one-way COMPLETED → VOID transition with admin metadata is allowed. Audit rows are append-only.
- Reports aggregate in PostgreSQL in one statement, avoiding API row limits and inconsistent payment totals. A local day is midnight to midnight in Asia/Kolkata; void metrics refer to bills created on that day.
- A browser session stores a per-user cart and an exact pending submission before sending. An uncertain network outcome locks cart editing until retry resolves the original key. Validation failures unlock the cart. Printing happens after persistence and is independently retryable.
- User creation uses the server-only Auth admin API with an initial password; no email invitation is sent. An inactive profile is created first, then an authenticated admin RPC activates/configures it with audit logging. Failed activation leaves a visible inactive user that can be repaired.
- Auth cookies are HttpOnly, SameSite=Lax, and Secure in production: all authentication goes through server endpoints and the browser never needs direct access to tokens. Proxy refresh uses the same cookie options. Incoming Host, rather than Next's internally normalized URL host, is used for same-origin mutation validation.
- Catalog/user reads traverse PostgREST pages instead of silently stopping at its row cap. Report aggregates remain inside PostgreSQL. Production builds use Next.js's supported Webpack builder after a local Turbopack process/port restriction; this does not change runtime architecture.

## Framework references

- [Next.js documentation](https://nextjs.org/docs)
- [Supabase SSR cookie clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Verified Supabase users](https://supabase.com/docs/reference/javascript/auth-getuser)
- [PostgreSQL transaction and advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html)
