# Store setup checklist

Some settings can only be changed by a person in the Shopify admin. **S** means a script does it (`npm run setup-store`). **M** means you do it by hand, with the exact clicks below. Tick each line once it is confirmed.

## 0. Before anything

- [ ] M: Online Store > Themes > live theme > ⋯ > Duplicate. Rename the copy "Ornis OLD backup 2026-11".
- [ ] M: Settings > Apps > Develop apps (Dev Dashboard): create "Ornis Operator" with the scopes in docs/HANDOVER.md, install it, and save the `shpat_` token as the `SHOPIFY_ADMIN_TOKEN` environment secret.
- [ ] M: Install **Theme Access**. Create a password and save it as `SHOPIFY_CLI_THEME_TOKEN`.
- [ ] M: Allow these hosts in the Claude Code environment: `<store>.myshopify.com`, `ornis.shop`, `cdn.shopify.com`, `shopify-staged-uploads.storage.googleapis.com` (image uploads) and `storage.googleapis.com` (exports).

## 1. Store details (Settings > General)

- [ ] M: Store name "Ornis".
- [ ] M: Legal business name, address, phone and sender email on the shop domain (for example hello@ornis.shop). Replace the personal Gmail in every policy and notification. *(Owner to provide.)*
- [ ] M: Time zone (GMT+00:00) London, currency GBP, unit system Metric, weight kilograms.
- [ ] M: Settings > Checkout > Order ID: prefix `ORN-`.
- [ ] M: Theme settings > Business details: fill the same name, address, email and phone (shown in the footer and on the Contact page). Leave empty until confirmed. Empty fields are hidden, never faked.

## 2. Payments (Settings > Payments)

- [ ] M: Shopify Payments on, payouts to the owner's business bank account, statement descriptor "ORNIS".
- [ ] M: Shop Pay, Apple Pay, Google Pay, Klarna on. PayPal on.
- [ ] M: Fraud analysis on. Settings > Checkout > Order processing: review high-risk orders before the supplier order is placed.
- [ ] M: Payment capture: automatic.

## 3. Checkout and customer accounts

- [ ] M: Settings > Customer accounts: new customer accounts (sign-in by email code), optional at checkout.
- [ ] M: Settings > Checkout: email marketing consent box unticked by default, SMS off, address autocomplete on, company name hidden, phone optional.
- [ ] M: Settings > Checkout > Customise: logo, Kingfisher #0B6782 buttons, Paper #FBFAF7 background, Deep teal #0A4A5C header, Marigold #F2C14E accents, Poppins font.
- [ ] M: Settings > Checkout > Order status page additional scripts: none. Add the note "Items may arrive in separate parcels" to the order status page through the checkout editor's text block.

## 4. Taxes and duties

- [ ] M: **Do not change VAT collection until the owner gives a written decision after speaking to an accountant.** Goods under £135 shipped from outside the UK mean the seller must charge and account for UK VAT. Once registered: Settings > Taxes and duties > United Kingdom > collect VAT, prices include tax. Then set the VAT number in Theme settings.

## 5. Shipping and delivery (Settings > Shipping and delivery)

- [ ] M: One zone, United Kingdom. Standard £4.99, free over £30 (a second rate: Standard, free, condition "order price £30 and up"). Express £6.99.
- [ ] M: Add each rate's real delivery range in its description. *(Owner to confirm the ranges.)*
- [ ] M: Processing time: 3 business days.
- [ ] M: Settings > Markets: United Kingdom only.
- [ ] S: Shop info metaobject (processing 3 days, free threshold £30, returns 14 days). Fill **default delivery min and max days** once confirmed. The product page estimate stays hidden until then.

## 6. Store structure (scripted)

- [ ] S: Product metafield definitions (`custom.*`), with supplier fields hidden from the storefront.
- [ ] S: Metaobject definitions: size_chart, trust_point, faq_item, shop_info. Entries for shop info, trust points and FAQ.
- [ ] S: Collections: Women, Men, Kids, Beauty, Gifts, New in, Picked for you, Sale, gift collections by price and person, and sub-categories (automated by tag).
- [ ] S: Old wrong collections (personal-care, health-care, beauty-example-products, home-page, fashion-and-apparel) hidden from the Online Store (not deleted) and redirected.
- [ ] S: Pages: About, Contact, Delivery, Returns, Size guide, FAQ, Track my order, Gift guide, Accessibility statement, Cookie policy.
- [ ] S: Menus: main-menu, footer-shop, footer-help, footer-about.
- [ ] M: Create size chart entries (Content > Metaobjects > Size chart) **from supplier measurements**. Rows are JSON, for example `[{"size":"S","chest":88,"waist":70,"hips":94}]`.
- [ ] M: Search & Discovery app > Filters: Availability, Price, Size, Colour, Product type, and Fit (tag filter on `fit:`). Remove all other filters.

## 7. Policies (Settings > Policies)

- [ ] M: Paste the drafts from `content/policies/` (Refund, Privacy, Terms of service, Shipping, Contact information). Fill every `[TO CONFIRM]` and remove the markers before saving. The owner reviews them. They are not legal advice.
- [ ] M: Settings > Customer privacy: cookie banner on, region UK, Accept, Reject and Manage buttons with equal weight. Data sale opt-out page off (UK).

## 8. Notifications (Settings > Notifications)

- [ ] M: Customise email templates: logo, Ink colour, footer with business address and support email.
- [ ] M: Order confirmation: add the line "Your items may arrive in separate parcels" and a link to /pages/returns.
- [ ] M: Shipping confirmation includes tracking (default).
- [ ] M: Sender email: add the SPF, DKIM and DMARC DNS records shown, and verify.
- [ ] M: Send every test email to the operator and the owner. Record that they arrived and were not in spam in ACCEPTANCE.md.

## 9. Apps (approve each before installing)

- [ ] M: Keep only: Search & Discovery, Shopify Flow, Shopify Inbox, Shopify Email, the supplier app, Judge.me, Google & YouTube, Facebook & Instagram, TikTok, Theme Access.
- [ ] M: List every other installed app with its cost, then remove it after approval. Record the final list in HANDOVER.md.
- [ ] M: Judge.me: verified buyers only, review request emails after delivery, no imported or manual reviews.

## 10. Shopify Flow

- [ ] M: Flow "Order not fulfilled in 3 working days": trigger Order created, wait 3 days, check fulfilment status, then send an internal email to the operator and the owner.
- [ ] M: Flow "Multiple suppliers": trigger Order created. If line items have different vendor/supplier tags, add the order tag `separate-parcels`.
- [ ] M: Flow "Scheduled job alert": not needed; GitHub opens an issue when a scheduled job fails.

## 11. Staff, domain and email

- [ ] M: Staff: owner (account owner, billing) and operator only, each with two-step login required. Operator permissions: Products, Online Store, Apps, Settings, Orders (view), Customers (view).
- [ ] M: Domains: ornis.shop primary, www redirects to it, HTTPS on (automatic).
- [ ] M: Online Store > Preferences: password protection off only at launch (milestone 8).
- [ ] M: Google Search Console: verify ornis.shop and submit `https://ornis.shop/sitemap.xml` at launch.

## 12. Monitoring

- [ ] M: UptimeRobot (free): create an account, add HTTPS monitors for `https://ornis.shop/` and one product page, with alerts by email to the operator and the owner.
