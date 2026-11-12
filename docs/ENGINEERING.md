# Production engineering checklist (all 111 items)

Shopify runs the servers, database, checkout, CDN and most security, so many items are **PLATFORM** (Shopify already does it) or **NOT NEEDED** (with a reason). Every item is accounted for. Nothing was added that the store does not need.

Counts: BUILD 46, PLATFORM 28, Document 8, NOT NEEDED 29.

| # | Item | Status | Where it lives | Notes |
|---|---|---|---|---|
| 1 | Rate limiting | BUILD | scripts/lib/shopify.ts | Scripts read the Admin API cost throttle status and wait before the limit; forms use Shopify's built-in limits. |
| 2 | Caching | BUILD | snippets/image.liquid, scripts/import-products.ts | Correct srcset and sizes on every image; scripts cache size chart and product id lookups during a run. |
| 3 | Load balancing | PLATFORM | Shopify | Shopify serves the storefront from its global infrastructure. |
| 4 | Reverse proxies | PLATFORM | Shopify edge | Shopify's edge network terminates and routes requests. |
| 5 | API gateways | PLATFORM | Shopify Admin and Storefront APIs | No custom API. |
| 6 | CI/CD | BUILD | .github/workflows/ci.yml | Theme Check, unit tests, placeholder, link and copy scans, Playwright with axe, Lighthouse CI; deploys only to the unpublished theme. Publishing is manual after sign-off. |
| 7 | Docker | BUILD | .devcontainer/devcontainer.json | Optional dev container so any developer runs the scripts the same way. |
| 8 | Kubernetes | NOT NEEDED |  | No servers to run. |
| 9 | Service discovery | NOT NEEDED |  | No services. |
| 10 | Circuit breakers | BUILD | scripts/lib/shopify.ts | Stops after 5 consecutive API failures, keeps progress, tells the operator to re-run later. Tested in tests/unit/shopify-client.test.ts. |
| 11 | Timeouts | BUILD | scripts/lib/shopify.ts, scripts/import-products.ts | 30 s timeout on every API call and image upload; 15 s on storefront fetches in the theme. |
| 12 | Retries | BUILD | scripts/lib/shopify.ts | API calls and uploads retry on throttling, network errors and 5xx. |
| 13 | Exponential backoff | BUILD | scripts/lib/shopify.ts (backoffDelay) | Capped exponential backoff with jitter. |
| 14 | Idempotency | BUILD | scripts/import-products.ts, assets/cart.js | Imports keyed by handle (productSet) and SKU; re-running updates, never duplicates. Add to bag is disabled while a request runs. |
| 15 | Message queues | NOT NEEDED |  | Shopify Flow and the supplier app handle background work. |
| 16 | Pub/sub | NOT NEEDED |  | As above. |
| 17 | Event-driven architecture | PLATFORM | Shopify Flow | Triggers: order created, order not fulfilled after 3 working days (docs/STORE_SETUP_CHECKLIST.md). |
| 18 | Distributed transactions | NOT NEEDED |  | Single platform. |
| 19 | Saga pattern | BUILD | scripts/import-products.ts | If images fail after the product is created, the product stays Draft and the row goes to failed_rows.csv with the fix. |
| 20 | Dead letter queues | BUILD | failed_rows.csv, reports/ | Failed rows and reports for every script, re-runnable. |
| 21 | Cron jobs | BUILD | .github/workflows/scheduled.yml | Weekly report and weekly backup on Mondays at 08:00 UK time. |
| 22 | WebSockets | NOT NEEDED |  |  |
| 23 | Long polling | NOT NEEDED |  |  |
| 24 | Server-sent events | NOT NEEDED |  |  |
| 25 | Database indexing | BUILD | scripts/lib/store-plan.ts | Metafield definitions as code; consistent tags (gender:, category:, season:, price:, fit:) and option names so Search & Discovery filters work. |
| 26 | Query optimization | BUILD | theme sections, scripts/lib/catalogue.ts | Paginated collections; GraphQL queries ask only for needed fields. |
| 27 | N+1 queries | BUILD | scripts/lib/catalogue.ts, theme | No product lookups inside Liquid loops (collections use featured_image); scripts load products with variants and images in one paginated query. |
| 28 | Connection pooling | PLATFORM | Shopify |  |
| 29 | Read replicas | NOT NEEDED |  |  |
| 30 | Sharding | NOT NEEDED |  |  |
| 31 | Partitioning | NOT NEEDED |  |  |
| 32 | Replication | PLATFORM | Shopify |  |
| 33 | Leader election | NOT NEEDED |  |  |
| 34 | CAP theorem | NOT NEEDED |  | Shopify keeps inventory consistent at checkout. |
| 35 | Eventual consistency | Document | docs/RUNBOOK.md | Search and filters update shortly after product edits; supplier stock syncs on the supplier app's schedule. |
| 36 | Optimistic locking | BUILD | scripts/normalise-products.ts | Compares updatedAt before writing and skips, with a warning, products edited by someone else since the read. |
| 37 | Pessimistic locking | NOT NEEDED |  |  |
| 38 | Distributed locks | BUILD | scripts/lib/lock.ts, workflow concurrency groups | Lock file plus GitHub Actions concurrency groups so two script runs never overlap. |
| 39 | Race conditions | BUILD | items 36 and 38 | Shopify prevents overselling at checkout. |
| 40 | Deadlocks | NOT NEEDED |  |  |
| 41 | Memory leaks | BUILD | assets/*.js, scripts/lib/prepare.ts | Custom elements remove listeners and observers on disconnect; the image pipeline processes files one at a time per worker. |
| 42 | Garbage collection | NOT NEEDED |  | Covered by 41. |
| 43 | Thread safety | NOT NEEDED |  |  |
| 44 | Backpressure | BUILD | scripts/lib/prepare.ts (pool) | Image pipeline processes 4 at a time; API writes stay within the cost budget. |
| 45 | Autoscaling | PLATFORM | Shopify |  |
| 46 | Horizontal scaling | PLATFORM | Shopify |  |
| 47 | Vertical scaling | PLATFORM | Shopify plan | Basic plan is enough at launch; consider Shopify plan when staff accounts or reports need it (docs/HANDOVER.md). |
| 48 | CDN | PLATFORM | Shopify CDN | Pages, assets and images. |
| 49 | Edge caching | PLATFORM | asset_url, image_url | Files are versioned and cached at the edge. |
| 50 | Cache invalidation | PLATFORM | Shopify | Shopify clears caches on publish and edit. |
| 51 | Feature flags | BUILD | config/settings_schema.json | Theme settings: Christmas mode, newsletter offer pop-up, Sale menu item, Klarna message, reviews threshold; gift finder and reviews are removable sections. |
| 52 | Blue-green deployment | PLATFORM | Online Store > Themes | Publishing a theme is instant; the previous theme stays in the library. |
| 53 | Canary releases | NOT NEEDED |  | Preview links instead. |
| 54 | Rolling deployments | PLATFORM | Shopify |  |
| 55 | Rollbacks | BUILD | docs/RUNBOOK.md, scripts --revert | Backup theme kept; Git tags per release; data scripts log before values and have --revert <log>. |
| 56 | Health checks | BUILD | scripts/smoke-test.ts | Loads home, a collection, search and a product, adds to bag and opens checkout; runs after every deploy. |
| 57 | Liveness and readiness probes | PLATFORM | Shopify | The smoke test covers the storefront. |
| 58 | Monitoring | BUILD | docs/RUNBOOK.md | Free UptimeRobot monitors on the home page and one product page (operator creates the account); Shopify's web performance report. |
| 59 | Logging | BUILD | scripts/lib/log.ts | JSON lines per script run with a run id; tokens and emails redacted; never logs customer data. |
| 60 | Distributed tracing | NOT NEEDED |  |  |
| 61 | Metrics | BUILD | scripts/weekly-report.ts | Orders, conversion rate, average order value, top products; Core Web Vitals link. |
| 62 | Alerts | BUILD | scheduled.yml, Shopify Flow, UptimeRobot | Uptime alerts; Flow alert for orders not fulfilled in 3 working days; an issue opens when a scheduled job fails; domain renewal reminder in RUNBOOK. |
| 63 | SLOs | Document | docs/RUNBOOK.md | Storefront available 99.9% (Shopify); LCP under 2.5 s at p75; 95% of orders fulfilled within 3 working days. |
| 64 | SLIs | Document | docs/RUNBOOK.md | How each SLO is measured and where. |
| 65 | Error budgets | Document | docs/RUNBOOK.md | When an SLO is missed: pause new products, fix first. |
| 66 | Observability | Document | docs/RUNBOOK.md | One page on how monitoring, reports and alerts fit together. |
| 67 | Secrets management | BUILD | .env.example, docs/RUNBOOK.md | Environment secrets only; rotation steps in the runbook. |
| 68 | IAM | BUILD | docs/STORE_SETUP_CHECKLIST.md | Staff permissions by role, two-step login required, least-privilege API scopes. |
| 69 | OAuth | PLATFORM | Dev Dashboard app install |  |
| 70 | JWT rotation | PLATFORM | docs/RUNBOOK.md | Rotate the Admin API token and Theme Access password every 6 months and when anyone leaves. |
| 71 | TLS | PLATFORM | Shopify | Shopify certificate on ornis.shop. |
| 72 | Encryption at rest | PLATFORM | Shopify |  |
| 73 | Encryption in transit | PLATFORM | Shopify |  |
| 74 | WAF | PLATFORM | Shopify |  |
| 75 | DDoS protection | PLATFORM | Shopify |  |
| 76 | CORS | NOT NEEDED |  | No custom API. |
| 77 | CSRF | PLATFORM | Shopify forms | Shopify form tokens; no custom POST endpoints. |
| 78 | SQL injection | PLATFORM | Shopify |  |
| 79 | XSS | BUILD | theme, assets/*.js | Liquid output escaped; no innerHTML with URL or user content (server-rendered section HTML is parsed with DOMParser); no inline event handlers. |
| 80 | SSRF | BUILD | scripts/lib/images.ts | The image re-host step only accepts https URLs on an allow-list of supplier image hosts. Tested. |
| 81 | Database migrations | BUILD | scripts/setup-store.ts | Creates metafield and metaobject definitions as code, idempotent. |
| 82 | Schema versioning | BUILD | shop metafield ornis.schema_version, CHANGELOG.md |  |
| 83 | Disaster recovery | BUILD | docs/RUNBOOK.md | Restore steps: republish the backup theme, re-import products from the latest export. |
| 84 | Backups | BUILD | scripts/backup-export.ts, scheduled.yml | Weekly export of products, collections, pages, menus, redirects and metaobjects to the repository; theme in Git; backup theme copy. |
| 85 | Failover | PLATFORM | Shopify |  |
| 86 | Multi-region deployment | NOT NEEDED |  |  |
| 87 | Chaos engineering | NOT NEEDED | docs/ACCEPTANCE.md | But tested: declined card, last item sold during checkout, supplier app disconnected. |
| 88 | Cost optimization | BUILD | docs/HANDOVER.md | Every app and its monthly cost, the Shopify plan and the expected monthly total. |
| 89 | Cold starts | NOT NEEDED |  |  |
| 90 | Serverless limits | NOT NEEDED | scripts/backup-export.ts | Admin API cost limits respected; paginated exports. |
| 91 | Latency | BUILD | docs/ACCEPTANCE.md | Record Lighthouse and real-user Core Web Vitals. |
| 92 | Throughput | PLATFORM | Shopify |  |
| 93 | P99 latency | Document | docs/RUNBOOK.md | Shopify reports p75; recorded with the limit noted. |
| 94 | Tail latency | PLATFORM | Shopify |  |
| 95 | Network partitions | Document | docs/RUNBOOK.md | What happens if the supplier app or a payment method is down. |
| 96 | Clock skew | BUILD | assets/delivery-date.js | Delivery estimates and Christmas cut-offs use UK time (Europe/London), not the visitor's time zone. Tested. |
| 97 | DNS | BUILD | docs/HANDOVER.md | Records for ornis.shop from Shopify's domain settings, plus SPF, DKIM and DMARC for the sender email. |
| 98 | TCP vs UDP | NOT NEEDED |  |  |
| 99 | HTTP/2 and HTTP/3 | PLATFORM | Shopify |  |
| 100 | gRPC | NOT NEEDED |  |  |
| 101 | Webhooks | NOT NEEDED |  | Flow and apps cover launch needs; revisit for custom integrations. |
| 102 | API versioning | BUILD | scripts/lib/config.ts | Admin API pinned to 2026-10; check every quarter, upgrade before 1 October 2027. |
| 103 | Semantic versioning | BUILD | CHANGELOG.md, Git tags | Theme releases tagged v2.0.0 upward. |
| 104 | Infrastructure as code | BUILD | theme/, scripts/lib/store-plan.ts, docs/STORE_SETUP_CHECKLIST.md | Theme in Git, store schema in setup-store, admin settings in the checklist. |
| 105 | Terraform | NOT NEEDED |  |  |
| 106 | Helm charts | NOT NEEDED |  |  |
| 107 | Build caching | BUILD | ci.yml | npm dependency cache in CI. |
| 108 | Dependency hell | BUILD | package-lock.json, dependabot.yml, ci.yml | Lockfile, Dependabot, npm audit in CI. |
| 109 | Production incidents | BUILD | docs/RUNBOOK.md | Entries: site down, checkout failing, wrong price live, product sold but supplier out of stock, parcel late complaints, chargeback, placeholder text found. |
| 110 | On-call | Document | docs/RUNBOOK.md | Operator first, owner second, with expected response times. |
| 111 | Postmortems | BUILD | docs/POSTMORTEM_TEMPLATE.md | Short and blameless. |
