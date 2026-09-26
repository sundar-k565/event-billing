# Local PostgreSQL deployment

The owner requested local PostgreSQL and Docker Compose on 25 September 2026. This supersedes the cloud authentication/hosting sections of the original specifications. Billing, menu, money, ownership, printing, auditing and reporting requirements are unchanged.

The app image contains Next.js and the PostgreSQL client. Compose starts PostgreSQL 16 with a named data volume, runs an idempotent migration/seed/admin initialization container, then starts the app. Database secrets and initial administrator credentials are generated into the ignored `.env` file by `node scripts/local-setup.mjs`. Secrets are never copied into images.

Business migrations under `supabase/migrations/` retain their original checksums. Local identity tables are initialized before those migrations; local session resolution and provisioning functions are applied afterward. The `auth` schema name is retained to preserve existing foreign keys, functions and policies; no Supabase service runs locally.

Runtime uses `waaat_app`, with no ownership, superuser or BYPASSRLS privileges. Business queries set the `authenticated` role and a hashed session token only inside a transaction. Session resolution happens in PostgreSQL; role and active status are re-read from profiles. The runtime cannot directly change bills, items, profiles, account passwords, or audit history. Staff creation is a single administrator-authorized transaction. The bootstrap process does not reset an existing administrator password or overwrite menu edits.

Sessions last 12 hours, use random 256-bit tokens, and store only token hashes. Passwords use salted scrypt. Login attempts are limited per normalized email to ten failures per fifteen minutes. Sign-out revokes the stored session. Cookies are HttpOnly and SameSite=Lax, with Secure enabled through `COOKIE_SECURE=true` for HTTPS. Loopback/trusted LAN HTTP is supported through the explicit local Compose setting `COOKIE_SECURE=false`.

Supabase is a future migration option, not an active dual-backend mode. Adopting it later requires moving identity/accounts and replacing the local session resolver/adapter; the business tables, UUIDs, paise, snapshots and SQL functions are deliberately retained. Do not run the local identity migrations against a hosted Supabase project.

## Restore a backup into a separate fresh deployment

Use a separate checkout and Compose project name for recovery testing. These commands replace only the database in that fresh project; never point them at the active sales deployment.

```sh
node scripts/local-setup.mjs
docker compose -p waaat-recovery up -d db
docker compose -p waaat-recovery run --rm init
docker compose -p waaat-recovery cp ./waaat-backup.dump db:/tmp/waaat.dump
docker compose -p waaat-recovery exec -T db pg_restore -U postgres -d waaat --clean --if-exists --no-owner --exit-on-error /tmp/waaat.dump
docker compose -p waaat-recovery up -d
```

The initializer establishes local roles before restore. Do not pass `--no-acl`: the archive's grants are required for RLS and the application role. Choose a different APP_PORT in the recovery checkout before starting its web app. A restored database keeps the original user passwords and bill sequence; newly generated bootstrap credentials do not overwrite it. Preserve the original backup until recovery is verified.

## Local password recovery

With database-owner access, set `RESET_EMAIL` and `RESET_PASSWORD` in your terminal environment (PowerShell: `$env:RESET_EMAIL`, `$env:RESET_PASSWORD`; POSIX: `export RESET_EMAIL`, `export RESET_PASSWORD`). Then run:

```sh
docker compose run --rm -e RESET_EMAIL -e RESET_PASSWORD init node --import tsx scripts/reset-password.ts
```

The password must be 12–128 characters. This updates only the named account and revokes its existing sessions. Clear the temporary environment variables afterward. This is an owner maintenance operation outside the authenticated application audit trail. It does not change the user's role or reactivate a disabled account.
