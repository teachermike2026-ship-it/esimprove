# eSIMprove — demo-first eSIM travel commerce platform

Working codename for a new eSIM travel storefront intended for **esimprove.com** and **Netlify**.

> **Current status (2026-10-23): a functional local demo, not a live commerce service.**
>
> The storefront, checkout, mock payment, mock fulfillment, encrypted demo activation records,
> customer portal, and basic admin exist and run locally. **Nothing is deployed.** The domain is
> not owned, no supplier/payment/email account is connected, no real credentials exist, no real
> money moves, no real eSIM is provisioned, and no real email is sent. All live integration flags
> remain `false`.

This is the implementation that follows the Phase 0 discovery package. Phase 0 documents remain
in [`docs/`](docs/) for history and decision context.

## What is implemented

### Storefront and content

- Responsive design system in [`app/globals.css`](app/globals.css), with skip links, visible focus,
  reduced-motion handling, print styles, and semantic landmarks.
- Home, destinations, regions, plans, plan detail, search, compatibility, guides, and legal drafts.
- Server-side catalogue search/filtering by destination, region, data, validity, price, and sort.
- Destination and plan pages with canonical URLs, Open Graph metadata, breadcrumbs, and
  `BreadcrumbList` JSON-LD. `sitemap.xml` and `robots.txt` are generated from published demo data.
- Demo mode makes the whole site `noindex`; robots disallows everything.

### Commerce

- Server-side cart with cookie-backed cart tokens, quantity limits, and price revalidation.
- Checkout with idempotency keys, captured price snapshots, and a signed mock payment flow.
- A shared payment processing path used by both the mock UI and the signed webhook route.
- Transactional outbox + fulfillment jobs, deterministic mock supplier orders, retries with
  backoff, and admin-triggered retry.
- eSIM activation data encrypted with AES-256-GCM envelope encryption (per-record DEK wrapped by
  a versioned KEK). The demo LPA uses the reserved `rsp.demo.invalid` domain and cannot connect to
  a network.
- Mock delivery email logged locally; stored email bodies redact the order access token.
- Guest order access with hashed, expiring bearer tokens. Signed-in customers use the portal.
- Basic admin: overview, orders, jobs, plans/pricing, email log, and settings/safety summary.
- Custom database auth: scrypt password hashes, database-backed sessions, admin TOTP, rate limits,
  audit events, and server-side route guards. This is an interim implementation, not a reviewed
  production auth platform.

### Verification

- `npm.cmd run typecheck` — passes.
- `npm.cmd run lint` — passes with no warnings.
- `npm.cmd test` — **50 tests passed** across 6 test files (money, pricing, state transitions,
  crypto, TOTP, password hashing, catalogue/seed, access control, mock supplier, disabled adapters,
  signed webhooks/dedupe, fulfillment retry, and the end-to-end checkout flow).
- `npm.cmd run build` — passes.
- Local HTTP smoke checks (2026-10-23) exercised the storefront, destination/region/plan/guide
  pages, search, compatibility, legal pages, health endpoint, sitemap, robots, and security
  headers. They also exercised a complete mock checkout (success and failure), guest order and
  activation access, admin login + TOTP, admin retry, the protected job-run API, and
  unauthenticated admin/portal access. A full success checkout produced an encrypted demo eSIM
  and a logged mock email.
- `npm.cmd audit --omit=dev` reports **0 production-dependency vulnerabilities**. A full
  `npm.cmd audit` reports **5 high-severity advisories in the dev-only ESLint toolchain**
  (`eslint-config-next` and transitive packages); no production runtime package is implicated.
  Remediation is deferred until a compatible toolchain upgrade is evaluated.

These are local checks only. There is no browser E2E suite, managed-Postgres test, staging deploy,
load test, penetration test, or production evidence. No real payment, supplier, email, or domain
connection exists.

## Quick start

Prerequisites: Node.js `>=20.9` (tested on Node 24.22.0) and npm. PowerShell users should use
`npm.cmd`, because this environment blocks `npm.ps1`.

