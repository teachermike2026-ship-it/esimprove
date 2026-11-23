# ESIMPROVE — Current Project Status Report

**Audit date:** 2026-11-08  
**Project:** `C:\Users\hp\esimprove`  
**Mode:** Read-only audit — no fixes, migrations, deployments, account changes, commits, pushes, or secret disclosure  
**Final status:** **SIGNIFICANT ISSUES FOUND — FURTHER WORK REQUIRED**

> **Historical snapshot.** This report predates the 2026-11-23 deployment preparation. Domain
> ownership, Whop preparation, environment enforcement, and DNS status have changed. Use the
> current `NETLIFY_*` documents and `ESIMPROVE_GITHUB_NETLIFY_DEPLOYMENT_PREPARATION.md` for
> current status.

---

## Status key

| Label | Meaning in this report |
|---|---|
| **PASS** | The stated check was executed in this audit and passed. |
| **FAIL** | The stated check was executed in this audit and failed. |
| **BLOCKED** | The check could not be executed because a required external or runtime prerequisite is absent. |
| **SKIPPED** | The check was deliberately not run because it would violate the read-only constraint or require a process change. |
| **NOT TESTED** | No execution evidence exists; source review only. |
| **PREVIOUSLY PASSED — NOT RERUN** | A prior artifact or report claims success, but this audit did not reproduce it. |

A feature is not called working merely because files exist. Static implementation, automated tests, database evidence, and runtime evidence are reported separately.

---

## A. Executive summary

The project is a substantial demo-first eSIM commerce application, not a production-ready store. It contains a broad implementation: 68 page routes, 5 API routes, 64 Drizzle table definitions, local PGlite and deployed-PostgreSQL support, mock commerce, authentication with TOTP, administrator RBAC, refunds, supplier-connection security, a blog/CMS, SEO metadata, first-party analytics, and Phase 5 legal/consent/privacy surfaces.

The current tree is not in a releasable state:

- **Typecheck passes**, but **lint fails** with 11 errors and 16 warnings.
- **Tests:** 174 of 175 pass; one Phase 4 analytics test fails because the Phase 5 server-side consent gate returns 204 where the older test expects 202.
- **No local server is running**, so no HTTP route, browser, hydration, responsive, or accessibility verification was performed.
- **The local database is still at migration 0005**. All 11 Phase 5 tables are absent from the inspected copy, and `support_tickets.requester_email` is absent. The 0006 migration exists and is tested only on a fresh in-memory database; the 0005 → 0006 upgrade was not executed.
- **The Phase 5 administrator legal UI is a non-functional stub.** Ten legal server actions exist, but no page or component imports them. Privacy-request review/deletion and legal configuration cannot be completed through the UI.
- **Netlify production is not configured and is externally blocked**: no evidence of a site/deploy, production PostgreSQL, verified domain/DNS/HTTPS, production secrets/KEKs, scheduler, backup/restore/monitoring, or external media host; live providers remain disabled; legal/business approval is absent.
- **SEO has current defects**: the sitemap advertises `/compatibility/install`, which has no route, and omits `/legal/faq`, `/legal/accessibility`, `/privacy/request`, and blog tag routes.
- **Retention is inconsistent**: migration seeds 395/730 days, `.env.example` and the jobs route default to 90, consent validity is 180, cleanup clamps to 365, and cleanup does not read the database retention settings.

The demo's core local commerce path is well covered by automated tests, and the security work on refunds, supplier credentials, SSRF validation, mock webhook signatures, and production configuration is materially better than a typical demo. Those strengths do not offset the missing Phase 5 admin workflow, the unapplied migration, the failing quality gates, and the absent deployment evidence.

**Determination:** not ready for production, not ready for a Netlify launch, and not ready to be called complete. The appropriate next step is remediation and verification, not deployment.

---

## B. Scope, method, and constraints

### B.1 What was inspected

- Current source under `app/`, `components/`, `lib/`, `db/`, `scripts/`, and `tests/`.
- `package.json`, `tsconfig.json`, `next.config.ts`, `netlify.toml`, `.env.example`, and `vitest.config.ts`.
- Git history and working-tree state.
- Existing reports and blocker registers, used only as historical context and explicitly distinguished from re-run evidence.
- A temporary read-only copy of the PGlite database, queried with SQL. The project `.pglite` database was not migrated or changed.
- Existing `.next` build artifacts, inspected as prior evidence only.

### B.2 What was not done

- No server was started, stopped, restarted, or terminated.
- No migration was run against the project database or any deployed database.
- No dependency was installed or updated.
- No `.env.local` value was read aloud, copied, or disclosed.
- No account, password, role, or secret was created or changed.
- No source, configuration, migration, or database record was fixed.
- No commit, push, deploy, or Netlify action was performed.
- No browser, Playwright, Cypress, axe, Lighthouse, responsive, console, or hydration test was run.

