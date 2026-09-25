# WAAAT POS V1 — Architecture

## 1. Architecture style

Use a small modular monolith:
- Next.js application
- Supabase Auth
- Supabase PostgreSQL
- Vercel hosting
- Browser-based printing

Do not introduce microservices.

## 2. System diagram

```mermaid
flowchart LR
    U[Staff / Admin] --> B[Windows PC - Chrome]
    B --> N[Next.js App on Vercel]
    N --> A[Supabase Auth]
    N --> D[(Supabase PostgreSQL)]
    B --> P[Windows Print Dialog]
    P --> PR[Local Printer]

    subgraph Vercel
        N
    end

    subgraph Supabase
        A
        D
    end

    subgraph Venue
        B
        P
        PR
    end
```

## 3. Logical component diagram

```mermaid
flowchart TB
    UI[POS UI / Admin UI]
    AUTH[Auth + Session]
    POS[POS Service]
    BILL[Bill Service]
    REPORT[Report Service]
    MENU[Menu Service]
    AUDIT[Audit Service]
    DB[(PostgreSQL)]

    UI --> AUTH
    UI --> POS
    UI --> BILL
    UI --> REPORT
    UI --> MENU

    POS --> BILL
    MENU --> BILL
    BILL --> AUDIT
    REPORT --> DB
    POS --> DB
    BILL --> DB
    MENU --> DB
    AUDIT --> DB
```

## 4. Billing sequence

```mermaid
sequenceDiagram
    participant S as Staff
    participant UI as POS UI
    participant API as Next.js Server
    participant DB as Supabase DB
    participant PR as Windows Printer

    S->>UI: Select category
    S->>UI: Select product
    UI->>UI: Update cart
    S->>UI: Select payment method
    S->>UI: Save & Print
    UI->>API: Create bill + idempotency key
    API->>DB: Validate user role
    API->>DB: Read current prices
    API->>DB: Create bill + items atomically
    DB-->>API: Bill number + saved bill
    API-->>UI: Success
    UI->>PR: Open browser print dialog
    PR-->>UI: Print success/failure
    UI->>S: Bill completed; reprint available
```

## 5. Key design decisions

### Decision 1 — Vercel + Supabase
Chosen because the application is small, cloud-hosted, and operates from one computer with reliable internet.

### Decision 2 — Browser printing
The initial implementation uses a print-friendly receipt route and `window.print()`/print CSS. This avoids a native desktop wrapper.

### Decision 3 — Database owns bill numbering
Use a PostgreSQL sequence or transactional numbering mechanism. The format layer turns a numeric value into `WAAAT-%04d`.

### Decision 4 — Snapshot prices on bill items
Historical bills must remain correct even after menu price changes.

### Decision 5 — No inventory in V1
Inventory is deliberately excluded to keep the first release small.

### Decision 6 — No tax engine
Tax/charge calculation is disabled for this event. The data model should leave room for future charge/tax fields without implementing them now.

### Decision 7 — Server-side authorization
The browser may hide admin UI from staff, but permissions must also be enforced by server code and database policies.

## 6. Deployment

```mermaid
flowchart LR
    G[GitHub Repository] --> V[Vercel Deployment]
    V --> S[Supabase Project]
    W[Windows PC] --> V
```

## 7. Environment variables

Expected examples:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

If a server-only Supabase service key is ever used, it must be server-only and never exposed to browser code. Prefer RLS and authenticated server clients where practical.

## 8. Reliability

- Database is the source of truth for completed bills.
- Printing is secondary.
- Reprint is always possible after a bill is saved.
- Double-click / retry protection is required.
- Financially meaningful writes must be transactional.
