# Menu Import Review Notes

## Sources
- Alcohol/bar menu: uploaded WAAAT THE EVENTS menu card image.
- Food menu: uploaded 14-page PDF.

The food menu PDF contains sections including soups/salads, Retro Special, Momos/Wings, starters, chicken, tikka/rice, fried rice, noodles, gravies, ice cream/juice, and beverages.

## Important source conflicts / ambiguities

### 1. Beverage price conflicts
The WAAAT alcohol menu and the Retro Club food PDF contain different prices for several overlapping beverage names:

| Item | WAAAT alcohol menu | Food PDF |
|---|---:|---:|
| Water | ₹100 | ₹25 |
| Soda | ₹99 | ₹30 |
| Tonic Water | ₹179 | ₹100 |
| Ginger ale | ₹179 | ₹100 |
| Red Bull | ₹199 | ₹200 |

The WAAAT alcohol menu also has:
- All juices (by glass) ₹149
- Soft drinks (by glass) ₹149

The food PDF separately lists named juices with prices:
- Lemon Juice ₹49
- Watermelon ₹79
- Lemon Soda (Salt / Sweet) ₹79
- Pineapple ₹99
- Canned Juice ₹99

Do not silently merge these. The event operator must confirm which set is authoritative for the actual event.

### 2. Duplicate food line
`Seasame Honey Lotus Stem` appears twice in the food PDF at ₹270.
The seed should contain only one active product and keep the duplicate noted for review.

### 3. Seasonal prices
`Butter Garlic Lobster` and `Pepper Crab` are marked `Seasonal` instead of having a numeric price.
They must remain inactive/unpriced until ADMIN configures a price.

### 4. Schezwan extra
The food menu contains:
- `Schezwan (₹ 20 extra)` under Fried Rice.
- `Schezwan (₹ 20 extra)` under Noodles.

This is not a complete standalone product price. The V1 seed does not invent final prices for these options.
Future implementation can add a modifier/variant model once the desired billing behavior is confirmed.

### 5. Serving labels
For distilled alcohol categories, the operator has specified fixed 30 ml serving.
Beer/cocktail/shot unit wording is represented as a menu unit rather than inventing sizes not stated in the source.

## Go-live rule
Before the first real event, ADMIN must review any record marked `needs_confirmation` and activate only the intended prices/items.
