# Architecture

**Status:** Target architecture plus a functional local demo implementation. **Not deployed.**
**Target:** `https://esimprove.com` on Netlify, with a provider-neutral supplier and payment layer.
**Current public origin:** configured only through `SITE_URL`; defaults to `http://localhost:3000` because the domain is not owned.

> This document contains both the production target and notes on what actually exists. Where they
> differ, the implementation notes and [`README.md`](../README.md) are authoritative. No live
> supplier, payment, email, managed-database, or hosting integration exists.

## 0. Current implementation snapshot (2026-10-23)

| Area | Implemented locally | Not implemented / not evidenced |
|---|---|---|
| App | Next.js 16.4.2 App Router, React 19.3.1, TypeScript 5.9.3 | Netlify deployment, staging, production runtime |
| UI | Custom CSS design tokens/components; responsive storefront, auth, portal, admin | Tailwind, browser E2E, axe audit, visual regression |
| Data | Drizzle schema + SQL migration; PGlite local DB; seed 8 regions / 33 destinations / 99 demo plans | Managed PostgreSQL, pooling, backup/restore, migration rollback |
| Auth | Custom DB sessions, scrypt, admin TOTP, rate limits, server guards | Email verification, password reset, backup codes, full RBAC, security review |
| Catalogue | Local demo queries/search; published/draft/archived status; admin price/status update | Supplier catalogue sync, supplier provenance, real coverage/network data |
| Checkout | Server cart, price revalidation, idempotency, order snapshots, mock checkout | Real payment provider, refunds, disputes, tax/FX |
| Payments | Signed mock webhook, dedupe, amount/currency validation, shared processing path | Stripe or another processor; live/test credentials |
| Fulfillment | Outbox, jobs, deterministic mock supplier, retry/backoff, admin retry | Real supplier API, uncertain-outcome reconciliation, supplier webhooks |
| Activation | AES-256-GCM envelope encryption, hashed guest tokens, access audit | KMS/key rotation drill, production custody |
| Email | Local logger, redacted stored body | Real email provider, verified domain, bounce/complaint handling |
| Admin | Basic overview/orders/jobs/plans/emails/settings | Full RBAC, four-eyes approvals, re-auth, finance/support modules |
| Tests | 50 Vitest tests across 6 files; local HTTP smoke checks | Playwright/axe, load, managed-Postgres, staging, penetration test |

The demo uses the reserved `rsp.demo.invalid` domain for activation data. It cannot connect to a
real mobile network.


---

## 1. Goals and constraints

### Goals

- Trustworthy, mobile-first storefront for travel eSIMs.
- Server-rendered SEO pages backed by real supplier catalogue data.
- Correct money handling with immutable snapshots and no floating-point currency arithmetic.
- A customer who pays either receives a working eSIM or a recoverable failure/refund path.
- Customer portal with access-controlled activation data.
- Admin operations with least privilege, 2FA, auditability, and four-eyes approvals.
- Support, refunds, disputes, and finance controls from the start.
- Cheap to run initially; no microservices, no self-managed servers.
- Honest feature flags: unsupported or unverified integrations stay visibly disabled.

### Constraints

- Netlify free/low tier unless the owner approves spend.
- No local Docker/PostgreSQL in the current environment; tests need a portable database approach.
- Domain ownership unverified; no production TLS/DNS yet.
- Supplier/payment approvals and credentials absent.
- Legal entity/jurisdiction unknown; legal copy must remain configurable and marked draft.
- No live money or live provisioning until every launch gate has evidence.

### Non-goals for MVP