```powershell
cd C:\Users\hp\esimprove
npm.cmd install
npm.cmd run db:setup
npm.cmd run dev
```

Open `http://localhost:3000`.

`db:setup` creates `.env.local` with random local demo secrets and seeds the local PGlite
database at `.pglite`. `.env.local` is gitignored; never commit it. To use a real PostgreSQL
database, set `DATABASE_URL` in the environment and run migrations explicitly.

### Demo operator account

`db:setup` creates a local-only admin:

- Email: `admin@demo.local`
- Password and TOTP secret: generated in your local `.env.local`
- Current TOTP code: `npm.cmd run totp`

The admin account exists only when `SEED_DEMO_DATA=true` and is not intended for production.
Never use these demo credentials in a deployed environment.

## Commands

| Command | Purpose |
|---|---|
| `npm.cmd run dev` | Start the local Next.js dev server (runs setup first) |
| `npm.cmd run build` | Production build |
| `npm.cmd run start` | Start the built app |
| `npm.cmd run typecheck` | TypeScript check |
| `npm.cmd run lint` | ESLint |
| `npm.cmd test` | Vitest suite |
| `npm.cmd run check` | Typecheck + lint + tests |
| `npm.cmd run db:setup` | Create local env/secrets, migrate, seed demo data |
| `npm.cmd run db:migrate` | Run SQL migrations only |
| `npm.cmd run db:seed` | Seed demo data only |
| `npm.cmd run totp` | Print the current demo admin TOTP code |

## Routes

Public: `/`, `/destinations`, `/destinations/[slug]`, `/regions/[slug]`, `/plans`,
`/plans/[slug]`, `/search`, `/compatibility`, `/guides`, `/guides/[slug]`, `/cart`, `/checkout`,
`/checkout/pay/[paymentId]`, `/checkout/success`, `/orders/[orderNumber]`,
`/orders/[orderNumber]/esim/[esimId]`, and `/legal/*`.

Account/admin: `/login`, `/login/2fa`, `/register`, `/portal`, `/portal/orders/[orderNumber]`,
`/portal/esims/[esimId]`, `/admin`, `/admin/orders`, `/admin/orders/[orderNumber]`, `/admin/jobs`,
`/admin/plans`, `/admin/emails`, and `/admin/settings`.

APIs: `GET /api/health`, `POST /api/webhooks/payments/mock`, and the protected
`POST /api/jobs/run` (requires `x-internal-job-secret` or a Bearer token).

## Integration status

| Integration | Local adapter | Status | What would be required for live |
|---|---|---|---|
| eSIM supplier | Deterministic mock (`mock_ord_…`, `rsp.demo.invalid`) | **Mock only** | Supplier selection, approval, credentials, funded test account, contract review |
| Payments | Signed mock webhook, mock checkout UI | **Mock only** | Processor approval, test/live credentials, webhook endpoint, refund/dispute policy |
| Email | Local logger; no network call | **Mock only** | Verified sending domain, provider credentials, bounce/complaint handling |
| Database | PGlite at `.pglite` | **Local only** | Managed PostgreSQL, pooling, backups, restore drill |
| Hosting | Local `next start` / `next dev` | **Not deployed** | Netlify account/site access, environment configuration, deploy review |
| Domain | `SITE_URL` defaults to `http://localhost:3000` | **Not purchased** | Registrar purchase, DNS, TLS, canonical/email-domain decisions |
| Auth | Custom DB sessions + scrypt + TOTP | **Demo implementation** | Security review, password reset/verification, production key custody, RBAC hardening |

`SITE_URL` is the only public-origin configuration value. Do not add a second public-origin
setting. The default is intentionally local; no domain has been purchased or configured.

## Safety boundaries

- Live flags are false: `PAYMENTS_LIVE_ENABLED`, `SUPPLIER_LIVE_ENABLED`,
  `EMAIL_LIVE_ENABLED`, and `CATALOGUE_SYNC_ENABLED`.
