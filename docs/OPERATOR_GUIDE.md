# Operator guide

For Isaiah, the operator. This guide covers how to find products, get them into the store cleanly and keep the store tidy. The owner never edits listings.

Every script is a **dry run by default**. It prints what it would change and changes nothing. Add `--apply` only after you have read the dry run. Every run writes a log to `logs/`, and data scripts can be undone with `--revert logs/<file>.jsonl --apply`.

## 1. Sourcing checklist (run before importing anything)

Tick every line, or do not list the product.

- [ ] **Supplier:** store rating 4.7 or higher, at least 500 orders on this item, real photos in buyer reviews, a size chart available.
- [ ] **Delivery to the UK:** 12 working days or fewer. Prefer UK or EU warehouses. Record the real range in the product's delivery min and max days.
- [ ] **Price:** at least 2.5 times the landed cost (item plus shipping), ending in .99 or a whole pound. One price per product unless sizes genuinely cost more. Put the landed cost in "Cost per item".
- [ ] **Photos:** at least 4 usable images, with no watermarks, no Chinese text and no price collages. The first image shows the item alone on a plain light background.
- [ ] **No brand copies:** nothing that copies a brand's logo, name, print or signature design.
- [ ] **Facts:** fabric, care and measurements only as the supplier states them. Never guess.
- [ ] **Restricted check** (section 2) done if it applies.

## 2. Restricted products

Set **Restricted check** to TRUE only when the product passes. The importer refuses these categories without it.

| Category | Rule |
|---|---|
| Cosmetics and skincare (serums, lip colour, creams, sprays) | Needs a UK Responsible Person, a safety report and an SCPN notification before sale. List only if the supplier can prove all three. Make-up brushes and tools are fine. |
| Food supplements (gummies, vitamins) | Must meet UK food labelling rules. Do not list from overseas suppliers. |
| Children's clothing | No drawstrings or cords in the hood or neck area, no small detachable decorations for under 3s, no adult wording ("sexy", "nightwear") in any title, URL or tag. |
| Electricals | UK plug, UKCA or CE marking and instructions in English, or do not list. |

The beauty items found in the audit (serums, Men's Care Spray, biotin gummies) stay in Draft until the owner confirms in writing that they can be sold legally.

## 3. The product data standard

`validate-products` checks all of this automatically.

| Field | Rule |
|---|---|
| Title | Who + what + key detail, under 70 characters. For example "Men's Slim Stretch Denim Jeans". No "2025 New", "Hot" or "Brand Clothing". |
| Handle | Short and readable, from the title (`mens-slim-stretch-jeans`). When a handle changes, the scripts add a redirect. |
| Description | 60 to 120 words in British English: what it is, how it fits, what to wear it with, who it suits. Then a short bullet list. No spec dumps, no em dashes. |
| Fabric and care | In the metafield columns, with percentages when the supplier gives them. Separate care lines with " \| ". |
| Images | At least 4, uploaded to Shopify (never linked from the supplier), 2048 px tall, 3:4, under 400 KB, named `handle-1.jpg`. Alt text describes the item, colour and view. |
| Variants | Option names "Colour" and "Size". Colours are real names in Title Case ("Sky Blue"), with no duplicates and no codes. Sizes run XS, S, M, L, XL, XXL, 3XL, or kids' ages in order. Each colour is linked to its image. SKU `ORN-<handle-code>-<colour>-<size>`. |
| Price | Same price across colours. Compare-at price stays empty unless the price history shows the item sold at that price for at least 28 days. |
| Organisation | Product type, at least one collection, and tags `gender:`, `category:`, `season:` and `price:` (for example `price:under-25`). Add `gift` for gift items and `fit:` (`fit:relaxed`) for clothing. |
| SEO | Title of 60 characters or fewer. Description of 140 to 155 characters, written in full, not cut off. |
| Weight | Always filled, so shipping rates work. |

## 4. Path A: supplier app import (DSers or the app you choose)

1. In the supplier app, push the product to Shopify **as Draft**. Add the tag `import:new`.
2. Clean it to the standard:
   ```
   npm run normalise -- --new
   npm run normalise -- --new --apply
   ```
3. Export the product as CSV (Products > Export, selected products). Then fill in the description, metafields, SEO and tags, following `templates/ornis_products_example.csv`.
4. Validate and re-import (Path B, steps 3 to 5).

## 5. Path B: CSV import (fastest, under 5 minutes per product)

1. Copy `templates/ornis_products_template.csv`. Fill one row per variant, using the filled example as your guide.
2. Put the product's photos in `work/images/<handle>/`, named in order (`1.jpg`, `2.jpg` ...), then prepare them:
   ```
   npm run prepare-images -- --handle <handle>
   ```
   Look at every file in `work/images/<handle>/prepared/` before going on.
3. Validate:
   ```
   npm run validate -- my-products.csv
   ```
   Fix every ERROR line. Warnings are advice.
4. Import as Draft:
   ```
   npm run import -- my-products.csv
   npm run import -- my-products.csv --apply
   ```
   Failed products go to `failed_rows.csv` with the reason. Fix them and run the import again. It never duplicates.
5. Check each product in the theme preview. Then list the approved handles in `approved.csv` (one column, `handle`) and publish:
   ```
   npm run publish-products -- --approved approved.csv
   npm run publish-products -- --approved approved.csv --apply
   ```
   Publishing refuses any product that still breaks the standard.

## 6. Cleaning the existing catalogue

1. `npm run audit` writes `reports/catalogue-audit.csv`, one row per problem. This is your to-do list.
2. For every bad colour name, add a line to `templates/variant-mapping.csv`, with the raw value and the real colour you can see in the photo.
3. `npm run normalise` (dry run), then `npm run normalise -- --apply`. To also set unchecked restricted products to Draft, add `--draft-restricted`.
4. Products tagged `review:alt-text` or `review:description` need a human look. Remove the tag when done.
5. Archive (never delete) anything that cannot meet the standard.

Launch with 40 to 80 clean products across Women, Men, Kids and Gifts. Get the owner to approve a sample of 10 before the rest.

## 7. Running the store

| Task | How |
|---|---|
| Change the hero, banners, announcement messages, trust points | Online Store > Themes > Ornis 2.0 > Customise. Every text and image is editable there. |
| Christmas mode and last order dates | Theme settings > Seasonal and features. Leave a date empty to hide it. |
| Delivery and returns facts | Content > Metaobjects > Shop info > main. One edit updates the product pages, cart, Delivery page and FAQ. |
| FAQ, size charts | Content > Metaobjects > FAQ item / Size chart. |
| "New" badge | Automatic for 30 days. The weekly report lists stale `new` tags to remove. |
| Sale | Tag real sale items `sale`. A "was" price appears only when the price history proves it. The Sale menu link hides itself while the sale collection is empty. |
| Redirects | Add rows to `templates/redirects.csv`, then `npm run redirects` and `npm run redirects -- --apply`. |

## 8. Weekly and monthly

- **Every Monday:** a GitHub issue "Weekly store report" lists products missing fields, sold-out items still on the home page, dead supplier links, stale "new" tags and anything priced below 2.5 times cost. Fix them, then close the issue.
- **Monthly:** check Lighthouse scores, app costs and supplier delivery times. Update the delivery ranges if they have changed.
- **Before each season:** switch Christmas mode on or off, and update the hero, gift collections and last order dates.
