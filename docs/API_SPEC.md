# WAAAT POS V1 — API / Server Contract

Use Next.js route handlers or server actions. Keep business rules on the server.

## Implemented contract notes

The endpoints below are implemented by the App Router catch-all handler. All monetary fields are **decimal strings containing integer paise**, including the numeric examples below (e.g. `"totalPaise": "129700"`). This keeps PostgreSQL bigint exact in JSON/JavaScript. Writes require same-origin JSON. Error responses are `{ "error": "message" }` with 401/403/404/409/422/503 as appropriate. A 503 or lost response during save is an uncertain outcome: retry the identical idempotency key.

STAFF can list/view/reprint their own bills only. ADMIN can access all. History pages contain 50 bills and return `{ bills, total, page }`; bill-number filtering is an exact, case-insensitive match. Receipt items include saved unit labels, and bills include branding/footer snapshots.

Additional ADMIN routes: `GET /api/admin/menu`, `GET|POST /api/admin/users`, `PATCH /api/admin/users/:id`, `GET|PATCH /api/admin/settings`, `GET /api/admin/audit?page=1`. User creation accepts `email`, `password` (12+ characters), and `display_name`, creates STAFF, and sends no email. User updates require `display_name`, `role`, and `active`. Settings expose `display_name` and `receipt_footer`. Product/category writes use documented database snake_case fields; product prices are string paise or null. Product confirmation is an explicit ADMIN update to `needs_confirmation=false` with a valid price before activation. All these writes are audited transactionally in PostgreSQL.

## Auth
Authentication now uses local PostgreSQL accounts and opaque HttpOnly session cookies. `POST /api/auth/login` accepts email/password; `POST /api/auth/logout` revokes the session. Login throttling returns 429. Supabase Auth is deferred to a future release. Existing business API contracts remain unchanged.

The server determines the current user and role from the authenticated session/profile. Never accept `role=ADMIN` from the browser as authoritative.

## 1. GET /api/menu

Purpose: retrieve active billable categories/products.

Response shape:
```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "Imported Whisky",
      "groupType": "ALCOHOL",
      "products": [
        {
          "id": "uuid",
          "name": "Teachers",
          "pricePaise": 39900,
          "unitLabel": "30 ml"
        }
      ]
    }
  ]
}
```

Rules:
- Return only active products.
- Do not return `needs_confirmation=true` items as billable products.

## 2. POST /api/bills

Purpose: create a completed bill.

Request:
```json
{
  "idempotencyKey": "uuid",
  "paymentMethod": "UPI",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2
    }
  ]
}
```

Server responsibilities:
1. Authenticate user.
2. Confirm STAFF or ADMIN role.
3. Validate `idempotencyKey`.
4. Load current active products from DB.
5. Reject missing/inactive/unconfirmed products.
6. Calculate line totals and subtotal on server.
7. Create bill + bill_items in one transaction.
8. Generate unique bill number.
9. Write required audit event if applicable.
10. Return the saved bill.

Response:
```json
{
  "bill": {
    "id": "uuid",
    "billNumber": "WAAAT-0001",
    "status": "COMPLETED",
    "paymentMethod": "UPI",
    "subtotalPaise": 129700,
    "totalPaise": 129700,
    "createdAt": "..."
  }
}
```

## 3. GET /api/bills/:id

Purpose: retrieve a bill for viewing/reprint.

Authorization:
- ADMIN: any bill.
- STAFF: operationally permitted bill access only.

The returned bill must use the stored bill-item snapshots.

## 4. GET /api/bills

Purpose: bill history.

Filters:
- `date`
- `paymentMethod`
- `status`
- `billNumber`
- pagination

Authorization:
- ADMIN: full history.
- STAFF: restricted operational access.

## 5. POST /api/bills/:id/void

ADMIN only.

Request:
```json
{
  "reason": "Wrong items entered"
}
```

Rules:
- Bill must currently be COMPLETED.
- Never delete the bill.
- Set status to VOID.
- Record reason, actor, timestamp.
- Write audit log.
- Do not allow voiding an already VOID bill.

## 6. GET /api/reports/daily

ADMIN only.

Query:
`?date=YYYY-MM-DD`

Response:
```json
{
  "date": "2026-09-24",
  "completedBills": 47,
  "completedSalesPaise": 3245000,
  "paymentBreakdown": {
    "CASH": 850000,
    "UPI": 1845000,
    "CARD": 550000
  },
  "voidCount": 1,
  "voidedAmountPaise": 125000,
  "topItems": [
    {
      "productName": "Mojito",
      "quantity": 12,
      "salesPaise": 358800
    }
  ]
}
```

Only COMPLETED bills contribute to completed sales.

## 7. Admin menu endpoints

ADMIN only:
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:id`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`

Price changes must record an audit event with old and new price.

## 8. Users

ADMIN only:
- list users;
- create/invite staff;
- change role;
- deactivate user.

The exact UI can be simple; do not expose Supabase administrative secrets to the browser.