### B.3 Environment

| Item | Observed value |
|---|---|
| OS | Microsoft Windows NT 10.0.19045.0 |
| Node.js | v24.22.0 |
| npm | 11.19.1 |
| Project Node engine | `>=20.9.0` |
| Netlify build Node | 22 |
| Next.js | 16.4.2 |
| React | 19.3.1 |
| Drizzle ORM | 0.45.4 |
| PGlite | 0.5.11 |
| Vitest | 5.0.5 |

Aside from this report, the only filesystem side effects were generated/ignored caches (for example `tsconfig.tsbuildinfo`) and the temporary database copy used for queries. No tracked source, configuration, environment file, or project database was edited.

---

## C. Original design baseline and visual fidelity

### C.1 Baseline available

There is exactly one Git commit:

```text
5dcb3ba (HEAD -> main, origin/main) Initial commit: local eSIMprove demo
```

No screenshots, design files, Figma/Sketch/XD files, PDFs, or image assets other than `app/icon.svg` were found. `docs/BRAND-CANDIDATES.md` is an unapproved brand-name screening document, not a visual design specification.

### C.2 Current divergence from the only baseline

| File | At HEAD | Current working tree |
|---|---:|---:|
| `app/globals.css` | 1,829 lines | 5,675 lines |
| `app/page.tsx` | 274 lines | 456 lines |
| `components/site-header.tsx` | 107 lines | 154 lines |

The homepage, header, footer, and stylesheet have been heavily restructured. The core brand tokens remain present, including `#43b65b`, `#11182c`, and `#fff9e8` (`--es-green`, `--es-navy`, `--es-cream`).

### C.3 Verdict

**Original visual design: INSUFFICIENT EVIDENCE TO DETERMINE.**

The only defensible statement is that the initial commit is the sole baseline and the current tree diverges substantially from it. There is no approved design baseline against which to judge fidelity, restoration, or regression. Brand-token preservation is confirmed; visual fidelity is not.

---

## D. Implementation overview

### D.1 Codebase shape

| Item | Count / evidence |
|---|---:|
| Page routes (`app/**/page.tsx`) | 68 |
| API routes (`app/**/route.ts`) | 5 |
| Drizzle `pgTable` definitions | 64 |
| Public tables in local DB copy | 54 (including `schema_migrations`) |
| Application tables in local DB copy | 53 |
| Migration files | 6 (`0001`–`0006`) |
| Applied migrations in local DB copy | 5 (`0001`–`0005`) |

The five API routes are:

- `/api/health`
- `/api/track`
- `/api/consent`
- `/api/jobs/run`
- `/api/webhooks/payments/mock`

### D.2 Architecture summary

- **Framework:** Next.js App Router with server components, Server Actions, and route handlers.
- **Database:** PGlite for local/demo; `pg` Pool for deployed PostgreSQL. Drizzle schema is shared.
- **Commerce:** mock payment provider, signed mock webhooks, mock supplier adapter, local fulfillment/outbox, order access tokens.
- **Authentication:** database-backed sessions with hashed tokens; scrypt password hashing; TOTP for administrator 2FA; role and permission guards.
- **Security:** AES-256-GCM envelope encryption with AAD; hashed session and consent identifiers; rate limits on auth/contact/privacy actions; origin checks; production configuration preflight.
- **Phase 5:** server-side consent evidence, privacy requests, unsubscribe architecture, legal drafts, retention settings, accessibility review register, asset-license register.

### D.3 Working-tree state (measured before this report was written)

```text
TRACKED_FILES=159
STATUS_ENTRIES=191
MODIFIED_ENTRIES=71
UNTRACKED_ENTRIES=120
UNTRACKED_FILES=146
DELETED_ENTRIES=0
DIFF=71 files changed, 9,604 insertions(+), 953 deletions(-)
```

All Phase 5 work and most remediation work is uncommitted. The repository has no review trail or rollback point for that work.

---

## E. Feature verification matrix

