# Product Requirements Document — WAAAT POS V1

## 1. Product overview

WAAAT POS is a small web-based point-of-sale application for a Saturday-night pub event operated from one Windows computer.

The application must allow staff to:
- select food, alcohol, cocktails, shots, and non-alcoholic drinks;
- create a bill quickly;
- choose Cash, UPI, or Card as the payment method;
- save the completed bill;
- print a simple receipt;
- reprint a saved receipt.

The owner (ADMIN) must be able to:
- see sales/reporting information;
- view bill history;
- reprint receipts;
- manage menu items and prices;
- manage users/settings;
- void completed bills.

The application is intentionally small. Inventory and advanced restaurant/POS capabilities are future scope.

## 2. Goals

### Primary goals
1. Replace paid billing software for the event.
2. Make bill creation fast during a busy Saturday night.
3. Persist every completed bill reliably.
4. Print a simple receipt from a Windows computer.
5. Give the owner basic daily sales visibility.
6. Keep a clean audit trail for voids and price changes.
7. Make the system easy to deploy and maintain on Vercel.

### Secondary goals
- Keep menu and prices configurable without code changes.
- Preserve historical bill prices when menu prices change.
- Provide a clean path to future inventory support.

## 3. Non-goals for V1

Do NOT implement:
- liquor/food inventory management;
- recipe/ingredient inventory;
- procurement/purchase management;
- customer loyalty;
- table management;
- online ordering;
- delivery;
- payment gateway integration;
- automatic tax computation;
- split tender / multiple payment methods on one bill;
- accounting/ERP integration;
- mobile app;
- multi-branch support;
- offline synchronization;
- complex discount/promotions engine.

## 4. Assumptions

- Country: India.
- State: Tamil Nadu.
- One Windows billing computer.
- Reliable internet is available at the venue.
- The application is hosted on Vercel.
- Data is stored in Supabase PostgreSQL.
- Alcohol pricing is menu-defined; distilled spirit menu prices represent a fixed 30 ml serving.
- Food prices are the menu-defined prices.
- No tax/charge labels are being used for this event; V1 does not calculate tax/charges.
- Business branding should be configurable. Default display name: `WAAAT THE EVENTS`.
- Receipt footer default: `PLEASE DRINK RESPONSIBLY`.
- Printer model is still TBD; initial implementation uses browser print.

## 5. Users and permissions

### ADMIN
Owner-level access:
- Billing
- View all bills
- Reprint all bills
- View reports
- Manage products/categories
- Change prices
- Activate/deactivate products
- Manage users
- Void completed bills
- View audit history

### STAFF
Operational access:
- Login
- Create bills
- Remove/change cart quantities before saving
- Select Cash/UPI/Card
- Complete a bill
- Print receipt
- Reprint receipts needed for operations

Staff must NOT:
- access reports;
- change prices;
- change menu/category settings;
- void completed bills;
- manage users;
- access administrative settings.

## 6. Core user stories

### Staff — create bill
As staff, I want to select menu items by category and add quantities quickly so I can complete a customer bill with minimal typing.

### Staff — pay and print
As staff, I want to select Cash, UPI, or Card and save/print the bill in one action.

### Staff — correct cart before completion
As staff, I want to increase/decrease quantities or remove an item before completing the bill.

### Admin — view sales
As the owner, I want to see today's bill count, total sales, and payment breakdown.

### Admin — inspect bill
As the owner, I want to search a bill by bill number/date/payment method and open or reprint it.

### Admin — void bill
As the owner, I want to void an incorrect completed bill while keeping the bill number and audit information.

### Admin — manage menu
As the owner, I want to change item prices or deactivate items without editing application code.

## 7. Functional requirements

### FR-01 Authentication
- Every operator must authenticate.
- A user has exactly one application role: ADMIN or STAFF.
- Sessions persist so staff do not need to re-enter credentials for every bill.
- Logout must be available.

### FR-02 POS screen
- Default screen after login for STAFF is the billing/POS screen.
- Category buttons must be visible.
- Products must be shown as large buttons with name and price.
- A search field may be used as a secondary shortcut for long menus.
- Selecting a product adds it to the cart.
- Selecting an existing product again increments quantity.

