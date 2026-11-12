# Handover

## What was built

| Item | Where |
|---|---|
| Theme "Ornis 2.0", version 2.0.0 | `theme/` (Online Store 2.0: JSON templates, sections, snippets, locales) |
| Operator toolkit | `scripts/` (TypeScript, Node.js 22), described in docs/OPERATOR_GUIDE.md |
| Store structure as code | `scripts/lib/store-plan.ts`, applied by `npm run setup-store` |
| Content pages and policy drafts | `content/pages/`, `content/policies/` |
| Tests and CI | `tests/`, `.github/workflows/`, `lighthouserc.json`, `lighthouse-budget.json` |
| Local preview with sample products | `tools/preview/` (`npm run preview`) |

Repository: GitHub `an-israel/ologo` (the brief called it `ornis-theme`; the name does not matter to Shopify).

### Why the theme is not a literal fork of Dawn

The build environment could not reach GitHub to download Dawn. Ornis 2.0 is written from scratch on Dawn's architecture instead: Online Store 2.0 JSON templates, sections with full schemas, vanilla custom elements, per-section stylesheets and Shopify's native cart, search and recommendations APIs. It is checkout-compatible, and it passes Theme Check with zero errors and warnings. It is also lighter than Dawn: about 40 KB of theme JavaScript before compression and about 10 KB compressed, against a 60 KB compressed budget.

## Accounts and who owns them

| Account | Owner | Notes |
|---|---|---|
| Shopify store (billing) | Owner | Only account holder with billing access |
| Shopify staff: operator | Operator | Two-step login required |
| Domain ornis.shop | Owner | Bought through Shopify or a registrar. Renewal reminder in RUNBOOK. |
| GitHub repository | Operator | Secrets: SHOPIFY_STORE, SHOPIFY_ADMIN_TOKEN, SHOPIFY_CLI_THEME_TOKEN, STOREFRONT_PASSWORD |
| UptimeRobot | Operator | Free plan |
| Supplier app | Owner (billing), operator (use) | |
| Judge.me | Owner | Free plan |

## Admin API app "Ornis Operator": scopes

Read and write: `products`, `inventory`, `files`, `metaobjects`, `metaobject_definitions`, `online_store_navigation` (menus and redirects), `online_store_pages`, `publications`. Read only: `locations`, `orders`, `reports`. Nothing else.

## Apps and monthly cost

| App | Purpose | Cost |
|---|---|---|
| Search & Discovery | Filters and recommendations | Free |
| Shopify Flow | Order alerts and tagging | Free |
| Shopify Inbox | Customer chat | Free |
| Shopify Email | Welcome email and newsletter | Free tier (10,000 emails a month) |
| Supplier app (DSers or chosen) | Product import and auto-ordering | Owner to confirm plan |
| Judge.me | Verified buyer reviews | Free tier |
| Google & YouTube, Facebook & Instagram, TikTok | Product feeds and tracking | Free |
| Theme Access | Theme uploads | Free |

Shopify plan: Basic is enough at launch. Consider the Shopify plan when you need more staff accounts or professional reports.
**Expected monthly total:** Shopify plan + supplier app plan. Every other app is on a free tier. Transaction and payment fees come on top.

## Every script that loads on the storefront

| Script | Source | Loaded on |
|---|---|---|
| `global.js`, `cart.js` | Theme | Every page (deferred) |
| `product.js`, `delivery-date.js` | Theme | Product page (and delivery-date on the cart page) |
| `facets.js` | Theme | Collection and search pages |
| `predictive-search.js` | Theme | Every page (deferred, header) |
| Shopify's own scripts (`content_for_header`): analytics, consent banner, Shop Pay, Klarna messaging | Shopify | Every page |
| Judge.me widget | App block | Product page and reviews section, when added |
| Google, Meta, TikTok pixels | Official apps through Shopify's Customer Events | Only after cookie consent |

No tracking snippets are pasted into the theme.

## Domain and DNS

- `ornis.shop`: A record and `www` CNAME as shown in Settings > Domains (Shopify manages these if the domain was bought through Shopify).
- Sender email (Settings > Notifications > Sender email): add the CNAME records Shopify shows for DKIM, plus `TXT v=spf1 include:shops.shopify.com ~all` (merge with any existing SPF), and `_dmarc TXT "v=DMARC1; p=quarantine; rua=mailto:<support email>"`.

## Selling outside the UK later

Adding the EU needs extra product safety work (GPSR: an EU responsible person and product safety details) and VAT/IOSS registration. Do not switch on new markets until both are done.