| Area | Current evidence | Status | Caveat |
|---|---|---|---|
| Storefront, catalogue, search, destinations, plans | Routes and data layer present; `catalogue-access.test.ts` and `unit.test.ts` pass | **PASS (source + tests)** | No HTTP/browser crawl in this audit. |
| Cart, checkout, orders, customer portal | Routes, Server Actions, and data layer present; `integration.test.ts` and `phase2.test.ts` pass | **PASS (mock commerce)** | No live payment; no browser checkout run. |
| Mock payment, signed webhook, fulfillment/outbox | Signed mock webhook tests, idempotency tests, fulfillment retry tests pass | **PASS (mock/local)** | No real provider; no production fulfillment. |
| Authentication, sessions, TOTP, password reset | `auth-login-flow.test.ts`, `guards-session.test.ts`, `unit.test.ts` pass | **PASS (source + tests)** | Production email for password reset is unavailable. |
| Admin RBAC, refunds, audit trail | Role tests, refund transaction/idempotency tests, audit assertions pass | **PASS (source + tests)** | No authenticated admin HTTP run. Finance is intentionally read-only. |
| Supplier connections, SSRF validation, credential encryption | `integrations-auth-guard.test.ts`, `crypto-binding.test.ts`, `guards-session.test.ts` pass | **PASS (current scope)** | No outbound supplier client; N-07 remains open. |
| Blog/CMS, SEO metadata, JSON-LD, sitemap/robots | `phase4-blog-seo.test.ts` passes | **PARTIAL** | Sitemap contains a 404 URL and omits several public routes. |
| First-party analytics and consent | `phase4-analytics.test.ts` mostly passes; one route test fails; consent UI and APIs present | **PARTIAL** | `/api/track` and `/api/consent` have no rate limit; failing test is stale. |
| Legal pages, privacy requests, unsubscribe | Public pages/actions present; legal drafts and readiness data exist in 0006 | **PARTIAL** | Admin legal UI is a stub; 0006 not applied locally; no behavioral Phase 5 tests. |
| Contact/support | Contact action creates a support ticket and records privacy-notice consent; admin support page exists | **PARTIAL** | Requires 0006 `requester_email`; no runtime/email verification. |
| Jobs/outbox and scheduled publishing | Service tests pass; `/api/jobs/run` is secret-protected | **PASS (manual invocation)** | No scheduler/queue is configured. |
| Health and monitoring | `/api/health` exists, is no-store/noindex, and supports detailed authorized output | **PASS (source)** | Local HTTP check was blocked; no monitoring integration. |
| Netlify deployment | `netlify.toml` exists; preflight/build commands defined | **BLOCKED** | No site, deploy, PostgreSQL, domain, secrets, or deploy evidence. |

### E.1 Prior finding revalidation (F-01–F-13, N-01–N-07)

This is a current-code revalidation, not a repetition of the earlier reports.

| Finding | Current status | Current evidence |
|---|---|---|
| **F-01** Supplier tables had no migration | **FIXED** | `0004_supplier_connect.sql` exists; the local DB copy contains `supplier_connections` and `supplier_capabilities`; `migrations.test.ts` passes. |
| **F-02** Connection creation/credential persistence missing | **FIXED (local)** | Authenticated create action, encrypted credential storage, and form are present; session-backed test passes. |
| **F-03** Guard tests used duplicated helpers | **FIXED** | Tests import production guards/SSRF code; duplicate helper module is gone. |
| **F-04** SSRF validator incomplete | **FIXED for current scope** | Production URL/DNS validator rejects private, loopback, link-local, metadata, userinfo, and related cases; no outbound client exists. |
| **F-05** Finance refund permission inconsistent | **FIXED (policy)** | Finance is read-only; refund execution is administrator-only; tests pass. |
| **F-06** Refund approval non-atomic/non-idempotent | **FIXED** | `applyRefund` uses a transaction, conditional claim, conditional payment update, and cumulative cap; tests pass. |
| **F-07** Duplicate/unattributed refund audit | **FIXED** | One authoritative, attributable audit row is written; test asserts the count. |
| **F-08** Capability display hardcoded empty | **FIXED** | Real `supplier_capabilities` query and rendering are present. |
| **F-09** Dead integration links | **FIXED** | Dead settings/test/sync links were removed. |
| **F-10** Security copy overstated controls | **FIXED** | Copy now states that no supplier test/sync/outbound request exists. |
| **F-11** Encryption lacked context binding | **FIXED (with legacy read path)** | AES-GCM AAD is bound to the connection ID; tamper/substitution tests pass. |
| **F-12** Smoke coverage/reporting incomplete | **IMPROVED, NOT RERUN** | Script now counts blocked checks and covers more routes; no server was available. Prior 55/77 results were not reproduced. |
| **F-13** Canonical/favicon/SEO gaps | **PARTIAL / CURRENTLY REGRESSED** | Canonical metadata and `app/favicon.ico` exist, but `lib/sitemap.ts` omits `/legal/faq` and advertises a nonexistent `/compatibility/install` route. |
| **N-01** Error information disclosure | **FIXED (source)** | Error boundary and APIs return generic messages; server logs redact details. |
| **N-02** Payment authorization IDOR | **FIXED** | Owner/admin/order-token authorization tests pass. |
| **N-03** Order token minting after payment | **FIXED** | Token is created during checkout; payment actions do not mint new tokens. |
| **N-04** `super_admin` inconsistency | **FIXED** | Shared `isAdminRole` checks; tests cover `super_admin`. |
| **N-05** Cumulative refund overrun | **FIXED** | Requested + approved totals are reserved and rechecked in the transaction. |
| **N-06** Whop webhook accepted forged signatures | **FIXED (fail closed)** | `validateWebhookSignature` returns `false`; live Whop remains externally blocked. |
| **N-07** Outbound supplier transport controls | **OPEN BY DESIGN** | No outbound supplier HTTP client exists. DNS revalidation, redirects, timeouts, response-size limits, and log sanitization are required before one is added. |