- Multi-supplier automatic routing.
- Gifting, B2B billing, referrals, affiliate tracking, loyalty.
- Native iOS/Android apps.
- Public status page (optional later).
- Automated competitor price monitoring.
- In-house MVNO/telecom core. We are a reseller, not an operator.

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Web application | Next.js App Router, React, TypeScript | Implemented: Next.js 16.4.2, React 19.3.1, TypeScript 5.9.3; Server Components by default |
| Styling | Custom CSS design tokens/components | Implemented in `app/globals.css`; no Tailwind dependency; WCAG 2.2 AA target, not audited |
| Hosting/CDN | Netlify (OpenNext adapter) | Not deployed; `netlify.toml` exists as configuration only |
| Database | PostgreSQL | Client path exists; no managed instance provisioned |
| ORM/migrations | Drizzle ORM + SQL migration | Implemented; explicit migration runner; managed-Postgres run not tested |
| Local/test DB | PGlite | Implemented at `.pglite` and in-memory tests; not allowed in production |
| Auth | Custom DB sessions + scrypt + admin TOTP | Interim local implementation; Better Auth was deferred, not adopted |
| Payments | Provider-neutral interface; signed mock active | Stripe adapter disabled; no processor approval or credentials |
| Supplier | Provider-neutral interface; deterministic mock active | eSIM Access adapter disabled; no credentials/approval |
| Email | Provider-neutral transport; local logger active | Resend adapter disabled; no verified domain |
| Jobs | Postgres outbox + queue + protected local job route | Netlify Background/Scheduled Functions not deployed |
| Money | Integer minor units + explicit currency/exponent | Implemented with safe-integer guards; tax/FX production rules remain open |
| Errors | Sentry (proposed, free tier) | Not connected |
| Uptime | Better Stack/UptimeRobot (proposed, free tier) | Not connected |
| Analytics | First-party, consent-gated events (proposed) | Not connected; no third-party tracking |
| CI | GitHub Actions + Netlify build | No CI or GitHub repository configured |
| Testing | Vitest | 50 tests pass locally; Playwright/axe/load tests not installed |

---

## 3. Runtime topology

```text
Browser
  |
  | HTTPS, host-only secure cookies
  v
Netlify CDN / Edge
  |-- static assets, cache, image CDN
  |-- Next.js middleware (host canonicalisation, security headers, staging gate)
  |-- Next.js SSR / Server Actions / Route Handlers (Node function)
  |
  +--> PostgreSQL (pooled, external)
  |      orders, payments, catalog, jobs, outbox, audit, encryption metadata
  |
  +--> Payment provider (server-to-server, signed webhooks)
  |
  +--> Supplier API (server-to-server, secrets in Netlify env)
  |
  +--> Transactional email provider
  |
  +--> Error tracking / uptime monitoring
  |
Netlify Background Function  <--- signed internal trigger
  |-- claim fulfillment/email/reconcile jobs
  |-- call supplier, process webhook, update DB, enqueue next outbox event
  |
Netlify Scheduled Function
  |-- sweep due jobs, reconcile stuck orders, health checks, expiry reminders
```

### Why a modular monolith

- One deployable app, one database, one transaction boundary.
- Modules have explicit interfaces and no cross-module imports of supplier/payment raw payloads.
- Easier to reason about money correctness and audit than microservices.
- Can split later only if a measured constraint justifies it.

### Module boundaries

| Module | Responsibility | Must not do |
|---|---|---|
| `auth` | Registration, sessions, verification, password reset, 2FA, roles | Know supplier payloads |
| `catalog` | Destinations, plans, supplier catalogue normalisation, search | Call payment provider |
| `suppliers` | Adapter contract, credentials, catalogue sync, orders, status, usage, top-up, health | Leak raw supplier payloads into UI/domain |
| `pricing` | Markup, FX, rounding, snapshots, price history | Mutate historic order prices |
| `cart` | Server-side cart, quantity limits, price revalidation | Trust client prices |
| `checkout` | Order creation, terms consent, idempotency, payment handoff | Provision eSIM directly |
| `payments` | Payment adapter, webhook verification, refunds, disputes | Trust redirects |
| `orders` | Financial and fulfillment state machines, timelines | Infer activation from payment |
| `provisioning` | One idempotent job per item, LPA retrieval, secure storage | Blindly retry uncertain supplier orders |
| `portal` | Customer eSIM access, receipts, support, privacy requests | Expose activation data without authorization |
| `notifications` | Transactional email, bounces, resends, templates | Put QR/LPA in ordinary email images/logs |
| `refunds` | Customer refund workflow, four-eyes approvals | Treat supplier balance credits as card refunds |
| `support` | Tickets, linked orders, messages, attachments | Let customers see internal notes |
| `admin` | Operations dashboards, approvals, finance, audit, settings | Allow silent impersonation |
| `analytics` | Privacy-conscious first-party events | Receive activation data or secrets |
| `compliance` | Consent, policy versions, retention, privacy requests, restricted destinations | Assert legal compliance without review |
| `audit` | Append-only event trail | Allow updates/deletes |
| `settings` | Flags, legal config, tax settings, incident banner | Store unencrypted secrets |

