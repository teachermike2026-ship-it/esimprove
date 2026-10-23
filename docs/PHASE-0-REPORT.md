# Phase 0 — Discovery report

**Project:** New eSIM travel commerce platform for `esimprove.com`
**Date:** 2026-10-23 (UTC)
**Gate status:** Phase 0 complete. Phase 1 not started.
**Production status:** Not production-ready. Nothing deployed. No live money, provisioning, email, or DNS changes.

> **Historical document:** this report describes the Phase 0 discovery state. A local demo
> implementation now exists; see [`README.md`](../README.md) and
> [`docs/ASSUMPTIONS-LOG.md`](ASSUMPTIONS-LOG.md) for current evidence. Statements below such as
> “no application exists” are historical and are not current status.

---

## 1. What was done

- Inspected the local build environment and existing files without modifying the existing `lumasim` project.
- Verified the public registration and DNS status of `esimprove.com`.
- Checked for available Netlify, database, payment, and email credentials in the local environment. None were present.
- Read official eSIM supplier, payment, hosting, authentication, and email documentation; links and dates are recorded in `docs/INTEGRATION-RESEARCH.md`.
- Selected a Netlify-compatible architecture that keeps supplier and payment secrets server-side.
- Produced a draft domain model, state machines, risk register, assumptions log, security baseline, deployment plan, launch-gate checklist, and 11 ADRs.
- Created `.env.example` (empty placeholders and safe flags) and `.gitignore`; no secrets were added.
- Proposed three original brand candidates and performed a preliminary exact-name web search. No formal trademark clearance has been performed.
- Created this clean repository. The pre-existing `lumasim` directory is untouched and is not a dependency.

---

## 2. Environment discovery

| Check | Result | Evidence / consequence |
|---|---|---|
| Working directory | `C:\Users\hp` | User home, not a Git repository |
| New project | `C:\Users\hp\esimprove` | Created for this build; Git repository initialised |
| Operating system | Windows, PowerShell | Commands and paths use Windows conventions |
| Node.js | v24.22.0 | Installed at `C:\Program Files\nodejs\node.exe` |
| npm | 11.19.1 | Available through `npm.cmd` |
| Git | 2.53.0.windows.1 | Available |
| Docker | Not found | No local containerised PostgreSQL |
| `psql` | Not found | No local PostgreSQL client |
| Netlify CLI | Not installed globally; `npx netlify-cli` install exceeded the check timeout | Netlify account/site access still unverified |
| Wrangler | Not found | Not relevant to the selected Netlify path |
| Existing eSIM project | `C:\Users\hp\lumasim` exists | Deliberately not reused, copied, or changed |
| Netlify credentials in environment | None | `NETLIFY_AUTH_TOKEN` absent |
| Database credentials in environment | None | `DATABASE_URL` absent |
| GitHub credentials in environment | None | No repository publishing or CI execution yet |
| Existing Netlify CLI user config | Present | Account link could not be safely verified; no token was printed |

The existing Netlify CLI configuration was inspected only for presence, not for secret values. No site was created, no deploy was attempted, and no DNS was touched.

---

## 3. Domain and identity findings

### 3.1 Domain status: **unverified / appears unregistered**

On 2026-10-23:

- `Resolve-DnsName esimprove.com -Server 8.8.8.8` returned **NXDOMAIN**.
- Verisign RDAP (`https://rdap.verisign.com/com/v1/domain/esimprove.com`) returned **HTTP 404**.
- `rdap.org` returned **HTTP 404**.
- No NS, A, AAAA, MX, or TXT records were returned.

This contradicts the supplied statement that the domain is already owned. It may be a registration that has not propagated, an expired domain, or an available domain. **Ownership is not verified.** The domain must not be relied on for launch, email, cookies, webhook registration, or TLS until the owner confirms registrar control and public DNS resolves.

No purchase, backorder, registrar action, nameserver change, or DNS record was made. Buying a domain requires explicit authorisation and payment.