The prior reports' claims about F-13 are not fully true of the current tree. The current sitemap is the authoritative evidence.

---

## F. Security findings

### F.1 Confirmed security strengths

| Control | Evidence | Assessment |
|---|---|---|
| Password hashing | scrypt with per-password salt, N=16,384, r=8, p=1, 64-byte key | Good for a local demo; no Argon2 requirement proven. |
| Session storage | Random token; only SHA-256 token hash stored; expiry checked in SQL | PASS (source/tests). |
| Session cookie | `httpOnly`, `sameSite=lax`, `secure` tied to HTTPS `SITE_URL`, explicit expiry | PASS (source). |
| Administrator 2FA | TOTP flow; pending session cannot access staff surfaces; production requires `ADMIN_2FA_REQUIRED=true` | PASS (source/tests). |
| Role guards | Customer, support, finance, admin, super-admin boundaries; finance read-only | PASS (tests). |
| Login/2FA/register/reset/contact/privacy rate limits | `checkRateLimit` calls in auth, contact, and privacy actions | PASS (source). |
| Refund integrity | Transaction, conditional claim, cumulative cap, idempotent approval | PASS (tests). |
| Refund audit | Single attributable `admin.refund.approve` row with actor, order, amount, outcome | PASS (tests). |
| Mock webhook signatures | HMAC verification with constant-time comparison; tamper and malformed-payload tests | PASS (tests). |
| Whop webhook | Explicit fail-closed verifier because the official algorithm is unimplemented | PASS (source/tests). |
| Supplier credential encryption | AES-256-GCM with AAD bound to `supplier-credential:v1:<connectionId>`; tamper/substitution rejection | PASS (tests). |
| SSRF URL/DNS validation | Rejects loopback, private, link-local, metadata, userinfo, unexpected ports, and failing DNS | PASS (current scope). |
| Error redaction | Generic error boundary/API responses; server logs only error names | PASS (source). |
| Security headers | `nosniff`, `DENY`, referrer policy, permissions policy, frame-ancestors/base-uri/form-action/object-src CSP, production HSTS | PASS (source). |
| Production configuration guard | HTTPS `SITE_URL`, PostgreSQL `DATABASE_URL`, TLS, context match, shared secrets, 2FA, non-demo production, KEK checks, live flags rejected | PASS (source/tests). |
| Blog HTML sanitization | Allowlist sanitizer strips scripts/styles/iframes/event handlers/`javascript:`/`data:text/html`; tests pass | PASS (for common vectors). |

### F.2 Residual security findings

| ID | Severity | Finding | Evidence | Status |
|---|---|---|---|---|
| **SEC-01** | High (functional/compliance) | Privacy-request review and retention-aware deletion cannot be completed through the UI | 10 legal actions exist but no page/component imports them; admin legal dashboard is a 71-line stub with placeholder retention/consent sections | **OPEN** |
| **SEC-02** | Medium | `/api/track` and `/api/consent` are unauthenticated write endpoints with no rate limiting | Route source contains origin/body-size/validation checks but no `checkRateLimit`; consent upserts and event inserts can be abused to grow the database | **OPEN** |
| **SEC-03** | Medium | CSP lacks `default-src` and `script-src` | `next.config.ts` emits only `frame-ancestors`, `base-uri`, `form-action`, `object-src` | **OPEN** |
| **SEC-04** | Medium | Analytics HMAC key can fall back to the rate-limit secret, then the auth secret, then a hardcoded local value | `lib/analytics-web.ts:129-135`; production preflight does not require `ANALYTICS_HASH_SECRET` | **OPEN** |
| **SEC-05** | Medium | Production security is unverified | No production deployment, PostgreSQL, secrets, or live provider; all production claims are static/config tests only | **BLOCKED** |
| **SEC-06** | Low/Medium | Custom HTML sanitizer is not a dedicated sanitizer library | `lib/sanitize.ts` states it is intentionally dependency-free; common-vector tests pass | **ACCEPTED RESIDUAL** |
| **SEC-07** | Low | CSP does not constrain the GA4 external script | `components/analytics-tracker.tsx` injects `googletagmanager.com`; CSP has no script policy | **OPEN** |
| **SEC-08** | Forward requirement | No outbound supplier transport controls | N-07 remains open by design; no HTTP client exists | **OPEN BY DESIGN** |

### F.3 Security verdict

