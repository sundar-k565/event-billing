# WAAAT POS V1 — Printing Specification

## TVS RP-3160 Gold on Windows

The web app uses the normal Windows browser print dialog. Install the TVS Windows printer driver on the computer that opens the receipt; Docker does not install USB drivers. Official TVS specifications list an 80 mm roll, USB/serial interfaces, and 160 mm/s print speed. The receipt print CSS uses 72 mm of content within the 80 mm roll, leaving room for side margins.

Download the official **SETUP RP3160 GOLD V1.01** package from the [TVS RP-3160 Gold product page](https://www.tvs-e.in/thermal-receipt-printers/rp-3160-gold/). Extract the ZIP, run its setup program, and follow its prompts. Connect the printer by USB when requested. The friend setup pack includes a click-by-click Windows guide.

In Chrome, choose the RP-3160 Gold, an 80 mm roll size, 100% scale, and disable browser headers/footers. Save a test bill and reprint until the width and cut look right. A test print on the exact Windows computer and printer is still required; no physical printer test has been performed.

## Goal
Print a simple customer receipt from a Windows computer using the installed local printer.

## Initial strategy
Use browser printing with a dedicated receipt route and CSS `@media print`.

Flow:
1. Save bill to database.
2. Navigate/open print view for that bill.
3. Call `window.print()`.
4. Windows shows the configured printer.
5. User confirms print.
6. If printing fails, bill remains COMPLETED and can be reprinted.

## Receipt content

Default:

```text
WAAAT THE EVENTS

Bill: WAAAT-0001
Date: 25-Sep-2026
Time: 22:18

--------------------------------
Item                 Qty   Amt
--------------------------------
Teachers 30ml          2   798
Mojito                 1   299
Chicken Wings          1   200
--------------------------------
TOTAL                     1297

Payment: UPI

PLEASE DRINK RESPONSIBLY
```

## Print rules
- No tax line in V1.
- No inventory line.
- No decorative background image required.
- Black text on white print background is acceptable even if the web app is dark.
- Use a narrow receipt layout and wrapping-safe item names.
- Ensure page margins are controlled.
- Hide browser navigation/UI elements using print CSS.

## Printer dependency
Exact printer model is still unknown.
Before production use:
- confirm printer model;
- determine whether it is thermal, A4, 58mm, 80mm, USB, LAN, etc.;
- test print alignment, page width, margins, character rendering, and paper cut behavior.

Do not add proprietary printer SDKs unless the actual model requires it.