### 3.2 Planned hostnames once ownership is confirmed

| Hostname | Intended role | Current state |
|---|---|---|
| `esimprove.com` | Canonical production storefront | Does not resolve |
| `www.esimprove.com` | 301 redirect to apex | Does not resolve |
| `staging.esimprove.com` | Protected, `noindex` staging | Does not resolve |
| `api.esimprove.com` | Not planned for MVP; Next.js route handlers can share the apex | Not planned |
| `status.esimprove.com` | Optional public status page, Version 2 | Not planned |
| `mail.esimprove.com` | Transactional sender subdomain | Provider and DNS records not configured |

### 3.3 Brand status

Three candidates are proposed in `docs/BRAND-CANDIDATES.md`. None is approved or trademark-cleared. The project uses **eSIMprove** as a working codename because it maps directly to `esimprove.com` (`esim` + `prove`). It must not be used publicly as a registered brand until the owner chooses it and clearance is completed.

---

## 4. Integration discovery

Full evidence, URLs, and dates are in `docs/INTEGRATION-RESEARCH.md`.

### 4.1 eSIM supplier

**Recommended candidate for Phase 1:** eSIM Access (wholesale API).
**Fallback candidate:** eSIM Go.

- eSIM Access publishes a documented reseller API with catalogue, order, allocated-profile query, cancellation, suspension/unsuspension, revocation, top-up, usage, balance, webhook, SMS, and pricing endpoints.
- Authentication is an `RT-AccessCode` header; optional HMAC request signing is documented.
- Order creation requires a caller-generated `transactionId`; duplicate transaction IDs are documented as the same request. This is the basis for safe create idempotency, but it must still be proven in the supplier account.
- There is **no documented no-cost sandbox**. Documentation instructs partners to deposit funds for testing and refunding. Any real test order spends money and requires explicit owner authorisation.
- Supplier cancellation refunds unused credit to the **supplier balance**, not to the customer's card. Customer refunds remain our payment-provider responsibility.
- Webhooks have no documented HMAC signature. The published controls are a `notifyId` for deduplication and optional source-IP allowlisting; the webhook URL itself can be a bearer secret. This is weaker than a signed webhook and must be documented as such.
- Usage data is documented as delayed by roughly 2–3 hours. The UI must not claim real-time usage.
- Prices are returned as integer units at a supplier scale of 1/10,000 USD in the documented examples, not standard cents. The adapter must preserve the raw scale and convert deliberately.
- Provider statuses include `GOT_RESOURCE`, `IN_USE`, `USED_UP`, `USED_EXPIRED`, `UNUSED_EXPIRED`, `CANCEL`, `REVOKED`, and `SUSPENDED`; availability in a real account still needs confirmation.

**Phase 1 acceptance prerequisites:** supplier account approval, credentials stored outside Git, confirmed resale/white-label rights, catalogue export, a funded test balance if the owner authorises it, and a successful test order plus cancellation/top-up/reconciliation test.

### 4.2 Payment processor

- No processor is selected or connected.
- Stripe is the proposed first adapter because it offers hosted Checkout, server-side signed webhooks, test mode, refunds, and Radar.
- Stripe's public prohibited/restricted-business page (last updated 2026-09-22) lists travel reservation services as a restricted category and states that the list is representative, not exhaustive. The page does not expressly list eSIM resale in the sections reviewed. Approval for this specific business model is **not verified**.
- eSIM/telecom resale can trigger additional due diligence, card-network rules, sanctions screening, and consumer-protection obligations. No live payment capability may be enabled until Stripe (or another processor) approves the entity, the business model, and the statement descriptor.
- Implementation will use hosted Checkout or tokenised components only. Card numbers and CVVs will never touch our servers.

### 4.3 Hosting