### FR-03 Cart
- Each line shows product name, quantity, unit price, and line total.
- User can increment/decrement quantity.
- Quantity cannot fall below zero.
- Zero quantity removes the line.
- Subtotal is calculated using exact integer money arithmetic.
- V1 has no tax, discount, or extra charge calculation.
- Total = subtotal.

### FR-04 Payment
Supported payment methods:
- CASH
- UPI
- CARD

Only one payment method is allowed per completed bill in V1.

### FR-05 Bill completion
- Clicking Save & Print must validate that the cart is non-empty and a payment method is selected.
- Bill creation is atomic.
- A unique bill number is assigned by the database.
- Format: `WAAAT-0001`.
- Voided bill numbers are never reused.
- Completed bill contains immutable line-item snapshots of product name and price.
- After save, the cart is cleared for the next customer.

### FR-06 Printing
- Persist the bill before attempting to print.
- Use a dedicated print view / print CSS.
- A printer failure must not mark the bill as failed.
- User can reprint an existing bill.
- Printer model-specific integration is deferred until the exact model is known.

### FR-07 Bill history
- ADMIN can view/search all bills.
- STAFF can access operational reprint functionality but not aggregate reports/settings.
- Search/filter by bill number, date, payment method, and status.
- Bill status: COMPLETED or VOID.

### FR-08 Void
- Staff cannot void a completed bill.
- ADMIN can void a completed bill.
- Voiding requires a reason.
- Voiding preserves the bill record and bill number.
- Voided bills are excluded from sales totals.
- Void action is recorded in the audit log.

### FR-09 Menu management
ADMIN can:
- add a category;
- add a product;
- change product price;
- change product display name;
- change category;
- change sort order;
- activate/deactivate product.

Historical bill item snapshots must not change when the product is later edited.

### FR-10 Dashboard/report
Today's ADMIN dashboard must show:
- completed bill count;
- completed sales total;
- Cash total;
- UPI total;
- Card total;
- void count;
- void amount;
- top-selling items by quantity.

### FR-11 Daily report
ADMIN can select a date and view:
- completed bill count;
- gross completed sales;
- payment breakdown;
- top-selling products;
- void count and voided amount.

Daily reporting uses `Asia/Kolkata` boundaries.

## 8. Business rules

1. Price is always read from the current product record when a new bill line is added.
2. Once a bill is completed, the bill item stores the sold product name and unit price as a snapshot.
3. Completed bills are immutable except for ADMIN void metadata/status.
4. Product deletion is not allowed when a product has historical sales; deactivate instead.
5. Bill numbers are never reused.
6. No tax or charge is calculated in V1.
7. No inventory deduction occurs in V1.
8. No split payments in V1.
9. Staff cannot alter the total directly.
10. Discount is not a V1 feature.
11. Print is an output operation after persistence, not part of the transaction.
12. All monetary values use exact integer arithmetic.

## 9. Error handling

### Expected errors
- Network/database unavailable
- Invalid session
- Permission denied
- Empty cart
- Missing payment method
- Product is inactive
- Duplicate submission
- Print dialog cancelled / printer unavailable

### Required behavior
- Never lose a successfully saved bill because printing failed.
- Never create two bills because Save & Print was clicked twice.
- Show a clear message when a product becomes inactive while the POS is open; do not allow it to be newly added.
- If bill save fails, keep the current cart visible so staff can retry.

## 10. Reporting rules

- Only `COMPLETED` bills count toward sales.
- `VOID` bills do not contribute to revenue totals.
- Payment totals must sum to completed sales.
- Top-selling quantity is calculated from completed bill items only.
- Reports use venue-local day boundaries in `Asia/Kolkata`.

## 11. Acceptance summary

V1 is accepted when a staff user can:
1. log in;
2. choose a category;
3. add products;
4. change quantities;
5. choose Cash/UPI/Card;
6. save a bill;
7. receive a unique WAAAT bill number;
8. print the receipt;
9. create the next bill immediately.

V1 is accepted when an admin can:
1. view today's totals;
2. search and reprint a bill;
3. change a menu price;
4. confirm that historical bills retain the original price;
5. void a bill with a reason;
6. see the void excluded from sales totals.