---

## 4. Request and data flows

### 4.1 Catalogue synchronisation

> **Current local implementation:** no supplier sync exists. The catalogue is seeded from
> `data/demo-catalog.ts`; every plan is marked `isDemo`. The flow below is the production target.

1. Scheduled/admin-triggered sync calls `SupplierAdapter.listProducts()`.
2. Raw response is validated with Zod and stored in `supplier_products.raw_payload` with a checksum and fetch time.
3. A normaliser maps supplier fields to `plans`/coverage without inventing missing attributes.
4. Price changes are recorded in `price_history`; significant changes become `pending_review`, not instantly live.
5. A plan is published only with supplier provenance, selling price, currency, terms, and availability.
6. No request path calls the supplier to render a page; the catalogue is served from our DB/cache.

### 4.2 Checkout and payment

> **Current local implementation:** cart, price revalidation, idempotency, order snapshots, and a
> mock checkout exist. The payment provider is a local mock; there is no hosted checkout, real
> processor, refund, dispute, FX, or tax service.

1. User picks a plan; server validates plan status and price.
2. Cart stores server-derived price/currency snapshot. Client display is never trusted.
3. At checkout, the server recalculates price and FX. If it changed, return a `price_changed` conflict and disclose the new total before payment.
4. In one transaction: create/find idempotency key, create order, snapshot each item cost/price/FX/tax, record terms version and consent, create pending payment record.
5. Payment adapter creates a hosted checkout session. Only the provider's reference/token is stored.
6. Return page shows “awaiting confirmation”, never “paid”.
7. Provider sends a signed webhook. Verify signature, insert `webhook_events` with a unique provider event ID (replay protection), then in a transaction update payment state, enqueue fulfillment job via outbox, and mark the webhook processed.
8. If the webhook is duplicated, the unique constraint makes it a no-op; the handler still returns 2xx.
9. If out-of-order provider events arrive, compare event timestamps/version and keep the most advanced valid state; never regress from paid to pending on an older event.

### 4.3 Fulfillment

> **Current local implementation:** outbox, job claiming, retries, admin retry, deterministic mock
> supplier orders, encrypted activation storage, and local email logging exist. No supplier API is
> called and no uncertain-outcome reconciliation process is implemented.

1. A DB transaction inserts a single `fulfillment_jobs` row per order item with a unique idempotency key.
2. An outbox event triggers the background worker with a signed internal request. The request contains only the job ID, never customer secrets.
3. Worker claims a due job using `FOR UPDATE SKIP LOCKED`, sets a lock lease, and records attempt count.
4. Worker validates the plan snapshot, order paid status, and supplier availability.
5. Worker calls supplier order with our unique `transactionId` and supplier idempotency. It does not create a second order if an uncertain response occurs.
6. On success, retrieve allocated profiles (or wait for webhook), validate ICCID/LPA, encrypt LPA, store metadata, and mark eSIM `ready_to_install`.
7. Update order fulfillment state, append an order event, and enqueue a delivery email through the outbox.
8. Delivery email contains a link to an authenticated/tokenised page, not a raw QR image.
9. Email failure does not revert delivery; the customer can still access the eSIM in the portal. Email status is tracked separately.
10. Unknown supplier outcome: mark `under_investigation`, alert admin, reconcile using the supplier's transaction/order reference before any retry.
11. If fulfillment is unrecoverable: mark `failed`, notify customer honestly, and initiate refund workflow. Never mark delivered.

### 4.4 Customer access

> **Current local implementation:** guest access uses a random high-entropy bearer token stored as
> a hash with expiry; signed-in owners use the portal. There is no email-verification lookup step,
> and admin access is basic. Every demo activation view is audited.