- Netlify currently documents full Next.js App Router support through the OpenNext adapter: SSR, Server Actions, Route Handlers, ISR, middleware, and image optimisation.
- Background Functions run for up to 15 minutes and are available on credit-based plans including Free. Scheduled Functions are available on all plans but have a 30-second execution limit and run only on published deploys.
- This supports a Postgres-backed job queue plus background workers and a scheduled sweeper without Redis.
- Netlify's credit-based **Free** plan does not provide built-in password protection. Staging protection must therefore use a custom Edge Function (HTTP Basic Auth) plus explicit `noindex` headers, or the staging site must be kept private. This is a free-plan substitute, not equivalent to enterprise SSO.
- Live deployment cannot proceed until Netlify account access, a site, and the domain path are verified.

### 4.4 Database

- PostgreSQL is required. Neon is the recommended managed host for a Netlify-first deployment; Supabase is a viable alternative. No provider is selected or connected.
- The application will treat the database as provider-neutral SQL and use a pooled connection string. Local development and integration tests can use PGlite so that no Docker dependency is required.
- Production cannot use PGlite or a local SQLite file.

### 4.5 Email

- Resend is a candidate for transactional email. Its documentation requires a verified domain and an API key.
- No domain, sender address, SPF, DKIM, or DMARC record exists yet.
- Resend is not connected, and no email has been sent.

### 4.6 Authentication

- Better Auth is the proposed authentication library. Official documentation confirms email/password support, database sessions, a Drizzle adapter, and a TOTP/backup-code 2FA plugin.
- The 2FA plugin by default challenges credential sign-ins. Admin policy will additionally restrict administrators to credential sign-in and block admin sessions until TOTP enrolment is complete.
- This is a design decision, not an implemented or tested authentication system.

---

## 5. Proposed architecture in one page

A **modular monolith** on Netlify:

- Next.js App Router for server-rendered storefront, account, checkout, admin, and SEO pages.
- PostgreSQL with Drizzle migrations for all durable state.
- A Postgres outbox for all state-change-to-job/email handoffs.
- A Postgres job queue claimed with `FOR UPDATE SKIP LOCKED`.
- Netlify Background Functions for provisioning, email delivery, and reconciliation.
- A Netlify Scheduled Function as a sweeper and health/reconciliation heartbeat.
- Provider-neutral `SupplierAdapter` and `PaymentProvider` interfaces.
- Activation secrets encrypted with envelope-style AES-256-GCM and versioned keys.
- Append-only audit and financial event tables.
- Feature flags and kill switches for supplier, payments, and email.
- Strict separation of payment status and fulfillment status.
- Server-side price recalculation, versioned price snapshots, and idempotent order creation.

See `docs/ARCHITECTURE.md` and `docs/DATA-MODEL.md` for detail.

---

## 6. Phase 0 checks and actual results

These are the only checks performed. There are no application test results yet.

| Check | Result | Notes |
|---|---|---|
| Local project directory creation | PASS | `C:\Users\hp\esimprove` created |
| Git initialisation | PASS | New repository initialised |
| Node runtime | PASS | Node v24.22.0 executes |
| npm | PASS | npm 11.19.1 available via `npm.cmd` |
| Domain RDAP lookup | FAIL / DISCREPANCY | HTTP 404 from Verisign RDAP; domain not verified as registered |
| Domain DNS lookup | FAIL / NXDOMAIN | No records returned by public DNS |
| Netlify CLI availability | NOT VERIFIED | `npx` install exceeded timeout; no token in environment |
| Netlify site/account access | NOT VERIFIED | No site deployed or listed |
| Supplier API reachability | DOCS ONLY | Official docs reviewed; no credential, no API call |
| Supplier sandbox availability | UNAVAILABLE / UNDOCUMENTED | eSIM Access documents a deposit-funded test path, not a free sandbox |
| Payment API | NOT CONNECTED | No account, key, or approval |
| Database | NOT CONNECTED | No managed database exists |
| Email | NOT CONNECTED | No domain or API key |
| Application build | NOT STARTED | No application code yet |
| Automated tests | NOT STARTED | No test suite yet |
| Security scan | NOT STARTED | No dependencies yet |
| Accessibility test | NOT STARTED | No UI yet |

