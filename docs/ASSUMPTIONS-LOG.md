# Assumptions and decision log

**Status:** Living document. Last updated 2026-10-23.
**Rule:** An assumption is not a verified fact. Anything that affects money, law, supplier access, or customer safety remains open until evidenced.

> **Implementation status:** A local demo implementation now exists in this repository. It has
> not been deployed. No domain, supplier, payment, email, managed database, or Netlify account is
> connected. All live flags are false. See the README for commands, routes, and the current test
> evidence. The owner decisions below remain open unless explicitly marked otherwise.

## 0. Implementation record (2026-10-23)

| Item | Current local implementation | Production status |
|---|---|---|
| Web app | Next.js 16.4.2 App Router, React 19.3.1, TypeScript 5.9.3 | Not deployed |
| Styling | Custom CSS design tokens/components in `app/globals.css` (no Tailwind dependency) | Not browser-tested beyond local smoke checks |
| Database | PGlite at `.pglite`; PostgreSQL client path exists | No managed PostgreSQL provisioned or tested |
| ORM/migrations | Drizzle ORM + checked-in SQL migration + explicit setup script | Migration/rollback not tested on managed PostgreSQL |
| Auth | Custom DB sessions, scrypt password hashes, admin TOTP, rate limits | Interim only; no security review, email verification, or password reset |
| Supplier | Deterministic mock adapter; disabled live adapter | No supplier account, credentials, approval, or order |
| Payments | Signed mock webhook + mock checkout UI; shared `lib/payments.ts` path | No processor approval or credentials |
| Email | Local logger; stored body redacts access token | No sending domain, provider, or real email |
| Jobs | Postgres outbox + fulfillment jobs + retry/backoff + protected job route | No Netlify Background/Scheduled Function deployment |
| Activation data | AES-256-GCM envelope encryption; demo `.invalid` LPA | Key custody/rotation review outstanding |
| Admin | Overview, orders, jobs, plans/pricing, email log, settings | Basic only; no full RBAC, four-eyes, or re-auth |
| Tests | 50 Vitest tests passing across 6 files | No Playwright/axe, load, managed-Postgres, or staging tests |
| Build | `npm run build` passes locally | No Netlify deploy |
| Domain | `SITE_URL=http://localhost:3000`; domain not purchased | No DNS/TLS/canonical/email-domain configuration |
| Public-origin config | Single `SITE_URL` value | Must be replaced with the verified public origin before deploy |

### 0.1 Implementation decisions that need reconciliation with production

1. **Auth is custom, not Better Auth.** The original Phase 0 preference was Better Auth. The demo
   uses a small custom implementation to keep the local build self-contained. It has not had an
   independent security review and lacks email verification, password reset, backup codes, and
   full RBAC. A production decision is still required (harden or replace).
2. **The demo uses PGlite, not managed PostgreSQL.** The PostgreSQL code path is present but has
   not been exercised against a managed provider, pooling setup, or backup/restore process.
3. **The mock payment provider is not Stripe.** It signs local webhook payloads with
   `MOCK_PAYMENT_WEBHOOK_SECRET` and is clearly labelled mock. No processor is connected.
4. **The mock supplier is not eSIM Access.** It returns deterministic demo IDs and a reserved
   `.invalid` LPA. No supplier network call exists.
5. **The mock email transport does not send email.** It logs locally and stores a redacted body.
6. **The demo catalogue is synthetic.** It contains 8 regions, 33 destinations, and 99 plans,
   all marked `isDemo`; it is not supplier data and must not be presented as real coverage.
7. **SEO is demo-gated.** Demo mode disables indexing globally. Sitemap/robots generation exists,
   but canonical/domain/structured-data decisions remain blocked by the domain gate.

### 0.2 Verification evidence (2026-10-23, local only)

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, 0 errors / 0 warnings |
| `npm test` | 50/50 tests pass across 6 files |
| `npm run build` | Pass; 40 routes generated (all dynamic) |
| Full mock checkout (success) | Pass: cart → checkout → signed mock payment → fulfillment → encrypted demo eSIM → logged/redacted email |
| Full mock checkout (failure) | Pass: failed payment returns to the mock payment page with `failed=1`; the success page is not reached |
| Guest order/activation access | Pass with a valid bearer token; no token shows an access/empty state and no order data |
| Admin auth | Pass: password step → TOTP step → admin dashboard; unauthenticated admin requests redirect |
| Admin retry + protected job run | Pass: a forced mock supplier failure was retried from the admin UI, then the protected job API delivered it |
| Storefront/content routes | Pass for home, destinations, region, plans, search, compatibility, all guides, and legal drafts |
| SEO/headers/health | Pass: sitemap, robots disallow, CSP/frame/referrer/permissions headers, `GET /api/health` |
| Unauthenticated admin RSC check | Pass after adding page-level `requireAdmin()` guards; admin job/email data is not present in the redirect response |
| Production audit | `npm audit --omit=dev`: 0 vulnerabilities; full audit: 5 high in dev-only ESLint toolchain |

