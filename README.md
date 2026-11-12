# Ornis 2.0

The Shopify theme and operator toolkit for [ornis.shop](https://ornis.shop): affordable fashion, beauty and gifts for the UK.

| Folder | What is in it |
|---|---|
| `theme/` | The Ornis 2.0 Online Store 2.0 theme (layout, JSON templates, sections, snippets, locales, assets) |
| `scripts/` | Operator toolkit in TypeScript: setup-store, audit, normalise, validate, prepare-images, import, publish, redirects, weekly report, smoke test, backup |
| `content/` | Content page HTML (created by setup-store) and policy drafts |
| `templates/` | Product CSV template, filled example, variant mapping, redirects |
| `tests/` | Unit tests (Vitest), Playwright end-to-end, accessibility and quality tests, static scans, Theme Check runner |
| `tools/preview/` | Local preview server that renders the theme with sample products |
| `docs/` | Owner and operator guides, engineering checklist, acceptance, runbook, handover, store setup checklist |

## Setup

Node.js 22 or later.

```bash
npm ci
```

Environment variables (secrets, never committed; see `.env.example`):

| Variable | Used by |
|---|---|
| `SHOPIFY_STORE` | `your-store.myshopify.com`, for scripts and the Shopify CLI |
| `SHOPIFY_ADMIN_TOKEN` | Admin API token from the "Ornis Operator" app (scopes in docs/HANDOVER.md) |
| `SHOPIFY_CLI_THEME_TOKEN` | Theme Access password, for `shopify theme` commands |
| `STORE_URL`, `PREVIEW_THEME_ID`, `STOREFRONT_PASSWORD` | Optional: run the e2e tests and smoke test against Shopify |

## Theme development

```bash
npm run preview          # local preview with sample products at http://localhost:9292 (no store needed)
npm run theme:dev        # Shopify CLI live preview against the store
npm run theme:check      # Theme Check: must report 0 offences
npm run theme:push       # push to the unpublished theme "Ornis 2.0" (never publishes)
npm run theme:share      # shareable preview link
```

Customer-facing text lives in section settings (theme editor) or `theme/locales/en.default.json`, never hard-coded in Liquid. Colours and fonts are theme settings, turned into CSS custom properties in `snippets/css-variables.liquid`.

## Tests

```bash
npm test                 # unit tests: rules, CSV validator, API client, delivery dates, image pipeline
npm run test:e2e         # Playwright at 390 px and 1440 px: purchase path, search, size guide, axe, placeholders, links
npm run lhci             # Lighthouse CI with budgets
npm run ci               # everything that runs on a pull request, except the browser tests
```

## Toolkit

Every data-changing script is a dry run unless you pass `--apply`, logs to `logs/`, and never deletes. See docs/OPERATOR_GUIDE.md for the workflow.

```bash
npm run setup-store [-- --apply]
npm run audit
npm run normalise [-- --apply | --new | --handle x | --draft-restricted | --revert logs/x.jsonl]
npm run validate -- products.csv
npm run prepare-images [-- --handle x]
npm run import -- products.csv [--apply]
npm run publish-products -- --approved approved.csv [--apply]
npm run redirects -- templates/redirects.csv [--apply]
npm run weekly-report
npm run smoke
npm run backup
```

## Deploying

Pull requests run CI. Merging to `main` pushes to the unpublished "Ornis 2.0" theme and runs the smoke test. Publishing is always manual, after sign-off: see docs/RUNBOOK.md.