There are zero passing functional tests, zero passing integration tests, and no deployment. This document does not claim otherwise.

### 6.1 Documentation checks (not functional tests)

These checks were run locally on 2026-10-23 against the documentation tree. They verify links and the absence of obvious credentials; they do not verify factual claims, code quality, security, or accessibility.

| Check | Result | Evidence / limitation |
|---|---|---|
| Relative Markdown links resolve | PASS | PowerShell scan of every `*.md` file; 0 broken relative links |
| Obvious secret patterns | PASS (reviewed) | No live/test key prefixes, private-key blocks, or populated credentials found; a regex false positive on the `re_` substring in `before_redacted`/`after_redacted` was reviewed and dismissed |
| Unresolved-marker scan | PASS (reviewed) | No unresolved placeholder markers left; unresolved choices are written as “not selected” |
| ADR index | PASS | 11 ADRs plus index; index links resolve |
| Documented facts vs. sources | NOT INDEPENDENTLY VERIFIED | Source URLs/dates are recorded in `INTEGRATION-RESEARCH.md`; no provider account was accessed |
| Code, build, tests, deploy | NOT RUN | No application exists |

---

## 7. Decisions taken in Phase 0

1. **Platform:** Netlify + Next.js App Router, subject to deployment verification.
2. **Shape:** modular monolith, not microservices.
3. **Database:** PostgreSQL with Drizzle; PGlite only for local/test. Neon recommended but not selected.
4. **Supplier:** abstraction first; eSIM Access adapter proposed and permanently disabled until credentials and approval exist.
5. **Payments:** provider-neutral interface; Stripe adapter proposed, permanently disabled until approval and server-side webhook tests pass.
6. **Email:** provider-neutral transport; Resend adapter proposed, disabled until a verified sending domain exists.
7. **Money:** integer minor units; supplier cost scale preserved; all order pricing snapshotted.
8. **Fulfillment:** separate payment and fulfillment state machines; one idempotent job per order item; reconcile before retry.
9. **Auth:** Better Auth with database sessions; mandatory TOTP 2FA for admins.
10. **Staging:** custom Edge Function Basic Auth and `noindex` because free Netlify lacks password protection.
11. **Domain:** no action until ownership is proven. No DNS records were fabricated.

These are Phase 0 recommendations, recorded as proposed ADRs in `docs/adr/`. None is accepted, implemented, or verified. “Decided” here means “selected for the proposal”, not “proven in production”.

---

## 8. Unresolved and blocking items

| # | Item | Why it blocks | Owner action |
|---|---|---|---|
| B1 | `esimprove.com` ownership | Cannot configure TLS, DNS, cookies, email, webhooks, or canonical URLs | Confirm registrar ownership or register the domain; provide registrar/DNS access only after confirming |
| B2 | Final brand name | Name appears in every page, invoice, email, and legal notice | Choose one of the three candidates or supply another; commission clearance |
| B3 | Legal entity and jurisdiction | Terms, privacy, tax, invoices, processor application, and consumer rights all depend on it | Supply verified legal details or keep launch blocked |
| B4 | Supplier account and commercial rights | Cannot legally resell, cannot deliver, cannot know real costs or plan terms | Apply/approve an account; confirm resale/white-label rights; provide credentials through the secret store |
| B5 | Test deposit | eSIM Access has no documented free sandbox; real test orders spend money | Explicitly approve a capped test deposit and supplier test plan |
| B6 | Payment processor approval | No live checkout without an approved entity and business model | Apply; provide approval and test credentials; complete underwriting |
| B7 | Netlify access | Cannot create a site, deploy, set environment variables, or attach a domain | Authorise site creation; provide a scoped token or invite access |
| B8 | Managed PostgreSQL | No production persistence without it | Create a Neon/Supabase project or provide a pooled Postgres URL |
| B9 | Transactional email/DNS | Cannot verify addresses or deliver eSIM access links | Choose provider; add SPF/DKIM/DMARC after domain is live |
| B10 | Legal/tax review | Refund rights, digital-content withdrawal waivers, VAT/sales tax, telecom rules | Obtain professional advice; mark every policy as draft until then |
| B11 | Admin identity/2FA | Cannot secure real customer data or admin actions | Nominate administrators; enrol TOTP before access |
| B12 | Launch authorisation | Live money/provisioning requires explicit owner sign-off | Review all gates in `docs/LAUNCH-GATES.md` |

