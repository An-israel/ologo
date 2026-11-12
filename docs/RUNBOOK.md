# Runbook

What to do when something goes wrong, plus routine maintenance. Operator first, owner second.

## On-call

| Who | When | Response time |
|---|---|---|
| Operator (Isaiah) | First contact for anything technical, product or supplier related | Urgent (site down, checkout failing, wrong price live): within 1 hour, 08:00 to 22:00 UK. Other: within 1 working day. |
| Owner | Orders, refunds, customer messages, chargebacks, money | Customer messages within 1 working day. |

## Service levels (SLO, how we measure them, error budget)

| SLO | Indicator (SLI) and where to see it | When it is missed |
|---|---|---|
| Storefront available 99.9% | Shopify status plus UptimeRobot monitors on the home page and one product page | Shopify outages are outside our control: post a note in the announcement bar. Our own changes: roll back (below). |
| LCP under 2.5 s at p75 on mobile | Online Store > Themes > Web performance (real-user Core Web Vitals, p75). Shopify does not report p99. | Pause new sections and apps. Fix first (images, apps added), then resume. |
| 95% of orders fulfilled within 3 working days | Flow alert for late orders. Weekly count in Orders > filter Unfulfilled, older than 3 days. | Pause adding new products from slow suppliers. Chase the supplier. Switch the product to a faster supplier or archive it. |

**Observability in one paragraph:** UptimeRobot tells us within 5 minutes if the site is down. Shopify Flow emails us when an order is late. GitHub opens an issue when a scheduled job fails and every Monday with the weekly report (data problems, margins, orders, conversion). Shopify's web performance report shows real-user speed. Script logs in `logs/` record every change, with before values.

## Incidents

### Site down or very slow
1. Check https://www.shopifystatus.com. If Shopify is down, wait and post on social media. Nothing to roll back.
2. If only our theme is broken: Online Store > Themes > "Ornis OLD backup 2026-11" (or the previous Ornis release) > Publish. Publishing is instant.
3. Run `STORE_URL=https://ornis.shop npm run smoke`. Then write a postmortem (docs/POSTMORTEM_TEMPLATE.md).

### Checkout failing
1. Try a test order yourself. Check Settings > Payments for warnings (Shopify Payments verification, Klarna status).
2. If one payment method is down (network partition with a provider), the others keep working. Shopify hides unavailable methods. Tell customers in the announcement bar if needed.
3. If all payments fail, contact Shopify Support (Help > Chat) straight away.

### Wrong price live
1. Fix the price in Products straight away, or run `npm run normalise -- --revert logs/<last run>.jsonl --apply` if a script caused it.
2. For orders already placed at a wrong low price: honour them or contact the customer and offer a full refund. Never change the price of a paid order.
3. Check that no "was" price is shown without price history (`npm run audit`).

### Product sold but the supplier is out of stock
1. Contact the customer within 24 hours: offer a similar item, a wait time, or a full refund.
2. Set the product to Draft (or set its stock to 0) so no one else buys it.
3. The supplier app's stock sync runs on its own schedule, so stock can lag (eventual consistency). Check the app's sync settings.

### Customer complaints about late parcels
1. Get the tracking link from the order. If the parcel is past the latest delivery date, chase the supplier.
2. After 10 working days past the estimate, offer a refund or reship.
3. If a supplier is often late, update the product's delivery days or remove the supplier.

### Chargeback
1. Orders > the disputed order > respond before the deadline shown. Upload tracking, proof of delivery and any messages.
2. Never ignore one. Unanswered disputes are lost automatically.

### Placeholder text found on the site
1. Find the source with `npm run lint:placeholders`. On the live site, check the theme editor for an empty or default block.
2. Fix it in the theme editor (text lives in section settings or `locales/en.default.json`), push and re-run the e2e placeholder test.

### Supplier app disconnected
Orders stop being sent to the supplier. Reconnect the app (Apps > supplier app > reconnect), then place any orders made in between manually. Check the Flow late-order alerts.

## Rollback and restore

| What | How |
|---|---|
| Theme | Publish the previous theme in Online Store > Themes. Every release is tagged in Git (`v2.0.0` ...). To rebuild one: `git checkout v2.0.0 && npm run theme:push`. |
| Product data change by a script | `npm run normalise -- --revert logs/normalise-products-<run>.jsonl` (dry run), then add `--apply`. |
| Whole catalogue (disaster recovery) | The latest weekly export is in `backup/<date>/`. Re-import products with the CSV template from that data, then run `npm run setup-store -- --apply` to restore structure. |

## Deploying theme changes

1. Open a pull request. CI runs Theme Check, tests, the scans, Playwright with axe and Lighthouse.
2. Merging to `main` pushes to the unpublished theme "Ornis 2.0" and runs the smoke test. It never publishes.
3. Publish by hand after checking the preview: Online Store > Themes > Ornis 2.0 > Publish. Then tag the release (`git tag v2.0.1 && git push --tags`), update CHANGELOG.md, and run `STORE_URL=https://ornis.shop npm run smoke`.

Shopify clears its caches when you publish or edit, so there is no cache to purge.

## Secrets and rotation (every 6 months, and whenever someone leaves)

1. **Admin API token:** Dev Dashboard > Ornis Operator > rotate or reinstall. Update the `SHOPIFY_ADMIN_TOKEN` secret in the Claude Code environment and in GitHub (Settings > Secrets and variables > Actions).
2. **Theme Access password:** Apps > Theme Access > delete the old password, create a new one, and update `SHOPIFY_CLI_THEME_TOKEN`.
3. **Staff:** remove leavers in Settings > Users. Check that two-step login is required for everyone.
4. Next rotation dates: May 2027, November 2027.

## Routine maintenance

| When | Task |
|---|---|
| Weekly (Monday) | Work through the weekly report issue. Backup commits itself. |
| Monthly | Lighthouse scores, app costs, supplier delivery times. Update delivery ranges. |
| Quarterly (Jan, Apr, Jul, Oct) | Check for a newer Admin API version and update `scripts/lib/config.ts` before 1 October 2027. Review Dependabot pull requests. |
| Yearly (December) | Update the bank holiday list in Theme settings > Delivery and returns from gov.uk/bank-holidays. Renew the domain (Settings > Domains), with a reminder 30 days before expiry. |
| Before each season | Christmas mode, hero, gift collections, last order dates. |