**Security fix during smoke testing:** Next.js can render a page in parallel with a layout redirect.
The admin layout redirect alone did not stop page-level data fetching, so each admin page now calls
`requireAdmin()` as well. The unauthenticated response no longer contains admin job, order, or email
data. This is a defense-in-depth fix, not evidence of a full security review.

**Test caveat:** these are local PGlite and HTTP checks. They do not prove managed-PostgreSQL
compatibility, browser behavior, accessibility conformance, load capacity, or production safety.


## 1. Unresolved owner decisions

| ID | Decision | Current state | Safe default while unresolved | Impact if wrong | Revisit trigger |
|---|---|---|---|---|---|
| O-01 | Brand name | Not chosen; three candidates proposed | Working codename `eSIMprove` only; no public launch | Branding, trademark, legal notices, domain email | Owner picks and clearance completes |
| O-02 | Domain ownership | Public registry/DNS says not registered | No DNS, TLS, cookies, webhooks, or email configured | Entire launch path | Registrar account evidence and resolving DNS |
| O-03 | Legal entity | Unknown | No company details invented; policies marked draft | Contracts, invoices, tax, processor application | Owner provides verified details |
| O-04 | Jurisdiction | Unknown | Do not promise any country-specific consumer rights | Refund/withdrawal wording, taxes, data transfer | Legal review |
| O-05 | Supplier | Not selected | Abstraction + disabled eSIM Access adapter | Cost, coverage, fulfillment, SLA | Account approval and Phase 1 evidence |
| O-06 | Supplier deposit | Not authorised | No supplier spend; no live order | Cannot test fulfillment | Owner approves capped test budget |
| O-07 | Payment processor | Not selected | Provider-neutral interface; disabled adapter | Checkout, refunds, chargebacks | Approval and test credentials |
| O-08 | Netlify account/site | Unverified | No deploy | Hosting and DNS | Owner authorises access |
| O-09 | Managed PostgreSQL | Not provisioned | Local PGlite for development only | No production data | Neon/Supabase project created |
| O-10 | Email provider and mailbox | Not selected | No email sent; adapters disabled | Delivery, verification, support | Sending domain and API key verified |
| O-11 | Support addresses | Not verified | Never publish `support@` until a human reads it | Consumer support, chargeback evidence | Mailboxes created and tested |
| O-12 | Target market | Default worldwide travellers | English, USD, no country-specific claims | Tax, legal, sanctions, currency | Owner confirms markets |
| O-13 | Languages | English first | English-only interface; i18n architecture retained | SEO and UX | Translation resourcing |
| O-14 | Currency | USD first | USD display and charge only | Pricing, FX, tax | Multi-currency launch decision |
| O-15 | Budget ceiling | Free/low tiers only until asked | No paid services, no domain purchase, no deposit | Feature availability, staging protection, support SLAs | Owner approves spend |
| O-16 | Business model | Reseller, not MVNO | Resell supplier plans with disclosed terms | Regulatory classification | Written supplier rights and legal review |
| O-17 | Reviews/ratings | None | Do not display any review or rating | Trust claims | Genuine verified review source and moderation |
| O-18 | Analytics | Privacy-first, consent-gated | No third-party analytics loaded | GDPR/ePrivacy, attribution | Owner picks measurement and consent approach |
| O-19 | Admin roles/people | Unknown | No admin accounts seeded in production | Security and four-eyes approvals | Owners nominate admins |
| O-20 | Refund policy | Not verified | No blanket no-refund claim; policy marked draft | Consumer law, chargebacks | Legal review + supplier contract |

## 2. Assumptions taken for Phase 0 only

