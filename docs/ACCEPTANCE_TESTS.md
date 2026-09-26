# WAAAT POS V1 — Acceptance Tests

## Authentication
- [ ] STAFF can log in.
- [ ] ADMIN can log in.
- [ ] Invalid credentials are rejected.
- [ ] STAFF cannot directly access admin routes.
- [ ] STAFF cannot call admin APIs successfully.
- [ ] ADMIN can access admin APIs.

## Menu
- [ ] Active products are shown.
- [ ] Inactive products are hidden from POS.
- [ ] Needs-confirmation products are hidden from POS.
- [ ] Product button displays the database price.
- [ ] Changing product price affects new bills only.

## Cart
- [ ] First product click adds quantity 1.
- [ ] Second click increments quantity.
- [ ] Quantity can be decreased.
- [ ] Zero quantity removes the line.
- [ ] Line total = quantity × unit price.
- [ ] Subtotal equals the sum of line totals.
- [ ] Total equals subtotal in V1.

## Bill creation
- [ ] Cannot save an empty cart.
- [ ] Cannot save without payment method.
- [ ] Cash works.
- [ ] UPI works.
- [ ] Card works.
- [ ] Bill number format is WAAAT-0001.
- [ ] Next bill number increments.
- [ ] Bill numbers are unique.
- [ ] Double-clicking Save & Print does not create duplicate bills.
- [ ] Completed bill persists after refresh.
- [ ] Bill item stores product name snapshot and unit price snapshot.

## Printing
- [ ] Saved bill opens print view.
- [ ] Receipt contains business name, bill number, time, items, total, payment method, and footer.
- [ ] Printing failure does not change bill status.
- [ ] Existing bill can be reprinted.

## Void
- [ ] STAFF cannot void.
- [ ] ADMIN can void a COMPLETED bill.
- [ ] Void requires a reason.
- [ ] VOID bill remains in history.
- [ ] VOID bill number is not reused.
- [ ] VOID bill does not contribute to sales totals.
- [ ] Void action appears in audit log.

## Menu administration
- [ ] ADMIN can create a product.
- [ ] ADMIN can change price.
- [ ] ADMIN can deactivate a product.
- [ ] ADMIN can reactivate a product.
- [ ] Historical bills retain old product name/price snapshots.
- [ ] Price changes create an audit entry.

## Reports
- [ ] Today's completed bill count is correct.
- [ ] Today's sales total excludes VOID bills.
- [ ] CASH total is correct.
- [ ] UPI total is correct.
- [ ] CARD total is correct.
- [ ] Payment totals sum to completed sales.
- [ ] Top-selling items are based on completed bills only.
- [ ] Local date boundaries use Asia/Kolkata.

## Resilience
- [ ] If save succeeds but printing is cancelled, bill remains COMPLETED.
- [ ] If save fails, the current cart remains available for retry.
- [ ] If an inactive product was already visible in a stale browser tab, the server rejects adding it to a new bill.