The implemented local security controls are credible and unusually thorough for a demo. They are not evidence of production security. Production requires a deployed PostgreSQL database, generated secrets/KEKs, a real domain with HTTPS, a scheduler, backup/restore testing, monitoring, and live-provider review. None exists.

No secret values are reproduced in this report.

---

## G. Database and migration state

### G.1 Source schema vs local database

| Measure | Value |
|---|---:|
| Drizzle table definitions in `lib/db/schema.ts` | 64 |
| Public tables in local DB copy | 54 |
| Application tables in local DB copy | 53 |
| Phase 5 tables present in local DB copy | 0 |
| Phase 5 tables absent | 11 |

The 11 absent Phase 5 tables are:

```text
legal_settings
legal_document_versions
legal_third_parties
data_retention_settings
accessibility_reviews
asset_licenses
legal_readiness_items
privacy_requests
email_subscriptions
consent_events
cookie_consents
```

### G.2 Applied migrations in the local DB copy

```text
0001_initial.sql
0002_phase2_foundation.sql
0003_phase2_completion.sql
0004_supplier_connect.sql
0005_seo_blog_analytics.sql
```

`0006_legal_compliance.sql` exists but is **not applied** in the inspected copy. The local `support_tickets` table has these columns:

```text
id, user_id, order_id, subject, status, priority, created_at, updated_at
```

It does not have `requester_email`, which the current source schema expects and `0006` adds.

### G.3 Migration tests and upgrade path

- `tests/migrations.test.ts` creates a fresh in-memory PGlite database, applies all six migrations, and verifies that all 64 Drizzle-declared tables exist.
- That suite passes (3/3 tests).
- It does **not** test an upgrade from the existing 0005 local database to 0006.
- The 0005 → 0006 upgrade was **not executed** in this audit.
- `0006` uses `IF NOT EXISTS` and `ON CONFLICT DO NOTHING` in many places, so it appears structurally idempotent, but the upgrade is not proven.

### G.4 Runtime migration behavior

`lib/db/client.ts` auto-runs migrations when the database dialect is PGlite:

```ts
if (handle.dialect === "pglite") {
  await runMigrations(handle.client, handle.dialect);
}
```

Deployed PostgreSQL does **not** auto-migrate. It must be migrated explicitly with `npm run db:migrate` using `DATABASE_MIGRATION_URL` or `DATABASE_URL`. The Netlify build command is:

```text
npm run netlify:preflight && npm run build
```

It does not run migrations. The preflight explicitly states that it does not connect to the database. A production deploy can therefore pass preflight against an unmigrated database and fail at runtime.

### G.5 Local demo data

| Table | Rows |
|---|---:|
| `users` | 1 |
| `orders` | 4 |
| `plans` | 99 |
| `blog_articles` | 0 |
| `consent_events` | table absent |

### G.6 Retention inconsistency

| Source | Retention value |
|---|---:|
| `db/migrations/0006_legal_compliance.sql` — raw analytics events | 395 days |
| `db/migrations/0006_legal_compliance.sql` — analytics aggregates | 730 days |
| `.env.example` — `ANALYTICS_RETENTION_DAYS` | 90 |
| `app/api/jobs/run/route.ts` default | 90 |
| `lib/legal.ts` — `ANALYTICS_RETENTION_DAYS` | 180 (used as consent validity) |
| `lib/analytics-web.ts` cleanup clamp | 7–365 days |

`cleanupAnalytics` uses one cutoff for events, sessions, and visitors and does not read `data_retention_settings`. The 395/730-day database seeds cannot be honored while the cleanup is clamped to 365. The 180-day constant is named like analytics retention but is used for consent validity. There is no single source of truth for retention.

### G.7 Database verdict

**FAIL for current runtime readiness.** The source expects 64 tables and a new `requester_email` column; the inspected local database has 53 application tables and lacks the column. A normal PGlite startup should auto-apply 0006, but that was not run, and deployed PostgreSQL has no automatic migration step. Migration state is a release blocker until a tested upgrade and a deploy-time migration procedure exist.

---

## H. Tests and quality gates

### H.1 Commands and actual results

| Command | Result | Status |
|---|---|---|
| `npm.cmd run typecheck` | `tsc --noEmit`; exit 0; no diagnostics | **PASS** |
| `npm.cmd run lint` | `27 problems (11 errors, 16 warnings)`; exit 1 | **FAIL** |
| `npm.cmd test` | 17 files; 174 passed, 1 failed; 175 tests; 169.67s | **FAIL** |
| `npm.cmd run netlify:preflight` | `Netlify preflight skipped: APP_ENV=local...`; exit 0 | **SKIPPED (local context)** |
| `npm.cmd run smoke` | Not run; no server | **BLOCKED** |
| `npm.cmd run build` | Not run; would write `.next` and is outside read-only scope | **SKIPPED** |
| Browser/E2E/axe/Lighthouse | No suite or config exists | **NOT TESTED** |