- `assertProductionSafe()` refuses to boot a production configuration with demo mode, demo seed,
  localhost origin, missing secrets, or live flags enabled.
- Demo data is labelled `isDemo` and is never counted as production supplier data.
- The mock LPA is non-functional by design and must never be presented as a real activation.
- Stored activation data is encrypted; guest access tokens are hashed and expiring.
- No card data is collected or stored. No live payment, supplier, or email network call exists.
- The legal pages are **drafts**, not legal advice, and must be replaced before any launch.

## What is deliberately not built yet

- Real supplier catalogue sync, order placement, usage, top-up, cancellation, or supplier webhooks.
- Real payment checkout, refunds, disputes, or chargeback handling.
- Real email delivery, email verification, password reset, or support inboxes.
- Full RBAC/roles, four-eyes approvals, admin re-authentication, or break-glass controls.
- Tax/FX/multi-currency calculation, invoices, or accounting exports.
- Analytics, monitoring, error tracking, backups, or incident tooling.
- Playwright/axe browser tests, load tests, or a managed-Postgres compatibility run.
- Any Netlify deploy, DNS change, or domain purchase.

## Owner actions before launch

1. **Domain:** decide whether to buy `esimprove.com` (or choose another name/domain). Do not
   configure DNS until ownership is confirmed.
2. **Legal/business:** choose the legal entity, jurisdiction, target markets, tax treatment,
   consumer/refund terms, privacy roles, and support contacts. Have the drafts reviewed.
3. **Supplier:** select a supplier, obtain written reseller approval, sign the contract, fund a
   capped test account, and provide credentials through a secret store.
4. **Payments:** obtain processor approval for the business model and provide test/live credentials
   only after the refund/dispute process is defined.
5. **Email:** choose a provider, verify a sending domain, configure DNS, and test bounce/complaint
   handling.
6. **Database/hosting:** provide a managed PostgreSQL project and Netlify site/team access. Do not
   paste secrets into chat; use the hosting secret store.
7. **Security review:** review the interim auth implementation, key custody/rotation, rate limits,
   CSP/headers, and admin permissions before exposing any environment.
8. **Launch gate:** enable live flags only after every item in
   [`docs/LAUNCH-GATES.md`](docs/LAUNCH-GATES.md) has evidence and the owner explicitly signs off.

## Documentation

| Document | Purpose |
|---|---|
| [`docs/ASSUMPTIONS-LOG.md`](docs/ASSUMPTIONS-LOG.md) | Owner decisions, assumptions, and implementation status |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Target architecture and current local implementation |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | Target data model plus the implemented demo schema |
| [`docs/SECURITY-BASELINE.md`](docs/SECURITY-BASELINE.md) | Security requirements and implemented controls/gaps |
| [`docs/LAUNCH-GATES.md`](docs/LAUNCH-GATES.md) | Conditions that must be evidenced before live money/provisioning |
| [`docs/NETLIFY-DEPLOYMENT.md`](docs/NETLIFY-DEPLOYMENT.md) | Deployment plan; nothing has been deployed |
| [`docs/adr/`](docs/adr/README.md) | Architecture decision records and current statuses |
| [`docs/RISK-REGISTER.md`](docs/RISK-REGISTER.md) | Material risks and mitigations |
| [`docs/INTEGRATION-RESEARCH.md`](docs/INTEGRATION-RESEARCH.md) | Supplier/payment/email research notes |

## Working rules

- No mock checkout, demo activation, invented review, or unconnected integration may be presented
  as production functionality.
- Live payments and supplier provisioning stay disabled until every launch gate has evidence and
  the owner explicitly authorises the change.
- Money is stored as integer minor units plus an ISO-4217 currency code. No floating-point money
  arithmetic.
- Activation secrets are encrypted at rest and never placed in URLs, analytics, ordinary logs, or
  unauthenticated email images.
- Secrets belong only in a local `.env.local` or the hosting secret store, never in Git.
- Seed/demo data must remain clearly labelled and must not be enabled in production.