- Signed-in owner can access their eSIM pages after authorization.
- Guest delivery links use a random high-entropy token stored as a hash, with an expiry and revocation. They do not expose the LPA directly in the URL.
- Guest lookup requires order reference plus email verification (one-time code), not just an email address.
- Every activation-data access is authorized, rate-limited, and audited.
- The QR is rendered server-side after authorization; the LPA is never sent to analytics.
- Deleting the display link does not cancel the supplier credential. Re-issue is a separate audited operation.

### 4.5 Admin approvals

> **Current local implementation:** basic admin pages and server actions exist, guarded by
> `requireAdmin()` and admin TOTP. Four-eyes approvals, role granularity, break-glass access, and
> admin re-authentication are **not** implemented.

- Admin actions are role-checked server-side, not just hidden in UI.
- Refunds above a threshold, bulk price changes, supplier credential changes, and role changes create an `admin_approval` request.
- A second authorized admin must approve. Self-approval is rejected by a DB constraint/checked transaction.
- Approvals expire; execution is idempotent.
- Break-glass access is time-bounded and creates a high-severity audit event.

---

## 5. State machines

> **Current local implementation:** the code in `lib/state.ts` is authoritative. Payment states are
> `pending`, `authorized`, `paid`, `failed`, `refunded`; fulfillment adds `ready` and
> `under_investigation`; order states are `pending_payment`, `processing`, `delivered`, `failed`,
> `cancelled`. Refund/dispute sub-states in the diagrams below are production targets, not built.

### 5.1 Payment state

```text
pending -> authorized -> paid -> partially_refunded -> refunded
   |            |          |              |
   |            |          +-> disputed    +-> disputed
   |            +-> failed
   +-> failed
```

Rules:
- `paid` is set only from a verified provider event/API result.
- `disputed` is orthogonal to refund state; model it as a separate dispute record and a payment condition.
- Never infer paid from a browser redirect.
- Amounts are immutable; refunds and disputes have their own records.

### 5.2 Fulfillment state

```text
not_started -> queued -> provisioning -> ready -> delivered
                    |          |           |
                    |          +-> failed  +-> cancelled (admin)
                    +-> failed
failed -> under_investigation -> (retry only after reconciliation) -> ready/failed
ready -> delivered (email sent/accessible)
```

- `delivered` means the customer can access a validated activation credential, not merely that an email was sent.
- `failed` can trigger refund.
- `under_investigation` is for uncertain supplier outcomes.
- An order can have multiple items with different states; the order-level state is the aggregate and displayed with item detail.

### 5.3 eSIM display states

`awaiting_provisioning`, `ready_to_install`, `active` (only with supplier evidence), `expired`, `failed`, `cancelled`, `refunded`.

`installed` is not inferred. If the UI offers a customer confirmation, label it “I installed this” and keep it distinct from supplier-verified activation. Never show a verified activation unless the supplier event supports it.

---

## 6. Supplier abstraction

> **Current local implementation:** `lib/integrations/supplier/types.ts` defines a smaller
> interface (`createOrder`, `getOrder`, `getEsims`, `healthCheck`). The mock adapter is active; the
> eSIM Access live adapter throws `IntegrationDisabledError`. The richer interface below is a
> production target, not built.

```ts
export interface SupplierAdapter {
  readonly key: string;
  readonly capabilities: SupplierCapabilities;

  validateCredentials(): Promise<Result<void>>;
  listProducts(input?: CatalogueQuery): Promise<Result<SupplierProduct[]>>;
  getProduct(externalId: string): Promise<Result<SupplierProduct>>;
  getBalance(): Promise<Result<Balance>>;
  createOrder(input: CreateSupplierOrder): Promise<Result<SupplierOrder>>;
  getOrder(supplierOrderRef: string): Promise<Result<SupplierOrder>>;
  getEsims(supplierOrderRef: string): Promise<Result<SupplierEsim[]>>;
  getUsage(esimRef: string): Promise<Result<UsageSnapshot>>;
  cancelOrder?(input: CancelOrder): Promise<Result<CancellationResult>>;
  topUp?(input: TopUpOrder): Promise<Result<TopUpResult>>;
  parseWebhook(input: RawWebhook): Promise<Result<SupplierEvent>>;
  healthCheck(): Promise<Result<HealthCheck>>;
}
```