### H.2 Lint failure

```text
✖ 27 problems (11 errors, 16 warnings)
```

All 11 errors are `@typescript-eslint/no-explicit-any` in `components/admin-legal-dashboard.tsx` (lines 20–30). Nine warnings are unused props in the same component. The remaining seven warnings are:

- Unused `formString` in `app/contact/actions.ts`.
- Six `<img>` warnings in blog-related pages (`@next/next/no-img-element`).

The lint errors point directly at the unfinished legal admin UI, not at unrelated code.

### H.3 Test failure

```text
FAIL  tests/phase4-access.test.ts > Phase 4 admin access and public tracking endpoint
      > public analytics endpoint > accepts valid events and marks internal traffic as excluded
AssertionError: expected 204 to be 202
❯ tests/phase4-access.test.ts:393:37
```

Cause: the test posts a valid tracking payload without the Phase 5 `x-es-consent-id` header or a server-side consent record. The Phase 5 gate returns 204 when consent evidence is missing. The test was not updated for the new requirement.

This is a test-maintenance regression. It does not prove the consent gate is wrong; it proves the suite is stale and cannot currently be used as a green release gate.

### H.4 Test coverage gaps

- No behavioral test references `legal_settings`, `privacy_requests`, `cookie_consents`, `email_subscriptions`, `consent_events`, or the new legal admin actions. The migration suite verifies that all 64 declared tables are created, but it does not exercise Phase 5 behavior.
- No test exercises the Phase 5 public privacy-request submission, status lookup, unsubscribe flow, or retention-aware privacy deletion.
- No test exercises the 0005 → 0006 upgrade.
- Sitemap tests assert published blog URLs but do not verify that every static sitemap path resolves to a real route; `/compatibility/install` is therefore undetected.
- No HTTP smoke, browser E2E, responsive, console/hydration, or accessibility test exists.
- No CI configuration (`.github/`) exists.

### H.5 Quality-gate verdict

`npm run check` is defined as `typecheck && lint && test` and would fail at lint, before tests. The quality gate is **FAIL**.

---

## I. Local runtime

### I.1 Server state

```text
Get-NetTCPConnection -LocalPort 3000 -State Listen
→ no listener

Invoke-WebRequest http://localhost:3000/api/health
→ HTTP_ERROR=Unable to connect to the remote server
```

No server was started, stopped, restarted, or terminated during this audit.

### I.2 Existing build artifact

- `.next/BUILD_ID` exists: `gtgqLrqFPrcagSckX4kx0`.
- Timestamp: `2026-11-07 21:54:04`.
- The app-paths manifest includes `/admin/legal`, `/api/consent`, `/legal/accessibility`, `/privacy/request`, and `/unsubscribe`.
- This is prior evidence that a build once completed; it is **not** a current build result. The build was not rerun.

### I.3 Local database/runtime mismatch

- The current local DB copy is at 0005.
- The current source expects 0006 tables and the `requester_email` column.
- PGlite auto-migration should apply 0006 on the next normal app startup, but that startup was forbidden by the read-only constraint.
- Post-migration local runtime is therefore **NOT TESTED**.

### I.4 Not verified in a browser

- Public and admin route rendering.
- Login/2FA, checkout, payment, and fulfillment flows.
- Consent banner behavior and server-side consent retry.
- Legal pages and privacy-request form behavior.
- Responsive layout.
- Console errors, hydration warnings, or asset failures.
- Keyboard and screen-reader accessibility.

### I.5 Local runtime verdict

**BLOCKED / NOT TESTED.** The absence of a running server is not evidence that the app is broken; it is evidence that runtime behavior was not verified.

---

## J. Netlify and production readiness

### J.1 Configuration present

`netlify.toml` defines:

```text
command = "npm run netlify:preflight && npm run build"
publish = ".next"
NODE_VERSION = "22"
```

No Netlify plugin is added; the file relies on zero-config Next.js detection. There is no `.netlify` directory and no deploy evidence.

### J.2 Production preflight requirements

For a deployed context, `lib/config.ts` requires or enforces:

- `APP_ENV` explicitly set to `preview`, `staging`, or `production`.
- `DATABASE_ENV` equal to `APP_ENV`.
- HTTPS `SITE_URL` (no localhost).
- PostgreSQL `DATABASE_URL` (no localhost, no disabled TLS).
- `AUTH_SECRET` at least 32 characters.
- `ACTIVATION_KEK_V1` as a base64 32-byte key.
- `ACTIVATION_KEK_ACTIVE_VERSION` positive integer.
- `INTERNAL_JOB_SECRET`.
- `RATE_LIMIT_HASH_SECRET`.
- `ADMIN_2FA_REQUIRED=true`.
- Production: `DEMO_MODE=false`, `SEED_DEMO_DATA=false`, `SUPPLIER_CREDENTIAL_KEK` 32 bytes, no activation-KEK fallback.
- Live flags (`PAYMENTS_LIVE_ENABLED`, `SUPPLIER_LIVE_ENABLED`, `EMAIL_LIVE_ENABLED`, `CATALOGUE_SYNC_ENABLED`, `ANALYTICS_ENABLED`, `STAGING_ACCESS_ENABLED`) are rejected because the adapters are unimplemented.

