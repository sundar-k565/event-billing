# WAAAT POS V1 — UI Specification

## 1. Visual direction

The existing alcohol menu uses a dark event/premium-club style with magenta/pink accents. The POS should borrow only the broad visual language:
- dark background;
- high-contrast text;
- magenta accent for selected states;
- simple cards/buttons.

The POS is a functional cashier terminal, not a marketing website.

## 2. Routes

### Public
- `/login`

### Authenticated
- `/pos`

### Admin
- `/admin`
- `/admin/bills`
- `/admin/reports`
- `/admin/menu`
- `/admin/settings/users`
- `/admin/settings`

## 3. Login

Fields:
- Email
- Password

Buttons:
- Sign in

After login:
- STAFF -> `/pos`
- ADMIN -> `/admin`

## 4. POS layout

Desktop-first layout:

```text
+------------------------------------------------------------------+
| WAAAT POS                              User   Logout              |
+-------------------------------+----------------------------------+
| CATEGORY / PRODUCT AREA       | CURRENT BILL                    |
|                               |                                  |
| [Whisky] [Vodka] [Beer]      | Teachers 30ml  2   ₹798  [-][+]|
| [Gin] [Brandy] [Rum]         | Mojito          1   ₹299  [-][+]|
| [Shots] [Cocktails]          |                                  |
|                               | Chicken Wings   1   ₹200  [-][+]|
| [Starters] [Chicken]         |                                  |
| [Seafood] [Rice]              | ------------------------------   |
| [Noodles] [Gravy]             | TOTAL                        ₹1297|
| [Breads] [Beverages]          |                                  |
|                               | [ CASH ] [ UPI ] [ CARD ]       |
|                               |                                  |
| Search products...            | [ SAVE & PRINT ]                |
+-------------------------------+----------------------------------+
```

## 5. Product interaction

- Category click opens the category's products.
- Product button shows name + price.
- Repeated click increments quantity.
- Cart quantity controls adjust quantity.
- Product price in UI comes from DB.
- Inactive/unconfirmed items are not selectable.

## 6. POS keyboard/mouse UX

Optional but recommended:
- focus search field with a shortcut;
- `Esc` closes overlays;
- Enter activates focused button;
- prevent accidental duplicate Save & Print clicks while request is in progress.

Do not make keyboard shortcuts necessary for basic use.

## 7. Payment state

Payment buttons:
- Cash
- UPI
- Card

Selected payment method has a clear visual state.
Save & Print is disabled until:
- cart has at least one item;
- payment method selected;
- bill submission is not already in progress.

## 8. After successful bill

Display:
- Bill number
- total
- payment method
- Print success/open print dialog

Then:
- clear cart;
- prepare next bill.

## 9. Admin dashboard

```text
+--------------------------------------------------------------+
| WAAAT ADMIN                                                  |
+--------------------------------------------------------------+
| TODAY                                                        |
| Bills: 47                 Sales: ₹32,450                     |
|                                                              |
| Cash: ₹8,500   UPI: ₹18,450   Card: ₹5,500                 |
|                                                              |
| Voided bills: 1            Voided amount: ₹1,250             |
|                                                              |
| TOP SELLING                                                  |
| Mojito              12                                      |
| Kingfisher            9                                      |
| Chicken Wings         8                                      |
|                                                              |
| [BILLS] [DAILY REPORT] [MENU] [USERS/SETTINGS]              |
+--------------------------------------------------------------+
```

## 10. Bill detail

Show:
- bill number;
- date/time;
- operator;
- items;
- quantities;
- stored unit prices;
- subtotal;
- total;
- payment method;
- status.

Buttons:
- Reprint
- ADMIN: Void

## 11. Menu management

Table columns:
- Product
- Category
- Price
- Unit
- Active
- Actions

Actions:
- Edit
- Activate/Deactivate

Price editing should show old price and new price before save.

## 12. Mobile

Not a V1 target.
The application should remain usable on desktop Windows Chrome. A basic responsive layout is fine but do not optimize the project around mobile.