Requirements:
- Normalised types and Zod validation at the edge.
- Credentials loaded from environment only; never serialised to the client.
- Timeouts, bounded retries for safe/idempotent reads, `Retry-After` support.
- Circuit breaker per supplier/operation.
- Request/response logging redacts activation data, access codes, secrets, and unnecessary personal data.
- Supplier transaction references stored separately from our order numbers.
- A response parser must reject malformed LPA/ICCID rather than store it.
- A feature flag controls whether an adapter can create real orders.
- No automatic supplier switching for an uncertain order. Multi-supplier is Version 2.

eSIM Access specifics are documented in `docs/INTEGRATION-RESEARCH.md`. At minimum:
- `transactionId` is our idempotency key; uniqueness enforced locally too.
- Webhooks must be deduplicated by `notifyId`.
- No documented HMAC webhook signature; use a random endpoint path, IP allowlist if stable, reconcile, and document residual risk.
- Cancellation credits the supplier balance, not the customer.
- Usage is delayed; display “last updated” and do not say real-time.

---

## 7. Payment abstraction

> **Current local implementation:** `lib/integrations/payments/types.ts` defines
> `createCheckout` and `verifyWebhook`. The mock provider signs local payloads with HMAC-SHA256;
> the disabled Stripe adapter throws. There is no refund/dispute implementation.

```ts
export interface PaymentProvider {
  readonly key: string;
  createCheckout(input: CreateCheckout): Promise<Result<CheckoutSession>>;
  verifyWebhook(rawBody: Uint8Array, headers: Headers): Promise<Result<PaymentEvent>>;
  getPayment(providerPaymentId: string): Promise<Result<PaymentStatus>>;
  refund(input: RefundRequest): Promise<Result<RefundResult>>;
  getDispute?(providerDisputeId: string): Promise<Result<Dispute>>;
}
```

- Hosted checkout or tokenised components only.
- Payment webhook signatures verified against the raw body before any DB write other than a rejected-event audit row.
- Idempotency key per order/payment attempt; unique provider payment ID.
- Refunds require an idempotency key and four-eyes approval where above threshold.
- Provider event IDs unique in `webhook_events`.
- Never store card numbers/CVV. Do not log full webhook bodies if they contain personal data; store a redacted/minimal event plus a hash.

---

## 8. Money, FX, tax, and time

### Representation

- `amount_minor BIGINT`: integer in the currency's minor unit.
- `currency CHAR(3)`: ISO 4217.
- `currency_decimals SMALLINT`: 0, 2, 3, etc., from configuration.
- Supplier price scale stored explicitly (eSIM Access examples use 1/10,000 USD).
- FX snapshot stored as an integer ratio (`rate_nano BIGINT` at 1e9, plus base/quote and source/time).
- Rounding mode is fixed per currency/market and applied in one shared money function, with tests.
- Tax, fees, discounts, supplier cost, and FX are separate fields. Never derive historic totals from today's settings.

### Rules

- No JavaScript `number` for monetary arithmetic beyond safe integer display; use `bigint`/Decimal internally and parse/validate at boundaries.
- Client sends plan ID and quantity, not prices.
- Server recomputes and locks the price at checkout. A changed price requires re-consent.
- The charge currency and any conversion are disclosed before payment.
- If charge and display currencies differ, show both and the FX rate/time.
- Refunds calculate in the original captured currency; FX differences are disclosed/handled by policy.
- All DB timestamps `timestamptz` UTC; display in locale.
- Idempotency keys are unique per create order, payment attempt, refund, and supplier order.
- Optimistic locking (`version`) on orders/payments/eSIMs; DB transactions for every state change.
- Append-only triggers for audit and financial events; no ad-hoc mutation of history.

---

## 9. Jobs, outbox, and failure handling

### Outbox

Every state change that requires an email/job writes an `outbox_events` row in the same DB transaction. A dispatcher claims due events and invokes a background function with a signed internal request. This prevents “payment recorded but no fulfillment job” and “fulfillment recorded but no email”.

### Queue

