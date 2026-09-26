# WAAAT POS

A desktop cashier terminal for WAAAT THE EVENTS. Next.js, TypeScript, Tailwind, local PostgreSQL, local password authentication, and browser receipts. Container images are intended to run on Windows Docker Desktop, macOS, and Linux.

## Run on your own computer

Prerequisites: Docker Desktop running (Linux containers on Windows), Docker Compose v2+, and Node.js 22+ for the one-time secret generator.

```sh
node scripts/local-setup.mjs
docker compose up --build -d
```

Open <http://127.0.0.1:3000/login>. The initial administrator email is **admin@waaat.local**. The randomly generated password is the `BOOTSTRAP_ADMIN_PASSWORD` value in your local **.env** file. Keep it private. Compose starts PostgreSQL, applies migrations, imports the menu, creates the administrator, and starts the POS. The named database volume preserves users and sales when containers restart. `docker compose down` keeps it; never use `docker compose down -v` unless you intend to erase the local database.

## Let a non-technical friend run it on Windows

Your friend does not need the large offline image archive. They need a Windows 10/11 64-bit laptop, Docker Desktop, internet access for the first build, and roughly 4 GB of free memory.

They open <https://github.com/sundar-k565/event-billing>, select **Code → Download ZIP**, extract it, then open `distribution/windows` and double-click `Start-WAAAT.bat`. The launcher creates local passwords, builds the application from the downloaded source, imports a fresh menu, and opens the browser after the app is healthy. First start can take 5–10 minutes; later starts are faster. `WAAAT-Login.txt` contains the locally generated administrator login. Use `Stop-WAAAT.bat` to stop the app. Their database stays on their own laptop; it does not include your current sales database.

For the RP-3160 Gold, they follow `INSTALL-PRINTER.txt` on the Windows computer connected to the printer. The official TVS Windows driver belongs on Windows. In Chrome choose RP-3160 Gold, an 80 mm roll, 100% scale, and disable browser headers/footers. A real receipt test is needed to tune width and cutting.

All of the step-by-step friend instructions are in [distribution/windows/README-FOR-FRIEND.txt](distribution/windows/README-FOR-FRIEND.txt).

## Public container images

Images are published through the GitHub Container Registry workflow in `.github/workflows/publish-containers.yml`. The intended listing is:

- `ghcr.io/sundar-k565/waaat-pos`
- `ghcr.io/sundar-k565/waaat-pos-setup`

It publishes `latest` and release tags such as `v1.0.0`, for AMD64 and ARM64. GitHub packages start private; after the first publication, set each package's visibility to **Public** under GitHub → Packages → package settings. Then anyone can pull/run without a GitHub login. No credentials or sales data are built into either image. The first direct GHCR upload from this machine timed out during blob transfer, so the public packages are not yet listed; the Windows download below is self-contained and works without GHCR.

A Windows AMD64 release archive includes its app/initializer image tags and the matching PostgreSQL image so the friend bundle can start without depending on a public listing. To load the archive on Windows, the launcher runs `docker image load` automatically.

To publish, commit/push the source changes to the `event-billing` GitHub repo, then create and push tag `v1.0.0`. The GitHub Action builds/publishes both multi-architecture images. GitHub packages start private; the repository owner must change both packages to Public after first publication.

## Local administration and backup

Create staff from **Users** and give each cashier a STAFF account. Keep the generated owner sign-in private. Business records stay in the PostgreSQL Docker volume; back them up regularly before using this for real sales. The named volume retains sales across ordinary container updates. Do not delete it.

Use **Menu → Show items needing review** before the event. The seed imports 36 categories and 205 products: 193 billable, 10 awaiting confirmation, two seasonal/unpriced products. Source conflicts are documented in [MENU_REVIEW_NOTES.md](docs/MENU_REVIEW_NOTES.md).

## Cashier operation and recovery

Choose products, adjust quantities, select CASH/UPI/CARD, then Save & Print. The server reads current database prices and saves the bill before the browser prints. A print failure never removes a bill. For an uncertain save, retry with the same key; refresh keeps the cart/pending save. Check bill history before re-entering a sale if a tab was lost.

STAFF can reprint their own bills. ADMIN can access all bills, reports, menu/settings, users, and voids. A void requires a reason and stays in history, excluded from sales. Reports use Asia/Kolkata business-day boundaries. Sessions expire after 12 hours.

## Verify

```sh
npm run seed:validate
npm test
npm run test:db
npm run test:auth
npm run typecheck
npm run lint
npm run build
npm run format:check
E2E_PRODUCTION=1 npm run test:e2e
```

The PostgreSQL and authentication integration tests use isolated temporary databases. Browser tests use Chrome and the same local-auth code as the Windows image. None use a real project database or sales volume.

## Architecture

The production runtime is a modular Next.js server, local PostgreSQL 16, database migrations and browser printing. Passwords use salted scrypt; opaque sessions are stored as hashes in Postgres, with RLS on all business tables. Financial mutations use SQL transactions. See [LOCAL_POSTGRES.md](docs/LOCAL_POSTGRES.md).

Supabase/Vercel are deferred feature-release options and are not required for this local release. The physical RP-3160 Gold printer still needs a real Windows test print; see [PRINTING.md](docs/PRINTING.md).