The environment inventory also lists `ANALYTICS_HASH_SECRET` as required for production, but `getConfigurationProblems()` does not enforce it; the analytics code falls back to `RATE_LIMIT_HASH_SECRET`, then `AUTH_SECRET`, then a hardcoded local value.

> **Correction (2026-11-23):** This statement is no longer accurate. Deployed configuration now
> requires `ANALYTICS_HASH_SECRET` (at least 32 characters) and rejects values equal to
> `AUTH_SECRET` or `RATE_LIMIT_HASH_SECRET`. There is no deployed fallback; only local demo/test
> uses a non-secret fallback.

The local preflight was skipped because `APP_ENV=local`; it did not validate production configuration.

### J.3 Current deployment blockers

| Blocker | Current evidence | Status |
|---|---|---|
| No evidence of a Netlify site/deploy | No `.netlify` directory; no deploy URL or build log | **BLOCKED** |
| No preview/production PostgreSQL evidenced | No provider, database, or connection string in the project; deployed mode requires PostgreSQL | **BLOCKED** |
| No verified domain/DNS/HTTPS origin | No verified HTTPS `SITE_URL` | **BLOCKED** |
| No evidence of production secrets/KEKs | No Netlify environment configuration; production requires multiple unique secrets | **BLOCKED** |
| No migration step in deploy | Build command does not run `db:migrate`; preflight does not connect to DB | **BLOCKED** |
| No scheduler/queue configuration | `/api/jobs/run` requires an external caller; no Netlify scheduled function or queue config | **BLOCKED** |
| No backup/restore/monitoring evidence | No provider backup/PITR, restore rehearsal, monitoring, or alerting | **BLOCKED** |
| No live payment/supplier/email | Disabled adapters; live flags intentionally rejected | **BLOCKED / BY DESIGN** |
| No legal/business approval | Legal drafts are `needs_legal_review`; business identity fields are empty | **BLOCKED** |
| No GSC verification evidence | No verification token or external Search Console action | **BLOCKED** |
| No external blog media host configured | Netlify does not persist local filesystem uploads | **BLOCKED** |
| No browser/E2E evidence | No Playwright/Cypress/axe setup or run | **BLOCKED** |
| No actual Netlify build/deploy evidence | Local `.next` artifact is not deployment evidence | **BLOCKED** |
| No production analytics evidence | Local tests only; no consented production traffic | **BLOCKED** |

The prior blocker register's B-01–B-15 remain substantively accurate. B-07 is partially superseded by the Phase 5 legal drafts, but owner/legal/tax review is still required. B-08, B-11, B-13, and B-14 are verification blockers, not merely configuration gaps.

### J.4 Netlify verdict

**BLOCKED.** There is no evidence of a Netlify site, deploy preview, production deploy, production database, domain, scheduler, backup, monitoring, or live operation. A local build artifact and a `netlify.toml` file are configuration, not deployment.

---

## K. Git history and change control

### K.1 Repository state

```text
Branch: main
Remote origin: https://github.com/teachermike2026-ship-it/esimprove.git
HEAD: 5dcb3ba Initial commit: local eSIMprove demo
Other branches: none (only remotes/origin/main)
Tags: none
Stash: none
```

### K.2 Working tree (measured before this report was written)

```text
Status entries: 191
Modified entries: 71
Untracked entries: 120 (146 files)
Deleted entries: 0
Tracked files: 159
Diff: 71 files changed, 9,604 insertions(+), 953 deletions(-)
```

The Phase 5 implementation, remediation work, and audit reports are uncommitted. There is no commit that separates a known-good pre-Phase-5 state from the current tree.

### K.3 Change-control risks

- No review trail for 9,604 insertions and 146 new files.
- No clean rollback point for Phase 5.
- No CI gate.
- Lint and tests are failing in the working tree.
- A single initial commit cannot represent the current architecture.

### K.4 Git verdict

**FAIL for change control.** The repository is not in a reviewable or rollback-safe state. No commit, push, or deploy was performed during this audit.

---

## L. Final readiness determination

### L.1 Decision

**SIGNIFICANT ISSUES FOUND — FURTHER WORK REQUIRED.**

The project is not production-ready, not Netlify-ready, and not complete. It is a substantial demo with strong core engineering and a real Phase 5 implementation gap.

### L.2 Must-fix before any next-step claim

**P0 — Release blockers**