- `fulfillment_jobs`: unique idempotency key, status, attempts, `next_attempt_at`, lock lease, last safe error.
- Claim with `SELECT ... FOR UPDATE SKIP LOCKED`.
- Retry only safe operations or after supplier reconciliation.
- Exponential backoff with jitter, max attempts, then alert.
- Dead jobs are visible in admin with controlled retry/resolve actions.
- Email sends get their own idempotency key to avoid duplicate delivery links.

### Failure matrix

| Failure | Behaviour |
|---|---|
| Duplicate payment webhook | Unique event ID; no-op; 2xx |
| Duplicate/out-of-order supplier webhook | Deduplicate `notifyId`; apply monotonic state; reconcile |
| Supplier timeout on create | Do **not** blindly retry; mark uncertain; reconcile by our transaction ID/order |
| Payment paid, supplier down | Keep paid; queue retry; alert; customer gets honest delay email |
| Supplier returns malformed LPA | Do not deliver; mark failed/investigation; refund path |
| Email fails | eSIM still delivered in portal; retry email; track status |
| Low supplier balance | Alert before depletion; block new live orders if below reserve |
| Price changed during checkout | Show new total and require consent; do not silently charge |
| Double-click pay | One order/payment idempotency key; disable UI; server dedupe |
| Refund provider fails | Refund remains pending/failed; alert; do not tell customer it succeeded |
| Webhook verification fails | Reject, log minimal audit, alert; never mutate order |

### SLAs to configure (not promises yet)

- Provisioning target: 5 minutes from confirmed payment; alert if stuck > 10 minutes.
- Customer delay email: if not delivered within 15 minutes.
- Support first response: owner-defined, not invented.
- Reconciliation sweep: every 5 minutes for due jobs, hourly health checks.
- Low balance threshold: owner-defined reserve + expected daily sales.

---

## 10. Security architecture

### Identity and sessions

> **Current local implementation:** custom DB-backed sessions with scrypt password hashes, an
> HTTP-only session cookie, rate limits, and TOTP for the seeded admin. Better Auth was deferred.
> Email verification, password reset, backup codes, session revocation on password change, and
> full RBAC are not implemented. This needs independent review before production.

- Custom database sessions. Session cookies are host-only, `HttpOnly`, `SameSite=Lax`, and `Secure`
  when `SITE_URL` is HTTPS; no `Domain` attribute.
- Separate short-lived admin session policy and mandatory TOTP for the demo admin.
- Email verification and password reset are not implemented; they are launch blockers for a real
  customer account system.
- Rate limits exist for login, registration, and 2FA; not every route is covered.
- CSRF: framework protections are relied on; webhooks are authenticated by signature and excluded
  from cookie auth. A dedicated CSRF/origin review is outstanding.

### Authorization

- Every customer and admin read/write is authorized server-side against ownership/role.
- No trust in hidden UI controls.
- Object-level authorization tests: order, eSIM, ticket, invoice, activation data.
- Admin permissions checked per action, not just “is admin”.
- Four-eyes approvals enforced in a transaction.
- No impersonation; break-glass is explicit and logged.

### Activation data

- LPA/activation code treated as a secret.
- AES-256-GCM envelope-style encryption: per-record DEK wrapped by a versioned KEK from environment/secret store; store `key_version`, IV, auth tag, ciphertext.
- Key rotation runbook; rewrap jobs; no key in DB or client.
- Access audited (actor, session, order, time, request ID, IP hash).
- No activation data in URLs, server logs, analytics, error messages, emails as images, or third-party QR services.
- QR rendered server-side or locally in browser after authorization, using a library that does not call a third party.
- Delivery links are bearer tokens with expiry/revocation but separate from the supplier credential.

### Application hardening

- Zod validation on all inputs; output encoding by React plus server-side sanitisation for user content.
- CSP with nonce, HSTS after HTTPS verification, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame-ancestors `'none'`.
- File uploads: allowlist MIME + magic bytes, size cap, random storage keys, no execution, private storage, malware scanning before customer-facing download. If scanning is unavailable, attachments remain disabled.
- Dependency and secret scanning in CI (`npm audit`, OSV, Gitleaks), lockfile, pinned toolchain.
- No stack traces or raw provider errors shown to customers.
- PII minimisation in logs; correlation IDs only.
- Backups encrypted and access-controlled.

