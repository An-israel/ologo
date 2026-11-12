# Before and after

Fill in at milestone 6 (QA), measured the same way on the same pages. The "before" column comes from the audit of 4 November 2026 and the old theme backup.

| Measure | Before (old theme) | After (Ornis 2.0) | How measured |
|---|---|---|---|
| Placeholder strings on rendered pages | On every page (10+ distinct strings) | | `STORE_URL=... npm run test:e2e -- -g placeholder` |
| Products meeting the data standard | 0% | | `npm run audit` (products with zero findings / active products) |
| Product images with alt text | 0% | | audit report, "missing alt text" rows |
| Products with a fake or formula "was" price | 100% | 0% | audit report |
| Lighthouse mobile Performance (home / collection / product) | | | `npx lhci autorun` with STORE_URL pages |
| Lighthouse Accessibility | | | as above |
| Lighthouse SEO | | | as above |
| Theme Check errors / warnings | | 0 / 0 | `npm run theme:check` |
| Trust pages live (Contact, About, Size guide, Delivery, Returns, FAQ) | 0 of 6 | | |

## Phone screenshots (390 px)

Put pairs in `docs/screenshots/before-*.png` and `after-*.png` for home, a collection, a product and the bag.