1. Replace the legal admin stub with working forms for business details, document settings, retention, third parties, accessibility, readiness, privacy-request review, and unsubscribe administration. Wire the existing 10 server actions to the UI.
2. Apply and verify migration `0006` against a copy of the existing 0005 local database, then document and automate the deployed PostgreSQL migration step.
3. Fix the failing `tests/phase4-access.test.ts` consent-gate expectation and add Phase 5 tests for consent, privacy requests, unsubscribe, retention, and legal admin actions.
4. Fix the 11 lint errors and the admin legal unused-prop warnings.
5. Correct `lib/sitemap.ts`: remove `/compatibility/install`, add `/legal/faq`, `/legal/accessibility`, `/privacy/request` if indexable, and add blog tag routes or mark them noindex.
6. Establish a single retention policy source of truth and make cleanup read the approved settings.

**P1 — Verification and hardening**

7. Add rate limiting to `/api/track` and `/api/consent`.
8. Add `default-src`/`script-src` to the CSP or formally document the current limited policy.
9. Require a dedicated `ANALYTICS_HASH_SECRET` in production or explicitly document the fallback.
10. Run a browser E2E/responsive/console/accessibility suite, including the consent banner, legal pages, privacy form, and admin legal workflow.
11. Run `npm run smoke` against a locally started server and record the exact result.
12. Re-run a production build and preserve the build log.

**P2 — Launch readiness**

13. Provision Netlify, PostgreSQL, domain/DNS/HTTPS, secrets/KEKs, scheduler, backups/monitoring, media host, and live-provider contracts.
14. Complete owner/legal/tax review of the legal documents and business identity.
15. Verify Google Search Console and production analytics with real consented traffic.
16. Commit the reviewed work in coherent, reviewable commits.

### L.3 What can honestly be claimed now

- **Can claim:** the demo implements a broad mock commerce, auth, admin, supplier-security, blog/SEO, analytics, and legal/consent surface; core service tests pass; typecheck passes; many prior security findings are genuinely fixed.
- **Cannot claim:** the app runs correctly today, the local database is upgraded, the Phase 5 admin workflow works, the tests are green, lint is clean, the sitemap is correct, Netlify is ready, production security is verified, or the project is ready for launch.

### L.4 Evidence appendix — exact commands and results

```text
git log --oneline --decorate -n 5
→ 5dcb3ba (HEAD -> main, origin/main) Initial commit: local eSIMprove demo

git remote -v
→ origin https://github.com/teachermike2026-ship-it/esimprove.git (fetch)
→ origin https://github.com/teachermike2026-ship-it/esimprove.git (push)

git status --porcelain=v1 | Measure-Object -Line
→ 191 (before this report was created)

git diff --shortstat
→ 71 files changed, 9604 insertions(+), 953 deletions(-)

git ls-files --others --exclude-standard | Measure-Object -Line
→ 146 (before this report was created)

npm.cmd run typecheck
→ tsc --noEmit
→ TYPECHECK_EXIT=0

npm.cmd run lint
→ ✖ 27 problems (11 errors, 16 warnings)
→ Exited with code 1

npm.cmd test
→ Test Files  1 failed | 16 passed (17)
→ Tests       1 failed | 174 passed (175)
→ AssertionError: expected 204 to be 202
→ tests/phase4-access.test.ts:393:37
→ Duration 169.67s

npm.cmd run netlify:preflight
→ Netlify preflight skipped: APP_ENV=local is a local context, not a deployed deploy context.
→ PREFLIGHT_EXIT=0

Get-NetTCPConnection -LocalPort 3000 -State Listen
→ no listener

Invoke-WebRequest http://localhost:3000/api/health
→ HTTP_ERROR=Unable to connect to the remote server
```

Database copy queries:

```text
TABLE_COUNT=54
PHASE5_PRESENT=
PHASE5_MISSING=legal_settings,legal_document_versions,legal_third_parties,
  data_retention_settings,accessibility_reviews,asset_licenses,
  legal_readiness_items,privacy_requests,email_subscriptions,
  consent_events,cookie_consents
SUPPORT_TICKETS_COLUMNS=id,user_id,order_id,subject,status,priority,
  created_at,updated_at
COUNT_users=1
COUNT_orders=4
COUNT_plans=99
COUNT_blog_articles=0
COUNT_consent_events=TABLE_MISSING
MIGRATIONS=0001_initial.sql,0002_phase2_foundation.sql,
  0003_phase2_completion.sql,0004_supplier_connect.sql,
  0005_seo_blog_analytics.sql
```

Existing build artifact:

```text
.next/BUILD_ID = gtgqLrqFPrcagSckX4kx0
LastWriteTime  = 11/7/2026 9:54:04 PM
```

The build artifact includes Phase 5 routes, but it was not produced by this audit and is not a substitute for a current build, HTTP smoke test, or browser test.

---

**End of report.**