---

## 9. What must happen before Phase 1

Phase 1 is a supplier proof of concept, not storefront development. It requires:

- A chosen supplier path, ideally eSIM Access because no-minimum access is documented.
- A verified supplier account and API credentials in a secret store.
- Written confirmation of resale/white-label rights and the refund/cancellation terms.
- A catalogue import and a dry-run contract test with no orders.
- If testing requires funds, explicit written approval of a capped test deposit.
- A test order placed only in the supplier's approved test/production account. There is no free sandbox to pretend exists.
- Evidence of LPA/QR retrieval, status query, usage query, top-up, cancellation, webhook delivery/dedupe, and reconciliation.
- A report of real results, failures, and unresolved supplier behaviours.

No customer-facing promise of automated provisioning is made before Phase 1 evidence exists.

---

## 10. Phase gate

Phase 0 is complete as a discovery and documentation package. The next phase is blocked pending the owner decisions in `docs/OWNER-DECISIONS.md` and the Phase 1 prerequisites above. No code, deployment, or live integration exists.

### 10.1 Phase 0 deliverables

| Deliverable | Path | Status |
|---|---|---|
| Discovery report | `docs/PHASE-0-REPORT.md` | Complete for Phase 0; findings are point-in-time |
| Owner decision form | `docs/OWNER-DECISIONS.md` | Awaiting owner response |
| Assumptions log | `docs/ASSUMPTIONS-LOG.md` | Living document |
| Architecture | `docs/ARCHITECTURE.md` | Proposal only |
| Data model | `docs/DATA-MODEL.md` | Draft; no migrations |
| Risk register | `docs/RISK-REGISTER.md` | All items open |
| ADRs | `docs/adr/` (0001–0011 + index) | Proposed, not accepted |
| Integration research | `docs/INTEGRATION-RESEARCH.md` | Public docs reviewed; no accounts |
| Brand candidates | `docs/BRAND-CANDIDATES.md` | Not cleared or selected |
| Netlify deployment plan | `docs/NETLIFY-DEPLOYMENT.md` | Design only; no deploy |
| Security baseline | `docs/SECURITY-BASELINE.md` | Requirements only; no controls tested |
| Launch gates | `docs/LAUNCH-GATES.md` | All gates unmet |
| Environment template | `.env.example` | Empty placeholders and safe flags |
| Ignore rules | `.gitignore` | Secrets/build output excluded |

**Recommended next action:** review the consolidated decisions document, choose a brand, confirm domain ownership, and authorise the free Netlify/Neon setup path. Do not authorise live payments or live supplier provisioning yet.

---

## 11. Honest limitations of this report

- The domain evidence is a point-in-time public registry/DNS check, not a registrar account check.
- Supplier capacities are based on public documentation; no credential-authenticated behaviour has been observed.
- Payment acceptance for eSIM resale is not approved or verified.
- No legal, tax, trademark, telecom-licensing, sanctions, or consumer-law clearance has been obtained.
- No performance, accessibility, security, backup-restore, or load test has run because no application exists.
- Netlify account access and free-plan allowances were not verified against the owner's actual account.
- Documentation link/secret scans do not verify the truth of provider documentation, the owner's domain claim, or legal conclusions.
- The risk scores are qualitative planning judgements, not actuarial or audit results.