### Abuse/fraud controls

- Velocity limits by IP/email/order, disposable-email signals (as a review signal, not automatic denial), high-value/manual review queue.
- Coupon usage limits and unique redemption constraints.
- Account takeover protections: rate limiting, session revocation, security notices, optional 2FA for customers.
- Blocklists/sanctions screening at checkout or before provisioning, as legally required.
- Human review path; never silently block a legitimate customer forever.
- Card testing protection via provider Radar/rules where available.

---

## 11. SEO, accessibility, i18n, performance

### SEO

- Server-rendered destination, region, plan, guide, and legal pages.
- Canonical URLs are built from the single `SITE_URL` value. The default is local; the verified
  public origin must be supplied before launch. Do not add a second origin setting.
- `www` 301 to apex; staging and previews `noindex` (planned; no domain/DNS yet).
- XML sitemap generated from published records only; demo mode disallows indexing.
- `robots.txt` disallows admin/account/API; demo mode disallows everything.
- Structured data: Organization only with verified details; Product/Offer only with real price/availability; BreadcrumbList; FAQPage only for genuine on-page FAQs. No fake aggregate ratings.
- Open Graph metadata with original assets.
- No programmatic thin destination pages. Every destination requires supplier coverage and useful, original content.
- hreflang architecture from day one, even if English-only at launch.

### Accessibility

- WCAG 2.2 AA target: semantic landmarks/headings, keyboard operability, visible focus, skip links, labelled inputs, accessible error summary, focus-managed dialogs, 44px touch targets, contrast, reduced-motion support, no colour-only meaning.
- axe checks in CI; manual keyboard/screen-reader checks for checkout, QR page, and admin.
- QR page must include manual LPA text, copy button, install instructions, and print-friendly view.

### i18n

- Message catalogs with typed keys; no hardcoded user-facing strings in components.
- Locale-aware formatting for dates, numbers, and currency.
- Currency/locale change must not silently change the selected plan, quantity, or checkout state; revalidate price and show any change.
- URL strategy planned as locale-prefixed only when the second locale is real; avoid duplicate English pages.

### Performance budgets (targets, not measured)

- Mobile p75 LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 on representative pages.
- Minimal client JS on content pages; server components by default.
- Optimise images and fonts; no render-blocking third parties.
- Cache catalogue pages at the edge with revalidation on catalogue changes.
- Load test catalogue search and checkout with realistic supplier latency simulations.

---

## 12. Observability and operations

- Structured JSON logs with request/correlation ID, route, status, duration, redacted actor/order reference.
- Order timeline: append-only `order_events` plus audit log.
- Error tracking with PII scrubbing (Sentry proposed).
- Uptime checks for apex/staging health, payment webhook, supplier API, email provider.
- Admin supplier health page: last sync, API latency/error rate, provisioning success, balance, stuck jobs, recent failures.
- Alert routing: email/Slack to a monitored address; no invented on-call promises.
- Incident severity levels and customer banner controlled by settings.
- Health endpoint checks DB connectivity, migration version, job backlog, feature flags, and last successful sync, without revealing secrets.
- Runbooks: deploy, rollback, restore, rotate credentials, rotate activation KEK, recover failed orders, disable payments/supplier, resend delivery, respond to chargeback, privacy request.
- Backups: provider PITR plus encrypted logical exports. Stated RPO/RTO are targets until a restore is timed and documented. Do not claim them before testing.
- Environments: local, staging, production; separate secrets and databases; no production data in staging without anonymisation.

### Netlify constraints to handle

- Serverless functions are stateless and can cold-start; use pooled DB connections and avoid per-request migrations.
- Background Functions can run 15 minutes; Scheduled Functions only 30 seconds. Sweeper must enqueue, not do long work itself.
- Scheduled Functions only run on published deploys; staging sweeps must be manually invoked or use an explicitly enabled test schedule.
- Free plan password protection is unavailable; staging uses a custom Edge Function Basic Auth + `noindex` and a non-public hostname.
- Next.js middleware must not rely on Node-only APIs.
- Request body size and function timeout limits need tests for support attachments.
- Use Netlify's domain panel for exact DNS values; do not hardcode stale IPs in docs.

