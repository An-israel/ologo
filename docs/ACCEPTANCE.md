# Acceptance

The store is done when every automated check passes and every manual line has evidence: a screenshot, an order number or a recording. ☑ = met, ☐ = still to do, with the evidence or the reason.

Last updated: 12 November 2026 (milestone 1 to 3 build, before store access).

## Targets from the brief (section 1.4)

| Area | Target | Status | Evidence |
|---|---|---|---|
| Placeholder or template text | Zero, enforced by an automated test | ☑ in the theme | `npm run lint:placeholders` (source) and `tests/e2e/quality.spec.ts` (every rendered template) both pass. Re-run against the live preview once the store is connected. |
| Product pages complete | 100% of active products with description, size chart (clothing), alt text, delivery estimate | ☐ | Theme renders all four. Catalogue clean-up is milestone 4: the audit report counts the gap, and publish-products refuses incomplete products. |
| Fake "was" prices | 0% | ☑ in the theme, ☐ in data | The theme shows a compare-at price only with proven price history (`snippets/compare-allowed.liquid`). normalise-products clears the formula prices. |
| Accessibility | WCAG 2.2 AA; Lighthouse Accessibility 100 on home, collection, product, cart | ☑ automated (preview) | axe: zero serious or critical issues on 12 templates at 390 px and 1440 px. Lighthouse Accessibility 100 on home, collection and product (preview). Manual keyboard and VoiceOver passes are still to do. |
| Mobile speed | Lighthouse mobile Performance 90+, LCP < 2.5 s, CLS < 0.05, INP < 200 ms | ☑ preview, ☐ live | 99 to 100 on the preview (below), with budgets enforced in CI. Must be re-measured on Shopify with real products and apps. |
| SEO | Unique title and description on every template; Lighthouse SEO 100; Product, Organization, BreadcrumbList structured data valid | ☑ in the theme | `snippets/meta-tags.liquid`, `structured-data-*.liquid`, `breadcrumbs.liquid`. Rich Results Test is still to run on the live preview. |
| Theme code | Theme Check zero errors and warnings | ☑ | `npm run theme:check`: 0 offences |
| Trust | Contact, About, Size guide, Delivery, Returns, FAQ pages live; reviews only from verified buyers | ☑ built, ☐ live | Pages are created by setup-store. The reviews section hides itself below 5 verified reviews. |
| Operator effort per product | Under 5 minutes | ☐ | CSV + photo folder path built and tested. Time one real product end to end. |

## Lighthouse (local preview with sample products, mobile)

Recorded from `npm run lhci` (desktop-class sandbox, simulated mobile throttling). These numbers show the theme's own weight. They are not a promise for the live store, which adds Shopify's scripts, apps and real photos.

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Home | 99 (LCP 2.0 s, CLS 0) | 100 | 100 | 100 |
| Collection | 100 (LCP 1.4 s, CLS 0) | 100 | 100 | 100 |
| Product | 99 (LCP 2.2 s, CLS 0) | 100 | 100 | 100 |

## Section 1.3 audit issues

| # | Issue | Fixed by | Status |
|---|---|---|---|
| 1 | Shopify sample text | New theme, no sample text; placeholder tests | ☑ theme |
| 2 | Formula compare-at prices | Theme only shows proven prices; normalise clears them | ☑ theme, ☐ data |
| 3 | Untraceable testimonials | Removed; reviews from Judge.me verified buyers only | ☑ |
| 4 | No descriptions, spec text, alicdn images | normalise strips spec text and re-hosts images; standard requires 60 to 120 words | ☐ data |
| 5 | Menus point at wrong handles | New menus by setup-store; old collections hidden and redirected | ☐ apply |
| 6 | Broken variant data | normalise with mapping file; validator blocks bad data | ☐ data |
| 7 | Colour variants priced pence apart | normalise equalises; validator blocks | ☐ data |
| 8 | No size charts, delivery estimate, related products | Size guide drawer, delivery estimate, Complete the look, You may also like, Recently viewed | ☑ theme |
| 9 | SEO title "Ornis", spec-text meta, empty alt, long URLs | meta tags; SEO fields in the standard; alt text drafting; handle shortening with redirects | ☑ theme, ☐ data |
| 10 | No Contact, About, Size guide; Gmail; repeated footer | Pages; three distinct footer menus; business email setting | ☑ built, ☐ email |
| 11 | Terms placeholders and typos | `content/policies/terms-of-service.md` rewritten | ☐ paste |
| 12 | Shipping and refund policy gaps | Rewritten drafts | ☐ paste |
| 13 | Beauty items with legal requirements | Restricted check; normalise --draft-restricted | ☐ apply |

## Manual checks before launch (brief 10.2)

- [ ] Real devices: iPhone (Safari) and a budget Android (Chrome), every main page and the full purchase path.
- [ ] Keyboard-only pass and VoiceOver (iPhone) pass on home, product, cart and checkout.
- [ ] Test orders in test mode: successful card, declined card, Shop Pay, discount code, order over £30 (free delivery), express delivery, then a full refund. Order numbers: ____
- [ ] Every notification email received, branded and not in spam.
- [ ] Supplier app receives a test order correctly, or the manual process is confirmed.
- [ ] Every old URL from the audit redirects to the right new page.
- [ ] Rich Results Test passes for a product page and the FAQ page.
- [ ] Every page in section 5.6 is live, with no `[TO CONFIRM]` left.
- [ ] Every issue in section 1.3 is gone, checked one by one.
- [ ] The operator adds one new product end to end in under 5 minutes. Time: ____
- [ ] The owner reads OWNER_GUIDE.md and confirms she understands her daily tasks.
- [ ] Chaos checks: declined card, last item sold during checkout (two browsers), supplier app disconnected.

## Real-user Core Web Vitals (record monthly after launch)

| Month | LCP p75 | CLS p75 | INP p75 | Source |
|---|---|---|---|---|
| | | | | Online Store > Themes > Web performance |