| ID | Assumption | Basis | What would invalidate it |
|---|---|---|---|
| A-01 | Netlify can host the selected Next.js App Router architecture | Current Netlify Next.js documentation reviewed 2026-10-23 | Deployment test fails or a required feature is unsupported |
| A-02 | Netlify Background Functions can run provisioning work | Official 15-minute background-function documentation | Account plan or runtime restriction discovered in staging |
| A-03 | A scheduled Netlify Function can sweep a Postgres queue | Official scheduled-function docs; 30-second limit | Queue volume exceeds sweeper capacity |
| A-04 | Neon free tier or another managed Postgres is acceptable | Provider-neutral plan; no account created | Free-tier limits, region, backups, or pooling are unsuitable |
| A-05 | PGlite can support local integration tests | Tested locally: migrations, seed, checkout, webhook, fulfillment, and access-control tests pass on PGlite | SQL incompatibility, concurrency, or managed-Postgres differences discovered in staging |
| A-06 | Custom database sessions + scrypt + TOTP are sufficient for the local demo | Implemented locally; no independent security review | Security review finds flaws, or production requirements need email verification, password reset, backup codes, or RBAC |
| A-07 | eSIM Access is a viable Phase 1 supplier candidate | Public docs show required endpoints and no minimums | Contract, approval, sandbox/test cost, or API test disproves it |
| A-08 | eSIM Access duplicate `transactionId` is safe idempotency | Official order-endpoint docs state duplicates are treated as the same request | Account test shows divergent behaviour |
| A-09 | eSIM Access webhooks are unsigned but use dedupe/IP controls | Public webhook docs reviewed 2026-10-23 | Supplier adds or requires signature verification |
| A-10 | Resend is a reasonable first email adapter | General service documentation reviewed; no account | Sending-domain approval or deliverability unsuitable |
| A-11 | Stripe may support the business after underwriting | Public policy reviewed; not an approval | Stripe declines or restricts eSIM resale |
| A-12 | USD is the initial selling currency | Owner default | Owner chooses another currency or market |
| A-13 | English is the initial language | Owner default | Owner requires additional locale at launch |
| A-14 | Guest checkout and accounts both matter | Requirements | Owner narrows MVP |
| A-15 | No honest review corpus exists at launch | No verified reviews supplied | Real, permissioned reviews are collected |
| A-16 | No coverage or speed claim can be made from supplier marketing copy | Honesty rule; supplier fields must be verified | Supplier contract/verified data supplies substantiation |
| A-17 | E-mail delivery is not proof of eSIM installation | Product/security rule | Verifiable activation event exists |
| A-18 | A single-region application deployment is acceptable initially | Modular monolith on Netlify | Legal data-residency requirement or latency failure |
| A-19 | Free/low-cost monitoring is sufficient for pre-launch | Budget default | Production SLA or alert-volume requirement |
| A-20 | No seed/demo catalogue will be shipped in production | Safety rule | Explicit demo-only environment flag |

## 3. Verified facts (as of 2026-10-23)

These are still point-in-time observations, not permanent truths.

- The local environment has Node 24.22.0, npm 11.19.1, Git 2.53.0, no Docker, no `psql`, and no globally installed Netlify CLI.
- `esimprove.com` returns NXDOMAIN from public DNS and HTTP 404 from Verisign RDAP.
- No Netlify, database, supplier, payment, email, or GitHub secret is present in the process environment.
- Netlify documents Next.js App Router support, 15-minute background functions, and 30-second scheduled functions.
- Better Auth documents email/password, database sessions, a Drizzle adapter, and TOTP 2FA with backup codes.
- eSIM Access publishes reseller API endpoints for catalogue, order, query, cancel, suspend, unsuspend, revoke, top-up, usage, balance, and webhook configuration.
- eSIM Access order calls require a caller-generated `transactionId` with documented duplicate suppression.
- eSIM Access documents a supplier-balance refund on eligible cancellations, not a card refund.
- eSIM Access documents usage delays of roughly 2–3 hours.
- Stripe's public restricted-business page lists travel reservation services as restricted and states the list is not exhaustive.

## 4. Architecture decisions and remaining choices

Some Phase 0 proposals are now implemented **locally** (see section 0); production acceptance still requires evidence and owner sign-off. The following still need a final owner/provider decision before the relevant phase:

- Database provider, region, and pooling strategy (ADR-0002). Local PGlite is not a production database.
- Whether to harden the custom auth implementation or replace it with a reviewed auth platform; session cookie names/TTLs, password reset, email verification, backup codes, and admin re-authentication policy (ADR-0005).
- Encryption key custody and rotation budget: application KEK vs cloud KMS (ADR-0008).
- File-upload malware-scanning approach if support attachments are enabled.
- Tax calculation service vs manual rate tables at launch.
- Error tracking and uptime providers.
- Backup destination, encryption, and restore ownership.
- Final transactional-email vendor and bounce/complaint handling (ADR-0011).
- Final payment provider and checkout method, hosted vs embedded (ADR-0004).
- Whether a public status page is launched.
- Whether customer accounts can claim guest orders.
- Domain ownership and brand clearance evidence (ADR-0009).
- Netlify account/site access and the exact deployment adapter/runtime configuration.


## 5. Standing honesty constraints

- Do not invent API credentials, plan prices, coverage, networks, speeds, reviews, ratings, certifications, approvals, or company details.
- Do not imply that a supplier is integrated when only a typed interface or fixture exists.
- Do not use a supplier's marketing claim as a product-field source without a provenance record.
- Do not call a sandbox a live integration, or a live integration a sandbox.
- Do not call a deploy a launch.
- Do not call a tested business compliant; compliance requires legal/tax review and evidence.