---

## 13. Environment and configuration

- `.env.example` documents every variable; no secret values committed.
- Validate environment at startup with Zod. Production refuses to boot if critical secrets are missing.
- Feature flags (server-side):
  - `PAYMENTS_LIVE_ENABLED` (default false)
  - `SUPPLIER_LIVE_ENABLED` (default false)
  - `EMAIL_LIVE_ENABLED` (default false)
  - `CATALOGUE_SYNC_ENABLED` (default false)
  - `ANALYTICS_ENABLED` (default false)
  - `ADMIN_2FA_REQUIRED` (default true)
  - `STAGING_ACCESS_ENABLED` (default false)
  - `MAINTENANCE_BANNER_ENABLED` (default false)
- `SITE_URL` is the only public-origin configuration. `assertProductionSafe()` fails closed if a
  production configuration still has demo mode, demo seed, localhost origin, missing secrets, or a
  live flag enabled.
- Kill switches disable new checkout/orders without corrupting in-flight data.
- A disabled integration is visible in admin and must not render a purchase button that cannot complete.

---

## 14. Testing strategy

### Implemented locally

- Unit: money formatting/safety, pricing/rounding/tax, state transitions, crypto, TOTP, password
  hashing, mock supplier determinism, disabled adapters, payment signature validation.
- Integration with PGlite: migrations/seed, checkout/idempotency, signed webhook processing and
  dedupe, failure path, amount/currency mismatch, fulfillment retry, access-control tokens.
- Local HTTP smoke checks: storefront/destination/plan/guide/legal/auth pages, admin/portal
  redirects, health endpoint, sitemap, robots.

Current result: **50 tests passed across 6 files**; typecheck, lint, and production build pass.

### Planned / not yet run

- E2E with Playwright: search, plan, cart, guest checkout, delivery access, portal, admin
  permissions, a11y.
- axe-core accessibility audit and manual keyboard/screen-reader checks.
- Managed-PostgreSQL compatibility, pooling, migration rollback, backup/restore.
- Contract tests for a real supplier adapter, only after credentials and approval.
- Load tests with supplier latency simulation.
- Security tests: CSRF/origin, rate limits, webhook rejection, CSP, secret leakage, dependency scan.
- Staging deploy, smoke test, and rollback drill.
- Real eSIM install on iPhone and Android in a supplier-approved test path.


---

## 15. Architecture decisions

See `docs/adr/`. Current implementation status is tracked in
[`docs/adr/README.md`](adr/README.md). Key decisions:

- ADR-0001: Netlify + Next.js modular monolith.
- ADR-0002: PostgreSQL + Drizzle + PGlite for local tests.
- ADR-0003: Provider-neutral supplier interface with a disabled live adapter.
- ADR-0004: Provider-neutral payment interface with a signed mock adapter.
- ADR-0005: Better Auth proposal, superseded for the local demo by ADR-0012.
- ADR-0012: Custom DB sessions + scrypt + admin TOTP for the local demo; production auth remains open.
- ADR-0006: Postgres outbox and queue; Netlify background/scheduled functions are not deployed.
- ADR-0007: Integer minor-unit money and captured order snapshots.
- ADR-0008: Envelope encryption for activation data.
- ADR-0009: Domain/brand launch gate.
- ADR-0010: No live money/provisioning until gate evidence.
- ADR-0011: Provider-neutral transactional email, local logger by default.

---

## 16. What this architecture does not solve

- Supplier approval and commercial rights.
- Payment processor acceptance of the business model.
- Legal/tax/consumer-law compliance.
- Domain ownership.
- A real sandbox where the supplier does not offer one.
- A managed encryption service with audited key custody (the MVP uses app-level envelope encryption and versioned secrets; that is weaker than a dedicated KMS).
- Guaranteed email deliverability.
- Guaranteed supplier SLA/uptime.
- Free-plan staging security equivalent to enterprise SSO.
- Any coverage/speed claim. Those must come from verified supplier data.
