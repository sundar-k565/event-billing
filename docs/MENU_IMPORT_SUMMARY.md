# Menu Import Summary

- Categories: 36
- Product records in seed: 205
- Raw seed initially billable flags: 196
- Imported initially billable after review-note validation: 193
- Requires admin confirmation before billing: 10 (7 seed flags + 3 documented beverage conflicts)
- Unpriced seasonal items: 2
- Unresolved modifier rules: 2

The seed deliberately preserves source ambiguity instead of inventing missing prices/variants.

The importer also quarantines food-menu Water, Tonic Water and Ginger ale because these conflicts are explicitly listed in MENU_REVIEW_NOTES.md but not flagged in the raw seed. Source prices and notes remain intact; ADMIN must explicitly confirm and activate them.
