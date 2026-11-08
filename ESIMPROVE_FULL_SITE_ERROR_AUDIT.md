# ESIMPROVE FULL SITE ERROR AUDIT — PHASE 1 EVIDENCE RECONCILIATION

Phase 1 audit date: 2026-11-04
Phase 2 local remediation date: 2026-11-05
Project: `C:\Users\hp\esimprove`
Phase 1 mode: **AUDIT ONLY** — no application code, tests, schema, migrations, configuration, `.env.local`, or deployment settings were changed.
Phase 2 mode: **LOCAL REPAIR AND VERIFICATION** — local application code, tests, and migrations were changed. No live supplier/payment/email/refund call, production database, deployment, secret, `.env.local`, or real customer data was changed. No commit, push, or deployment was performed.
Server used for final checks: local production build, `http://localhost:3000` (started and stopped for verification).

This report replaces the earlier Supplier-Connect-only version. The earlier claims are retained in the reconciliation section and are explicitly marked where superseded.

## 0. Phase 2 local remediation addendum (2026-11-05)

> The Phase 1 findings and evidence below are preserved as the historical audit record. Where they conflict with this addendum, this addendum governs. Full detail is in `ESIMPROVE_OPEN_ISSUES_AND_BLOCKERS.md` section 0.

### 0.1 Outcome

All 13 Phase 1 findings (**F-01–F-13**) were locally remediated and regression-tested. Six additional confirmed defects (**N-01–N-06**) were found during the repair pass and fixed. One forward-looking control requirement (**N-07**) remains open by design because no outbound supplier HTTP client exists. Live supplier, payment, email, refund, production database, and deployment verification remain **EXTERNAL BLOCKED**; production readiness remains **NO-GO**.

### 0.2 F-01–F-13 status

| ID | Phase 1 finding | Status | Key evidence |
|---|---|---|---|
| **F-01** | Supplier tables had no migration. | **FIXED** | `db/migrations/0004_supplier_connect.sql`; `tests/migrations.test.ts` 3/3 on fresh in-memory PGlite, including repeatability and supplier-table assertions. |
| **F-02** | Connection creation/credential persistence unimplemented. | **FIXED (LOCAL)** | Authenticated action, wired form, schema/URL validation, AES-256-GCM credential encryption, audit, redaction. Test verifies stored ciphertext, owner-only decryption, `enabled=false`, and no plaintext in row/audit metadata. |
| **F-03** | Tests exercised duplicate helpers, not production code. | **FIXED** | Duplicate `tests/test-helpers.ts` deleted; weak export-only test removed; production SSRF validator and session-backed guards/actions tested directly. |
| **F-04** | SSRF validator incomplete. | **FIXED FOR CURRENT SCOPE** | Expanded IPv4/IPv6/userinfo/port/numeric validation plus fail-closed DNS resolution; 28-case unsafe matrix and DNS tests. No outbound HTTP client exists; transport controls remain **N-07**. |
| **F-05** | Finance refund permission inconsistent. | **FIXED (POLICY)** | Finance is read-only (`orders.read`, `invoices.read`); refund execution is administrator-only. Role and session-backed denial tests pass. |
| **F-06** | Refund approval non-atomic/non-idempotent. | **FIXED** | Transaction + conditional `requested` claim + conditional payment update + cumulative cap. Duplicate-approval and over-refund tests pass. |
| **F-07** | Duplicate/unattributed refund audit. | **FIXED** | Single attributable `admin.refund.approve` row with actor, order, amount, and outcome. Test asserts exactly one approval audit. |
| **F-08** | Capability display hardcoded empty. | **FIXED** | Real `supplier_capabilities` query and rendering. |
| **F-09** | Dead integration links. | **FIXED** | Dead settings/test/sync links removed; page states those functions are not implemented. |
| **F-10** | Security copy overstated controls. | **FIXED** | Copy now matches implemented local controls and explicitly says no supplier test/sync/outbound request exists. |
| **F-11** | Encryption lacked context binding/key separation. | **FIXED (WITH LEGACY READ PATH)** | AES-GCM AAD bound to connection ID; `aadVersion=1` on new rows; substitution/tamper tests. Production requires `SUPPLIER_CREDENTIAL_KEK`; activation-KEK fallback requires explicit opt-in and is limited to non-production demo mode. Legacy unbound ciphertext remains readable by design. |
| **F-12** | Smoke coverage/reporting incomplete. | **FIXED** | Expanded public/dynamic/admin/API/404 checks; blocked counts; streaming `NEXT_REDIRECT` detection. Final: **55 PASS / 0 FAIL / 22 BLOCKED** without auth; **77 PASS / 0 FAIL / 0 BLOCKED** with a real admin session. |
| **F-13** | Canonical/favicon/SEO gaps. | **FIXED** | Canonical alternates across public/dynamic pages; demo-aware FAQ robots; `/legal/faq` sitemap entry; `app/favicon.ico`; `/favicon.ico` 200 in smoke. |

### 0.3 Additional defects found and fixed

| ID | Severity | Finding | Fix |
|---|---|---|---|
| **N-01** | High | Error boundary and three APIs exposed raw internal exception messages. | Generic client messages; server logs only the error name/diagnostic context. |
| **N-02** | High | Mock payment page/actions authorized by payment ID alone (IDOR). | Owner/admin/order-token authorization via `loadAuthorizedMockPayment`; regression test covers owner, other customer, finance, admin, anonymous, valid/invalid token, and action denial. |
| **N-03** | High | Mock success action minted an order access token for any payment ID. | Token is created at checkout and passed through; payment actions no longer mint tokens. Unauthorized action leaves payment `pending`. |
| **N-04** | Medium | `super_admin` not consistently treated as administrator. | Shared `isAdminRole` across login, 2FA, header, order access, and portal order/eSIM views; role tests. |
| **N-05** | Medium | Multiple refunds could cumulatively exceed the captured total. | Pending + approved refunds reserve the total; request and approval recheck the cap; regression test. |
| **N-06** | **Critical (latent)** | Whop webhook verifier returned `true` for any non-empty signature when a secret was configured. | Verifier now fails closed because the official algorithm is unimplemented; regression test. Live Whop remains external blocked. |

### 0.4 Residual requirement

**N-07 (open by design):** before any outbound supplier HTTP client is added, it must validate the URL/DNS immediately before connecting, bind to the validated address or revalidate, disable redirects, enforce connect/read timeouts and response-size limits, and sanitize errors/logs. No such client exists in this demo.

### 0.5 Final local verification

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS — exit 0, no output. |
| `npm run lint` | PASS — 0 errors, 0 warnings. |
| `npm test` | PASS — 14 files, **116 tests**, 0 failed, 0 skipped. |
| `npm run build` | PASS — production build; middleware proxy present. |
| Migration test | PASS — 3/3 isolated in-memory PGlite. |
| Unauthenticated smoke | PASS — 55/0/22 (blocked = authenticated admin without cookie). |
| Authenticated admin smoke | PASS — 77/0/0 with a real app-created admin session. |
| Runtime role denial | PASS — admin 200; customer/finance portal 200; customer/finance admin pages 307 → `/portal`; anonymous admin 307 → `/login`. |
| Browser/E2E/accessibility | **NOT DONE** — no browser automation; visual/responsive/a11y verification incomplete. |
| Live integrations/production | **EXTERNAL BLOCKED**. |

### 0.6 Updated recommendation

**NO-GO for production or live integration.** The local remediation gate passed for the audited code/test/migration/authorization/smoke/build scope. External onboarding, production database/deployment, legal review, browser/accessibility checks, backup/restore, and N-07 transport controls remain outstanding. No production-readiness or comprehensive-security claim is made.

---


## 1. Executive summary

The project builds, type-checks, lints, and passes its current test suite, and anonymous/invalid-session access to every discovered admin page is blocked without protected data exposure. Those are real, reproducible results.

The earlier conclusion that **“no security defects were demonstrated”** and the broader **“zero confirmed defects”** position are **not supported**. This audit confirmed 13 findings, including four High-severity issues:

1. The new supplier tables have **no migration**. Both a fresh migrated database and a copy of the current local `.pglite` database lack `supplier_connections` and `supplier_capabilities`.
2. Supplier connection creation and credential persistence are **not implemented**. The form posts to a page route with no handler; no connection is ever created; the encryption helpers are dead code.
3. The three “integration guard” tests test a **duplicate helper** in `tests/test-helpers.ts`, not the production SSRF validator. The two “auth guard” tests only assert that functions are exported.
4. The production SSRF validator allows `169.254.169.254`, IPv6 loopback, IPv4-mapped IPv6, ULA/link-local IPv6, and URLs with userinfo. It has no DNS/rebinding, redirect, timeout, or response-size controls. **No outbound HTTP path currently exists**, so these are latent rather than presently exploitable.

Authenticated admin access, regular-user denial, and Server Action authorization remain **NOT DONE**. They are locally testable and are not external blockers.

**Recommendation: NO-GO for live supplier integration or production launch.** Conditional GO for a Phase 2 remediation cycle, after explicit approval, starting with the migration and verification-integrity findings.

---

## 2. Verification labels used

| Label | Meaning in this report |
|---|---|
| `UNAUTHENTICATED_ACCESS_CONTROL_VERIFIED` | Anonymous HTTP requests were executed against the resource and no protected data was exposed. |
| `INVALID_SESSION_REJECTION_VERIFIED` | Requests with a bogus session cookie were executed and no protected data was exposed. |
| `AUTHENTICATED_ADMIN_ACCESS_VERIFIED` | A legitimate test-admin session was used successfully. **Not done.** |
| `REGULAR_USER_DENIAL_VERIFIED` | A legitimate regular-user session was denied from admin resources/actions. **Not done.** |
| `SERVER_ACTION_AUTHORIZATION_VERIFIED` | Each relevant Server Action was executed with valid/invalid sessions and side effects were checked. **Not done.** |
| `NOT DONE` | Locally testable work that was not performed. |
| `EXTERNAL BLOCKED` | A genuine third-party dependency prevents the check. |
| `MOCK/DEMO ONLY` | Evidence comes only from mocks, fixtures, or demo providers. |

Verification types are kept separate: static/source review, local automated test, local runtime, mock/demo, supplier sandbox, preview, production. No production verification was performed.

---

## 3. Commands executed and actual results

All commands were run from `C:\Users\hp\esimprove` in PowerShell. No command was retried with modified source to obtain a pass.

| Command | Exit code | Actual result |
|---|---:|---|
| `npm test` | **0** | 10 test files passed; **66 tests passed**; 0 failed; 0 skipped reported; 85.86 s. |
| `npm run lint` | **0** | **0 errors, 25 warnings**. |
| `npx tsc --noEmit` | **0** | No output (clean). |
| `npm run build` | **0** | Production build completed; `ƒ Proxy (Middleware)` present. |
| `npm run smoke` (server stopped) | **1** | 0 PASS / 8 FAIL; all failures were “server unreachable”. Negative test behaved correctly. |
| `npm run smoke` (server running) | **0** | **8 PASS / 0 FAIL**; authenticated branch reported `[BLOCKED]` because no cookie was supplied. Summary nevertheless printed `BLOCKED: 0`. |
| `npx vitest run tests/auth-guard.test.ts tests/integrations-auth-guard.test.ts --reporter=verbose` | **0** | 2 files, **5 tests passed**. All five are weak/non-behavioral; see F-03. |
| Admin route crawl (temporary Node script, no cookie + bogus cookie) | **0** | 23 admin page routes × 2 requests. All anonymous requests: 307 to login. All bogus-cookie requests: 200 shell with meta-refresh, no protected data. |
| Public route crawl (temporary Node script) | **0** | All 33 actual public page routes returned 200; an additional deliberate unknown-route probe returned 404 (34 requests total). |
| Sitemap sweep | **0** | **153/153** sitemap URLs returned 200. |
| Internal link crawl | **0** | 129 unique internal links; **0** bad. |
| Asset crawl | **0** | 10 unique `/_next/` assets; **0** bad. |
| In-memory migration check (fresh DB, migrations 0001–0003) | **0** | 43 public tables; `esims` present; `supplier_connections` and `supplier_capabilities` **absent**; supplier query failed with `relation "supplier_connections" does not exist`. |
| Local `.pglite` copy inspection (read-only copy) | **0** | 44 public tables (including `schema_migrations`); migrations 0001–0003 applied; supplier tables **absent**. |
| SSRF validator matrix (production function, no network) | **0** | 16 cases; 9 blocked, 7 allowed. Six unsafe cases were allowed; the seventh allowed URL was the expected safe control. See F-04. |
| Credential encryption roundtrip (test key, no output of key/secret) | **0** | Roundtrip true; ciphertext differs per call; decrypt API has no connection/AAD parameter, so ciphertext is not context-bound (source); key version 1. A direct cross-record substitution test was not separately executed. |
| `POST /api/jobs/run` without secret / with bogus secret | **0** (curl) | **401 / 401**. |
| `POST /api/webhooks/payments/mock` with `{}` | **0** (curl) | **400**. |
| `POST /admin/integrations` without cookie / with bogus cookie | **0** (curl) | **307 to login / 200 meta-refresh shell**; no handler, no mutation. |

Warnings: 25 ESLint warnings, primarily unused imports in admin pages (`Metadata`, `getDb`, `formatDate`, `supplierCapabilities`, `validateConnectionUrl`, `StatusBadge`, etc.). They are not build blockers, but several point directly at unfinished integration code (F-02, F-08).

The earlier “63 tests” figure is **stale/incomplete**. The earlier register’s “61/61” is **also stale**. The current authoritative count is **10 files / 66 tests**.

---

## 4. Test suite reconciliation

### 4.1 Exact test files and counts

| Test file | Tests declared | Included in `npm test`? |
|---|---:|---|
| `tests/auth-guard.test.ts` | 2 | Yes |
| `tests/catalogue-access.test.ts` | 5 | Yes |
| `tests/config.test.ts` | 4 | Yes |
| `tests/integration.test.ts` | 2 | Yes |
| `tests/integrations-auth-guard.test.ts` | 3 | Yes |
| `tests/integrations.test.ts` | 10 | Yes |
| `tests/phase2.test.ts` | 7 | Yes |
| `tests/provider.test.ts` | 4 | Yes |
| `tests/unit.test.ts` | 23 | Yes |
| `tests/webhook.test.ts` | 6 | Yes |
| **Total** | **66** | **10 files** |

`vitest.config.ts` sets `environment: "node"`, `setupFiles: ["./tests/setup.ts"]`, `fileParallelism: false`, `pool: "forks"`, and no project-specific exclusions. No skipped tests were reported. The three integration guard tests **are discovered and executed**.

### 4.2 Test validity findings

- `tests/integrations-auth-guard.test.ts:2` imports `buildUrl`, `assertPrivateIpBlocked`, `assertUrlSafe`, and `assertUrlNotLocalhost` from `./test-helpers`.
- `tests/test-helpers.ts:17-27` reimplements a private-IP check locally. It does **not** import `lib/adapters/ssrf-guard.ts`.
- Therefore the passing “integration security guards” tests prove the helper behaves as written; they do **not** prove the production validator is safe.
- `tests/auth-guard.test.ts:5-7` only asserts `typeof requireAdmin === "function"`.
- `tests/auth-guard.test.ts:11-14` only imports the action module and asserts `approveRefundAction` is a function. The test name claims “authorization ordering”; no ordering, session, database, or side-effect behavior is exercised.
- No test calls `getDb()`, `createSession()`, `getCurrentSession()`, `requireAdmin()`, or any Server Action with a real session. Tests use `tests/helpers/db.ts`, which creates `memory://` PGlite, runs migrations, and seeds the demo admin. This is good isolation, but it does not provide authenticated HTTP or Server Action coverage.

**Verdict:** test execution is healthy; authorization-test validity is not. See F-03.

---

## 5. Route inventory and runtime crawl

### 5.1 Inventory

| Category | Count | Evidence |
|---|---:|---|
| Page routes (`page.tsx`) | **56** | Filesystem enumeration of `app/**/page.tsx` |
| — Admin page routes | **23** | Includes `/admin`, `/admin/integrations`, `/admin/integrations/new`, `/admin/orders/[orderNumber]` |
| — Public page routes | **33** | Includes `/`, auth pages, portal, orders, legal, catalogue |
| Admin top-level directories | **20** | `app/admin/*` directories |
| API route handlers | **3** | `/api/health`, `/api/jobs/run`, `/api/webhooks/payments/mock` |
| Special metadata routes | 4 | `robots.txt`, `sitemap.xml`, `icon.svg`, dynamic 404 |
| Prerendered page routes | 0 | `.next/prerender-manifest.json` contains only `/_global-error` and `/icon.svg`; all pages are `ƒ` (dynamic) |

**Discrepancy resolved:** the earlier report claimed 22 admin directories while listing 19. Neither number matches the source. The actual inventory is **20 top-level admin directories and 23 admin page files**. The extra page files are nested routes, not extra top-level directories.

### 5.2 Admin routes — anonymous and bogus-cookie crawl

All responses were `text/html; charset=utf-8`. “Shell” means a 200 response containing the public layout and a `<meta http-equiv="refresh">` / `NEXT_REDIRECT` instruction to `/login`, with no admin content. No response contained `credentialEncrypted`, `supplier_connections`, `admin@demo.local`, or any email address. Body sizes were ~29.2 KB (range ~28.7–29.8 KB).

| Admin route | No cookie | Bogus cookie | Body finding | Authenticated test |
|---|---|---|---|---|
| `/admin` | 307 → `/login?next=%2Fadmin` (97 ms) | 200 shell → `/login` (71 ms) | No protected data | **NOT DONE** |
| `/admin/analytics` | 307 → login (6 ms) | 200 shell (52 ms) | No protected data | **NOT DONE** |
| `/admin/audit` | 307 → login (6 ms) | 200 shell (52 ms) | No protected data | **NOT DONE** |
| `/admin/coupons` | 307 → login (6 ms) | 200 shell (56 ms) | No protected data | **NOT DONE** |
| `/admin/customers` | 307 → login (6 ms) | 200 shell (51 ms) | No protected data | **NOT DONE** |
| `/admin/emails` | 307 → login (4 ms) | 200 shell (38 ms) | No protected data | **NOT DONE** |
| `/admin/finance` | 307 → login (4 ms) | 200 shell (34 ms) | No protected data | **NOT DONE** |
| `/admin/help` | 307 → login (4 ms) | 200 shell (42 ms) | No protected data | **NOT DONE** |
| `/admin/integrations` | 307 → login (6 ms) | 200 shell (56 ms) | No protected data | **NOT DONE** |
| `/admin/integrations/new` | 307 → login (6 ms) | 200 shell (57 ms) | No protected data | **NOT DONE** |
| `/admin/jobs` | 307 → login (9 ms) | 200 shell (42 ms) | “Fulfillment jobs” appears only as page/nav title, not job data | **NOT DONE** |
| `/admin/legal` | 307 → login (5 ms) | 200 shell (40 ms) | No protected data | **NOT DONE** |
| `/admin/monitoring` | 307 → login (4 ms) | 200 shell (46 ms) | No protected data | **NOT DONE** |
| `/admin/orders` | 307 → login (6 ms) | 200 shell (90 ms) | No protected data | **NOT DONE** |
| `/admin/orders/TEST-000` | 307 → login (4 ms) | 200 shell (40 ms) | No protected data | **NOT DONE** |
| `/admin/payments` | 307 → login (4 ms) | 200 shell (37 ms) | No protected data | **NOT DONE** |
| `/admin/plans` | 307 → login (5 ms) | 200 shell (35 ms) | No protected data | **NOT DONE** |
| `/admin/pricing` | 307 → login (4 ms) | 200 shell (39 ms) | No protected data | **NOT DONE** |
| `/admin/provider` | 307 → login (6 ms) | 200 shell (53 ms) | No protected data | **NOT DONE** |
| `/admin/refunds` | 307 → login (6 ms) | 200 shell (57 ms) | No protected data | **NOT DONE** |
| `/admin/seo` | 307 → login (6 ms) | 200 shell (45 ms) | No protected data | **NOT DONE** |
| `/admin/settings` | 307 → login (6 ms) | 200 shell (42 ms) | No protected data | **NOT DONE** |
| `/admin/support` | 307 → login (6 ms) | 200 shell (38 ms) | No protected data | **NOT DONE** |
| `/admin/does-not-exist` (probe) | 307 → login (proxy matches all `/admin`) | 404 | No data | N/A |

Important nuance: a bogus cookie produces **HTTP 200 with a streaming meta-refresh redirect**, not a 307. This is Next.js streaming behaviour when the redirect is raised in the admin layout after the shell has started. The status alone must not be read as “access granted”; body inspection showed no protected data. The `200` status could confuse simple scanners, but no data leak was observed.

### 5.3 Public routes — anonymous and bogus-cookie crawl

All 33 actual public page routes returned 200 both without a cookie and with a bogus cookie. An additional deliberate unknown-route probe returned 404. “Auth-guard” routes return a 200 streaming shell with a meta-refresh to login; “token-guard” routes return a no-data state; “flow” routes redirect to the cart.

| Public route | Access type | No cookie | Bogus cookie | Notes |
|---|---|---|---|---|
| `/` | Public | 200, 151 ms, 154,813 B | 200 | Homepage |
| `/about` | Public | 200, 54 ms | 200 | — |
| `/cart` | Public | 200, 28 ms | 200 | Empty cart allowed |
| `/checkout` | Flow | 200, 29 ms | 200 | Meta-refresh to `/cart` when cart is empty |
| `/checkout/pay/TEST-PAYMENT` | Flow/token | 200, 46 ms | 200 | No data for fake payment ID |
| `/checkout/success` | Flow/token | 200, 32 ms | 200 | No data for fake context |
| `/compatibility` | Public | 200, 39 ms | 200 | — |
| `/contact` | Public | 200, 28 ms | 200 | No live support channel |
| `/destinations` | Public | 200, 104 ms | 200 | — |
| `/destinations/japan` | Public | 200, 108 ms | 200 | Sample real slug |
| `/guides` | Public | 200, 82 ms | 200 | — |
| `/guides/installation` | Public | 200, 42 ms | 200 | Sample slug |
| `/legal` | Public | 200, 24 ms | 200 | — |
| `/legal/cookies` | Public | 200, 31 ms | 200 | Demo policy |
| `/legal/faq` | Public | 200, 69 ms | 200 | — |
| `/legal/privacy` | Public | 200, 34 ms | 200 | Demo policy |
| `/legal/refunds` | Public | 200, 34 ms | 200 | Demo policy |
| `/legal/terms` | Public | 200, 38 ms | 200 | Demo policy |
| `/login` | Public | 200, 38 ms | 200 | — |
| `/login/2fa` | Public page | 200, 33 ms | 200 | Requires pending session to use |
| `/login/forgot` | Public | 200, 30 ms | 200 | — |
| `/login/reset` | Public page | 200, 32 ms | 200 | Requires reset token to submit |
| `/orders/TEST-000` | Token/owner guard | 200, 53 ms | 200 | “Order not found” for fake order; no data |
| `/orders/TEST-000/esim/TEST-000` | Token/owner guard | 200, 60 ms | 200 | No data for fake IDs |
| `/plans` | Public | 200, 229 ms, 379,107 B | 200 | Largest crawled page |
| `/plans/japan-1000mb-7d` | Public | 200, 60 ms | 200 | Sample real slug |
| `/portal` | Auth guard | 200, 51 ms | 200 | Meta-refresh to `/login?next=%2Fportal`; no data |
| `/portal/esims/TEST-000` | Auth guard | 200, 27 ms | 200 | Meta-refresh to login; no data |
| `/portal/orders/TEST-000` | Auth guard | 200, 27 ms | 200 | Meta-refresh to login; no data |
| `/regions` | Public | 200, 48 ms | 200 | — |
| `/regions/europe` | Public | 200, 133 ms, 126,492 B | 200 | — |
| `/register` | Public | 200, 39 ms | 200 | — |
| `/search` | Public | 200, 28 ms | 200 | — |
| `/this-route-does-not-exist` (probe) | None | **404**, 22 ms | 404 | Custom not-found page |

### 5.4 API and metadata routes

| Route | Method | Expected access | Actual result |
|---|---|---|---|
| `/api/health` | GET | Public | 200, `application/json`, 331 B; advertises demo/mock modes and “not production readiness” |
| `/api/jobs/run` | POST | `INTERNAL_JOB_SECRET` | 401 without secret; 401 with bogus secret. Authorized execution **NOT TESTED** (would mutate jobs) |
| `/api/webhooks/payments/mock` | POST | Mock HMAC signature | 400 for `{}`; valid signed replay **MOCK/DEMO ONLY** |
| `/robots.txt` | GET | Public | 200, `text/plain`, 70 B; **`Disallow: /`** because `DEMO_MODE` is true |
| `/sitemap.xml` | GET | Public | 200, `application/xml`, 26,184 B; **153 URLs**, all 153 returned 200 |
| `/icon.svg` | GET | Public | 200, `image/svg+xml`, 539 B |
| `/favicon.ico` | GET | Public | **404**; the document links `/icon.svg`, but the conventional favicon path is absent |

### 5.5 Smoke-test coverage

`scripts/smoke-test.mjs:59` and `:70` cover only five admin routes: `/admin`, `/admin/monitoring`, `/admin/seo`, `/admin/help`, `/admin/analytics`.

Therefore **18 of the 23 admin page routes are not smoke-tested**, including:

- `/admin/integrations`
- `/admin/integrations/new`
- `/admin/audit`, `/admin/coupons`, `/admin/customers`, `/admin/emails`, `/admin/finance`, `/admin/jobs`, `/admin/legal`, `/admin/orders`, `/admin/orders/[orderNumber]`, `/admin/payments`, `/admin/plans`, `/admin/pricing`, `/admin/provider`, `/admin/refunds`, `/admin/settings`, `/admin/support`

The authenticated branch is skipped when `SMOKE_AUTH_COOKIE` is absent. The script prints `[BLOCKED]` five times, but `blockCount` remains 0 because those branches never push blocked results (`scripts/smoke-test.mjs:84-89`). The summary is therefore misleading. See F-12.

---

## 6. Authorization status

| Verification | Status | Evidence |
|---|---|---|
| `UNAUTHENTICATED_ACCESS_CONTROL_VERIFIED` | **VERIFIED** | All 23 admin page routes: 307 to `/login?next=...`; no protected body. `/admin/does-not-exist` also 307. |
| `INVALID_SESSION_REJECTION_VERIFIED` | **VERIFIED** | All 23 admin page routes with bogus cookie: 200 streaming shell + meta-refresh; no protected markers/emails. Detailed checks on `/admin/jobs` and `/admin/integrations`. |
| `AUTHENTICATED_ADMIN_ACCESS_VERIFIED` | **NOT DONE** | No legitimate admin session was created in Phase 1. Locally feasible; setup documented below. |
| `REGULAR_USER_DENIAL_VERIFIED` | **NOT DONE** | No regular-user session was created. Locally feasible. |
| `SERVER_ACTION_AUTHORIZATION_VERIFIED` | **NOT DONE** | Static review only. No Server Action was executed with admin/regular/expired sessions. |

### 6.1 Static Server Action review

All five exported admin actions call `requireAdmin()` as their first statement, before database access:

| Action | First statement | Mutation after guard? |
|---|---|---|
| `runJobsAction` (`app/admin/actions.ts:15`) | `requireAdmin()` at line 16 | Yes, after guard |
| `retryJobAction` (`:39`) | line 40 | Yes, after guard |
| `retryOrderJobsAction` (`:58`) | line 59 | Yes, after guard |
| `updatePlanAction` (`:89`) | line 90 | Yes, after guard |
| `approveRefundAction` (`:137`) | line 138 | Yes, after guard |

This ordering is good, but it is **not** the same as `SERVER_ACTION_AUTHORIZATION_VERIFIED`. No runtime test proves that a regular user is rejected or that no side effect occurs.

### 6.2 Precise setup required for the missing authenticated tests

Existing safe primitives:

- `tests/helpers/db.ts` creates `memory://` PGlite, runs migrations, and seeds `admin@demo.local`. Test credentials are defined in `tests/setup.ts` and must not be copied into reports.
- `lib/auth/session.ts:34` exports `createSession(db, userId, { ttlMinutes, ... })`, which returns the raw token and expiry.
- `lib/auth/session.ts:59` validates a token by SHA-256 hash and `expiresAt > now`; an expired session is rejected.
- `lib/config.ts:125` defines the cookie name as `${SESSION_COOKIE_PREFIX || "esimprove"}_session`.
- The admin layout (`app/admin/layout.tsx:13`) and every admin page (or the layout for the one page without an explicit call) enforce `requireAdmin()`; `proxy.ts:25-32` is the early cookie gate.

Recommended future test design (requires Phase 2 approval):

1. **Action-level tests (preferred first step):** use Vitest with `PGLITE_DATA_DIR=memory://`; mock `next/headers` `cookies()` to return a token created by `createSession()` for a seeded admin or regular user; invoke each action with `FormData`; catch the `NEXT_REDIRECT` thrown by `redirect()`; assert row counts, audit rows, payment/order states, and external-call counts are unchanged for unauthorized users.
2. **HTTP-level tests:** use a **file-based disposable PGlite directory** (not `memory://`, because separate processes do not share memory). Seed a dedicated admin and regular user, create sessions with `createSession()`, close the setup process, then start the built server with `PGLITE_DATA_DIR` pointing at that disposable directory and a non-default port. Send the real cookie to every admin route. A valid admin must get real admin content; a valid regular user must be redirected to `/portal`; an expired token must be redirected to login. Delete the directory afterwards.
3. **Negative side-effect checks:** for each action, snapshot the relevant tables before/after the unauthorized call; assert no mutation, no audit event, no job retry, no refund state change.
4. Never hardcode a cookie, bypass `createSession()`, or weaken `requireAdmin()` to make a test pass.

---

## 7. Confirmed findings

### 7.1 Findings summary

| ID | Severity | Area | Finding | Status |
|---|---|---|---|---|
| F-01 | **High** | Database/migrations | Supplier tables have no migration; fresh and current local DBs lack them; authenticated integrations page will fail | CONFIRMED (static + DB) |
| F-02 | **High** | Supplier Connect | Connection creation and credential persistence are not implemented; form has no handler; encryption helpers are dead code | CONFIRMED (static + runtime POST) |
| F-03 | **High** | Test integrity | Integration guard tests validate duplicated helpers, not production; auth tests only check exports | CONFIRMED (test run + source) |
| F-04 | **High (latent)** | SSRF | Validator allows metadata/link-local/IPv6/userinfo cases; no DNS/rebinding/redirect/timeout controls; no outbound path yet | CONFIRMED (pure-function test) |
| F-05 | **Medium** | Refund authorization | `finance` has `refunds.write`, but approval requires admin only; `requirePermission` has no callers | CONFIRMED (static) |
| F-06 | **Medium** | Refund integrity | Approval is check-then-act with no transaction/conditional update/idempotency; concurrent approvals can duplicate events/audit | CONFIRMED (source); race not runtime-reproduced |
| F-07 | **Medium** | Audit trail | One refund approval writes two audit records, one without `actorId` | CONFIRMED (static) |
| F-08 | **Medium** | Supplier Connect UI | Capability display is hardcoded empty; imported `supplierCapabilities` is unused; verified rows would not display | CONFIRMED (static + lint) |
| F-09 | **Low** | Supplier Connect UI | Links to `/admin/integrations/[id]`, `/test`, `/sync` point to routes that do not exist | CONFIRMED (static); not runtime-reachable |
| F-10 | **Low** | Documentation accuracy | Integration UI claims connection tests, timeouts, sanitized logging, and encrypted-at-rest credentials that are not implemented/wired | CONFIRMED (static) |
| F-11 | **Medium** | Encryption design | No AAD/context binding; credentials default to the activation KEK despite a comment saying “only if explicitly allowed” | CONFIRMED (source + roundtrip test) |
| F-12 | **Low** | Verification tooling | Smoke test covers 5 of 23 admin routes and reports `BLOCKED: 0` when 5 authenticated checks were skipped | CONFIRMED (runtime output) |
| F-13 | **Low** | SEO/assets | No canonical links; demo robots disallows everything while sitemap advertises 153 URLs; `/favicon.ico` is 404 | CONFIRMED (runtime/static) |

Severity counts: **4 High, 5 Medium, 4 Low**.

### F-01 — Supplier tables have no migration

- **Severity:** High.
- **Affected area:** `supplier_connections`, `supplier_capabilities`, `/admin/integrations`.
- **Root cause:** `lib/db/schema.ts:839` defines `supplierConnections`; `:864` defines `supplierCapabilities`. The migration directory contains only `0001_initial.sql`, `0002_phase2_foundation.sql`, and `0003_phase2_completion.sql`. No migration contains either table name.
- **Reproduction:** run migrations 0001–0003 against an empty in-memory PGlite DB; query `pg_tables`; query `supplier_connections`.
- **Observed:** 43 public tables; `esims` present; both supplier tables absent; `select * from supplier_connections` failed with `relation "supplier_connections" does not exist`.
- **Local DB check:** a read-only copy of `.pglite` had 44 public tables (including `schema_migrations`), applied migrations 0001–0003, and **neither supplier table**.
- **Expected:** migrations create every table declared in `schema.ts`, including indexes and foreign keys.
- **Impact:** `app/admin/integrations/page.tsx:15` calls `listConnections()` after `requireAdmin()`. A legitimate admin would execute a query against a missing relation and receive a server error. This was not executed with a real session, but the DB state and code path are confirmed.
- **Minimal fix:** add `db/migrations/0004_supplier_connect.sql` matching the Drizzle schema; test it against an empty disposable database; add a migration/schema consistency test.
- **Verification status:** CONFIRMED static + local DB; authenticated HTTP 500 **inferred, not executed**.

### F-02 — Connection creation and credential persistence are non-functional

- **Severity:** High.
- **Affected area:** `/admin/integrations/new`, `lib/adapters/connection-store.ts`, `lib/adapters/encryption.ts`.
- **Root cause:** `app/admin/integrations/new/page.tsx:17` renders `<form method="POST" action="/admin/integrations">`. There is no route handler at that path and no Server Action. `connection-store.ts` exports only `listConnections`, `getConnection`, `updateConnectionStatus`, `setLastTestSafe`, and `setLastSync`; there is no create/upsert. A repository-wide search found **zero** assignments to `credentialEncrypted`. `encryptSupplierCredential` and `decryptSupplierCredential` (`lib/adapters/encryption.ts:17,31`) have no callers.
- **Reproduction:** `POST /admin/integrations` without a cookie → 307 to login; with a bogus cookie → 200 meta-refresh shell. Source search for create/credential writes returns nothing.
- **Expected:** an authenticated action validates input and URL, encrypts the credential, inserts a connection row plus audit event, and never returns the secret.
- **Impact:** the Supplier Connect UI cannot create a connection or store a credential. It is demo UI only.
- **Minimal fix:** implement the authenticated create action and audit record, or remove the form/UI until the feature exists. Add tests for validation, encryption, redaction, and authorization.
- **Verification status:** CONFIRMED static + runtime POST; no database mutation observed.

### F-03 — Guard tests do not test production authorization or SSRF code

- **Severity:** High.
- **Affected area:** `tests/integrations-auth-guard.test.ts`, `tests/test-helpers.ts`, `tests/auth-guard.test.ts`.
- **Root cause:** the integration test imports helper functions from `./test-helpers`; those helpers duplicate a private-IP regex (`tests/test-helpers.ts:17-27`) instead of importing `lib/adapters/ssrf-guard.ts`. The auth test asserts function existence only (`tests/auth-guard.test.ts:5-14`).
- **Reproduction:** run the two files verbosely; inspect imports and assertions.
- **Observed:** 5/5 tests pass in 7.60 s. The three “integration security guards” tests never import the production validator. The two auth tests never create a session or invoke an action.
- **Expected:** tests import production functions and assert behavior (allow/block cases, redirects, no side effects).
- **Impact:** the passing suite creates false assurance about SSRF and Server Action authorization. This directly caused the earlier overclaim.
- **Minimal fix:** delete the duplicated helper logic; test `validateConnectionUrl` directly; add session-backed action/route tests; rename tests to match what they actually prove.
- **Verification status:** CONFIRMED by test execution + source.

### F-04 — SSRF validator is materially incomplete

- **Severity:** High (latent; no outbound request path exists yet).
- **Affected area:** `lib/adapters/ssrf-guard.ts`.
- **Root cause:** `isPrivateHostname` (`:9-12`) checks only `10.`, `172.16–31.`, `192.168.`, `127.`, `0.`, and the exact string `::1`. Node’s `URL.hostname` returns IPv6 literals **with brackets**, so `::1` does not match. There is no DNS resolution, redirect handling, userinfo rejection, timeout, or response-size control.
- **Reproduction:** call `validateConnectionUrl` with the matrix below (pure function; no network).
- **Observed:**

| Input | Result |
|---|---|
| `http://localhost:3000` | BLOCK |
| `http://10.0.0.1` | BLOCK |
| `http://172.16.0.1` | BLOCK |
| `http://192.168.1.1` | BLOCK |
| `http://127.0.0.1` | BLOCK |
| `http://2130706433` | BLOCK (normalized to 127.0.0.1) |
| `http://0x7f000001` | BLOCK (normalized) |
| `http://127.1` | BLOCK (normalized) |
| `ftp://example.com` | BLOCK (protocol) |
| `http://169.254.169.254` | **ALLOW** |
| `http://[::1]` | **ALLOW** |
| `http://[::ffff:127.0.0.1]` | **ALLOW** |
| `http://[fd00::1]` | **ALLOW** |
| `http://[fe80::1]` | **ALLOW** |
| `https://user:pass@example.com/path` | **ALLOW** (userinfo retained) |
| `https://api.supplier.example.com` | ALLOW (expected) |

- **Expected:** block loopback, private, link-local, metadata, ULA, IPv4-mapped IPv6, and userinfo; resolve DNS and re-check all addresses; constrain redirects/timeouts/sizes when HTTP is added.
- **Impact:** latent SSRF bypass once a connection-test or adapter HTTP path is implemented. No outbound path exists today, so this is not currently exploitable through the application.
- **Minimal fix:** use a maintained SSRF-safe URL/DNS library or resolve and validate all A/AAAA records; block the full non-public ranges; reject userinfo; enforce redirect/timeout/size limits at the HTTP client.
- **Verification status:** CONFIRMED pure-function; no network requests performed.

### F-05 — Finance role cannot use its refund permission

- **Severity:** Medium.
- **Affected area:** refund authorization/RBAC.
- **Root cause:** `lib/auth/roles.ts:48` grants `finance` the `refunds.write` permission. `app/admin/actions.ts:138` calls `requireAdmin()` with no permission argument; `requireAdmin` only allows `admin`/`super_admin` (`lib/auth/guards.ts:21-35`). `requirePermission` (`guards.ts:38-50`) has **no callers** outside its definition.
- **Reproduction:** inspect the role map, the action, and search for `requirePermission(`.
- **Observed:** Finance users are redirected to `/portal`; the permission is defined but unenforced.
- **Expected:** either Finance may approve refunds via `requirePermission("...", "refunds.write")`, or the permission should be removed and admin-only policy documented.
- **Impact:** role model and runtime authorization disagree; future Finance UI would fail.
- **Minimal fix:** decide the policy; enforce it consistently; add role-based tests.
- **Verification status:** CONFIRMED static.

### F-06 — Refund approval is non-atomic and not idempotent

- **Severity:** Medium.
- **Affected area:** `lib/refunds.ts`, `approveRefundAction`.
- **Root cause:** the action reads the refund and checks `status !== "requested"` (`actions.ts:142-146`), then calls `applyRefund`, which re-reads and re-checks (`refunds.ts:95-101`), but all subsequent updates are unconditional (`refunds.ts:120-135`). There is no transaction, no `WHERE status = 'requested'` conditional update, and no idempotency key.
- **Reproduction:** source inspection; concurrent requests were not executed.
- **Observed:** two concurrent approvals could both pass the check and both update payment/order, insert order events, and write audit records.
- **Expected:** a single conditional transition and one audit record per approval; concurrent attempts return “already processed”.
- **Impact:** duplicate events/audit and state churn. **No real money moves** because no provider refund call exists; duplicate financial refunds were not demonstrated.
- **Minimal fix:** wrap the transition in a transaction; update with `WHERE id = ? AND status = 'requested' RETURNING ...`; add an idempotency key; test concurrent approvals.
- **Verification status:** CONFIRMED missing guard; race impact not reproduced.

### F-07 — Duplicate refund audit records

- **Severity:** Medium.
- **Affected area:** refund audit trail.
- **Root cause:** `applyRefund` writes `action: "refund.approved"` with `actorType: "admin"` and no `actorId` (`lib/refunds.ts:146-152`). `approveRefundAction` then writes `action: "admin.refund.approve"` with the real `actorId` (`app/admin/actions.ts:149-156`).
- **Observed:** one approval produces two audit rows; one cannot be attributed to a specific admin.
- **Expected:** one authoritative audit event with actor, amount, order, and refund ID.
- **Minimal fix:** record once in the action (or pass the actor into the service); remove the duplicate.
- **Verification status:** CONFIRMED static; not runtime-generated.

### F-08 — Capability display is hardcoded empty

- **Severity:** Medium.
- **Affected area:** `/admin/integrations`.
- **Root cause:** `app/admin/integrations/page.tsx:16-21` builds `verifiedCapabilities` by assigning `[]` for every connection. `supplierCapabilities` is imported at line 5 but never queried (also an ESLint warning). Line 65 renders “None verified” for every row.
- **Observed:** even if capability rows existed, the UI would show none.
- **Expected:** join/query `supplier_capabilities` and render the real statuses, or remove the column.
- **Impact:** an operator cannot see verified capabilities; the UI is misleading.
- **Minimal fix:** query capabilities with connection IDs and render status/verifiedAt; add a test.
- **Verification status:** CONFIRMED static + lint warning.

### F-09 — Dead integration links

- **Severity:** Low.
- **Affected area:** `/admin/integrations`.
- **Root cause:** `app/admin/integrations/page.tsx:71-73` links to `/admin/integrations/${conn.id}`, `/test`, and `/sync`. Only `app/admin/integrations` and `app/admin/integrations/new` exist.
- **Observed:** those URLs would 404 once a connection row exists.
- **Expected:** routes exist, or links are disabled until implemented.
- **Minimal fix:** add the settings/test/sync routes or remove the links.
- **Verification status:** CONFIRMED static; not runtime-reachable because no connection can be created.

### F-10 — Integration security copy overstates implemented controls

- **Severity:** Low.
- **Affected area:** Supplier Connect UI text.
- **Root cause:** `app/admin/integrations/page.tsx:38-39` says connection tests include SSRF protection, bounded timeouts, and sanitized logging. `app/admin/integrations/new/page.tsx:50` says credentials are encrypted at rest using a KEK. No connection test, timeout, outbound request, or credential write path exists.
- **Observed:** the statements are not true of the current implementation.
- **Expected:** copy should describe the current state or the controls should be implemented.
- **Minimal fix:** correct the copy now; restore it when the controls exist.
- **Verification status:** CONFIRMED static.

### F-11 — Credential encryption lacks context binding; key separation is implicit

- **Severity:** Medium.
- **Affected area:** `lib/adapters/encryption.ts`, `lib/crypto.ts`.
- **Root cause:** AES-256-GCM is used without AAD in `encryptWithKey`/`decryptWithKey` (`lib/crypto.ts:22-43`). `getSupplierCredentialKey` prefers `SUPPLIER_CREDENTIAL_KEK` but falls back unconditionally to `activationKek()` (`lib/adapters/encryption.ts:4-15`), despite the comment “only if explicitly allowed”; there is no explicit fallback flag.
- **Reproduction:** inspect `lib/crypto.ts:22-43` and `lib/adapters/encryption.ts:17-34`; encrypt two test secrets and decrypt each. The decrypt API takes no connection identifier or AAD.
- **Observed:** roundtrip true; ciphertext differs per call; key version 1. No AAD/context parameter exists, so a stored ciphertext record is not cryptographically bound to its connection ID. A direct cross-record substitution test was not separately executed.
- **Expected:** bind ciphertext to the connection ID/purpose/version via AAD; require a dedicated supplier key or an explicit fallback configuration.
- **Impact:** ciphertext substitution between records would not be detected cryptographically. The helpers are currently unused, so there is no stored credential to attack.
- **Minimal fix:** add AAD (`connectionId`, purpose, key version); fail closed without a dedicated key or explicit fallback flag; document rotation.
- **Verification status:** CONFIRMED local test; not used in production flow.

### F-12 — Smoke-test coverage and reporting are incomplete

- **Severity:** Low.
- **Affected area:** `scripts/smoke-test.mjs`.
- **Root cause:** only five admin paths are listed (`:59`, `:70`), and the no-cookie branch prints `[BLOCKED]` without pushing a blocked result (`:80-82`), so `blockCount` stays 0.
- **Observed:** 8 PASS / 0 FAIL / 0 BLOCKED, although five authenticated checks were skipped. 18 admin routes are not covered, including both integration routes.
- **Expected:** derive admin routes from the build manifest or a maintained list; count skipped checks as BLOCKED; include integrations.
- **Minimal fix:** expand the route list, fix the blocked counter, and keep authenticated checks opt-in.
- **Verification status:** CONFIRMED runtime output + source.

### F-13 — SEO canonical/favicon gaps in the current demo state

- **Severity:** Low.
- **Affected area:** SEO/static assets.
- **Root cause:** `app/layout.tsx:23-46` defines `metadataBase`, OpenGraph, and Twitter metadata, but no `alternates.canonical`; no page exports a canonical URL. `app/robots.ts:7-12` returns `Disallow: /` when `demoMode` is true, while `app/sitemap.ts` advertises 153 URLs. `/favicon.ico` returns 404; `/icon.svg` exists.
- **Observed:** 153/153 sitemap URLs are 200, but the demo site is intentionally non-indexable; canonical tags are absent; conventional favicon 404.
- **Expected for production:** `DEMO_MODE=false`, `robots` allows public pages and disallows admin/portal/checkout/orders/api, canonical URLs are present, and a favicon resolves.
- **Minimal fix:** add canonical alternates per page; add `app/favicon.ico` or accept `/icon.svg`; verify robots with production env.
- **Verification status:** CONFIRMED runtime/static; production behaviour NOT DONE.

---

## 8. Unconfirmed risks and missing evidence

| Risk / gap | Status | Why it remains unconfirmed |
|---|---|---|
| Authenticated `/admin/integrations` returns HTTP 500 | **UNCONFIRMED (inferred)** | DB lacks tables and the page queries them, but no real admin session was used. |
| Concurrent refund approval actually duplicates records | **UNCONFIRMED** | Source shows a race; no concurrent test was executed. |
| DNS rebinding / redirect SSRF exploit | **UNCONFIRMED** | No outbound HTTP path exists; no malicious DNS/network tests performed. |
| Error boundary exposes internal messages in production | **UNCONFIRMED** | `app/error.tsx` renders `error.message`; Next.js production sanitization not verified. |
| Production environment validation | **NOT DONE** | No production env; only source review of `assertProductionSafe`. |
| Browser console/hydration/responsive/accessibility defects | **NOT DONE** | No Playwright/Puppeteer/Cypress installed. |
| Legal/tax/policy compliance | **EXTERNAL BLOCKED** | Requires jurisdiction and legal review; demo disclaimers only. |
| Valid signed webhook replay/idempotency against a live provider | **MOCK/DEMO ONLY** | Mock HMAC tests exist; no live provider. |
| Historical `db:push`/migrate/seed execution | **CANNOT CONFIRM** | No logs or shell history establish what was run. |

---

## 9. Database, migration, and environment readiness

### 9.1 Migration path

- `lib/db/migrate.ts:41-65` reads `db/migrations/*.sql`, sorts them, tracks applied files in `schema_migrations`, and wraps each in `BEGIN/COMMIT`.
- `lib/db/client.ts:71-82` calls `runMigrations()` on first `getDb()`. The server self-migrates on first use.
- `scripts/setup.ts:66-73` opens `PGLITE_DATA_DIR || ".pglite"`, runs migrations, and seeds demo data.
- Migration files: `0001_initial.sql` (2026-10-23), `0002_phase2_foundation.sql` (2026-11-03), `0003_phase2_completion.sql` (2026-11-03).
- `lib/db/schema.ts` was modified 2026-11-04 and contains the supplier tables; no migration was added afterward.
- No `drizzle.config.*`, `drizzle-kit` dependency, or `db:push` script exists. The only schema-apply path is SQL migrations.

### 9.2 Database targets and test isolation

- `.env.local` keys present include `PGLITE_DATA_DIR`, `APP_ENV`, `DEMO_MODE`, `SEED_DEMO_DATA`, auth/encryption secrets, and demo admin settings. **No `DATABASE_URL` is set.** Local runtime therefore targets PGlite, not a remote Postgres.
- `.env.local` is ignored by `.gitignore` (`.env`, `.env.*`), and no secret values were printed in this audit.
- `tests/helpers/db.ts:5-13` always calls `createDatabase({ dataDir: "memory://", connectionString: "" })`, runs migrations, and seeds. A search of `tests/` found no `getDb(` calls, so tests do not use the server’s persistent `.pglite`.
- Tests therefore cannot accidentally target development or production data under the current configuration. They also do not exercise the missing supplier tables.
- A fresh in-memory migration test is safe and was performed; **no migration was applied to the persistent database**, and no seed or destructive operation was run.

### 9.3 Readiness verdict

**FAIL.** The application cannot create the supplier schema from migrations. A deployment to an empty database would build successfully but fail at runtime on `/admin/integrations`. The current local database is in the same state.

---

## 10. Supplier Connect security review

### 10.1 Authorization

- `app/admin/integrations/page.tsx:14` and `app/admin/integrations/new/page.tsx:6` call `requireAdmin()`.
- `app/admin/layout.tsx:13` also calls `requireAdmin("/admin")`, providing a layout-level gate for all admin pages.
- `proxy.ts:25-32` redirects requests with no session cookie before rendering.
- There are **no integration Server Actions or route handlers** to authorize; no mutation path exists.

### 10.2 Credential handling

- `credentialEncrypted` is defined in the schema but never written.
- `listConnections()` selects all columns, including the ciphertext JSON, into the server component. It is not rendered or serialized to the client; no credential was returned in any crawled response.
- `encryptSupplierCredential`/`decryptSupplierCredential` are defined but unused.
- Encryption uses AES-256-GCM envelope encryption; the KEK comes from `SUPPLIER_CREDENTIAL_KEK` or `ACTIVATION_KEK_V1`; key length is validated; missing configuration throws; the key is not stored in the database.
- No AAD binding and no dedicated-key requirement; see F-11.
- No audit record exists for connection creation, credential replacement, enable/disable, test, or sync because those flows do not exist.

### 10.3 SSRF and outbound requests

- URL validation is a pure string check; see F-04.
- There is **no actual outbound HTTP request path** in `lib/adapters/*`. The adapter interface methods are optional and unimplemented.
- Consequently there are no implemented timeouts, response-size limits, redirect policies, credential-forwarding controls, or DNS re-resolution checks. These are required before any adapter is connected.

### 10.4 Supplier-neutral model

- `lib/adapters/types.ts:6` defines the five required capability states: `unknown`, `documented`, `sandbox_verified`, `production_verified`, `unsupported`.
- `:8-26` lists 18 capabilities; none are marked supported by default.
- `:44-59` defines optional adapter methods. No supplier-specific URL, header, or credential format is hardcoded.
- The model is appropriately supplier-neutral. Its verification workflow is not implemented.

---

## 11. Refund authorization and financial integrity

| Check | Result |
|---|---|
| Authorization before DB access | **PASS static:** `requireAdmin()` is line 138, before `getDb()` at line 141. |
| Finance/Admin separation | **FAIL:** Finance has `refunds.write` but cannot pass `requireAdmin()`. |
| Audit record | **PARTIAL:** two records, one without actor identity. |
| Duplicate/concurrent approval | **FAIL (design):** check-then-act; no transaction or conditional update. |
| State transition enforcement | **PARTIAL:** status checks exist, but not atomic. |
| Idempotency | **NOT IMPLEMENTED.** |
| Provider refund call | **NOT IMPLEMENTED:** `requestRefund` exists only in the adapter interface; `applyRefund` never calls a provider. |
| Real money movement | **NONE:** demo/mock only. |

Confirmed defects: F-05, F-06, F-07. Missing design requirements: provider refund integration, idempotency key, finance policy decision. Untested: concurrent execution and real provider behavior.

---

## 12. Supplier readiness matrix

No supplier has been selected. Every capability below is **`unknown`**. No capability row exists in any database. “Model support” means the TypeScript contract and/or `supplier_capabilities` table can represent it; it does **not** mean the supplier supports it.

| Capability | Current status | Local model support | Evidence required to advance |
|---|---|---|---|
| `catalog_sync` | unknown | Contract + table; no adapter/UI write | Docs: catalog endpoint/schema → sandbox: fetch sample catalog → production: monitored scheduled sync |
| `price_sync` | unknown | Contract + table; no adapter | Docs: price fields/currency/tax → sandbox: compare sample prices → production: price parity check |
| `availability_sync` | unknown | Contract + table; no adapter | Docs: availability semantics/freshness → sandbox: sample → production: freshness SLA |
| `order_creation` | unknown | Contract + table; no adapter | Docs: order API/idempotency → sandbox: create test order → production: live order with rollback |
| `order_status` | unknown | Contract + table; no adapter | Docs: status mapping → sandbox: poll test order → production: live status parity |
| `profile_issuance` | unknown | Contract + table; no adapter | Docs: issuance response → sandbox: issue test profile → production: live issuance with audit |
| `iccid_available` | unknown | `esims.iccid` nullable | Docs: field/format → sandbox: test ICCID → production: live ICCID validation |
| `lpa_format_documented` | unknown | Encrypted LPA columns exist | Docs: activation code/LPA format → sandbox: parse test → production: live |
| `qr_payload_documented` | unknown | QR generated at render; no payload field | Docs: QR payload spec → sandbox: scan test → production: live |
| `profile_lifecycle_documented` | unknown | Free-text `esims.status`; no state map | Docs: states/transitions/observation → sandbox: observe transitions → production: live |
| `usage_and_remaining_data` | unknown | **No usage table/fields** | Docs: usage endpoint/units/freshness → sandbox: sample → production: live |
| `top_ups` | unknown | No table/UI | Docs: API/policy → sandbox: test top-up → production: live |
| `renewals` | unknown | No table/UI | Docs: policy/API → sandbox: test renewal → production: live |
| `cancellation` | unknown | No adapter | Docs: policy/API → sandbox: test cancel → production: live |
| `refund_request` | unknown | Interface only; no call | Docs: policy/API → sandbox: test refund → production: live |
| `webhooks_documented` | unknown | `webhookEvents` + mock endpoint exist | Docs: event types/signature/retry → sandbox: receive signed event → production: live with replay protection |
| `supplier_wallet` | unknown | Provider balance tables exist; mock only | Docs: balance API → sandbox: balance → production: live threshold alerts |
| `supplier_invoice_access` | unknown | No adapter/table | Docs: invoice feed → sandbox: sample invoice → production: live reconciliation |

### Decision 1 — Capability verification method

The model supports the required five states and defaults to `unknown` (`lib/db/schema.ts:879-881`, `lib/adapters/types.ts:6`). It does not implement a workflow that transitions a capability from `unknown` to any verified state. Catalog support must never imply fulfillment, lifecycle, usage, or refund support.

Evidence ladder:

1. **`documented`** — official supplier documentation with version/date, endpoint, authentication, request/response fields, error codes, rate limits, and webhook contract. Documentation alone does not prove a working operation.
2. **`sandbox_verified`** — official sandbox base URL, test credentials, and a recorded, sanitized request/response demonstrating the operation. No production data.
3. **`production_verified`** — signed contract, production credentials, a monitored live verification, and a rollback/support procedure.
4. **`unsupported`** — written supplier confirmation that the operation is unavailable, or confirmed absence in the official contract. Absence of documentation alone should remain `unknown`.

### Decision 2 — Supplier sandbox and webhook contract (EXTERNAL BLOCKED)

All items below are **EXTERNAL BLOCKED** pending supplier selection:

1. Official API documentation and version/effective date.
2. Sandbox base URL and access procedure.
3. Test credentials and credential rotation policy.
4. Authentication contract (header/signature/OAuth/mTLS).
5. Supported operations and exact request/response schemas.
6. Webhook event types and payload schemas.
7. Signature verification algorithm, canonicalization, timestamp/replay rules.
8. Retry policy, rate limits, idempotency keys, and error taxonomy.
9. IP allowlist/egress requirements and TLS pinning requirements.
10. Data-retention, PII, and sub-processor terms.

Local work that can proceed without a supplier: mock-adapter contract tests, mock payment webhook HMAC/replay tests, idempotency tests, schema/migration tests, and UI authorization tests. These remain **MOCK/DEMO ONLY** and must not be described as supplier integration tests.

### Decision 3 — eSIM lifecycle and usage fields

| State/field | Current representation | Supplier observation timestamp? | Gap |
|---|---|---|---|
| Issued | `esims` row created during fulfillment; `status` defaults to `ready_to_install`; `createdAt` exists | No explicit “issued” state | No issued state/supplier reference beyond `supplierEsimId` |
| Downloaded | Absent | No | Cannot observe |
| Installed | Absent | No | Cannot observe |
| Enabled | `activatedAt` + free-text `status` | No supplier confirmation | `activatedAt` is internal, not supplier-reported |
| Expired | `expiresAt` + free-text `status` | No | No transition/observation job |
| Revoked | Absent for `esims` (`revokedAt` belongs to order access tokens) | No | Cannot represent |
| Unknown/unsupported | Free-text `status`; default only | No | No enum/CHECK constraint or mapping |
| Supplier-reported state | Absent | No | No `supplierState`/`observedAt` fields |
| Usage / remaining data | **Absent** | No | No usage table, units, remaining amount, freshness, or source |
| ICCID | `esims.iccid`, nullable text | No | Plaintext; sensitivity/format policy needed |
| Activation code / LPA | Encrypted in `lpaCiphertext`/`lpaIv`/`lpaTag` + wrapped DEK columns | No | Decrypted at render; no separate lifecycle metadata |
| QR payload | Generated at render with `QRCode.toDataURL(lpa)` | No | No dedicated payload/signature/format field |

Questions requiring supplier documentation or sandbox verification:

1. Which lifecycle states does the supplier actually expose (issued, downloaded, installed, enabled, expired, revoked)?
2. Is installation or activation observable, or only issued/expired?
3. What is the supplier’s state vocabulary, and how does it map to our free-text `status`?
4. Does the supplier provide a state-observation timestamp and timezone?
5. Is there a usage endpoint? What units (bytes/MB/GB), remaining amount, reset period, and freshness?
6. Is usage pushed by webhook or pulled by polling? What is the rate limit?
7. Does the supplier return ICCID? In what format, and is it stable?
8. What is the activation-code/LPA format, and can it be reissued?
9. What is the QR payload specification (raw LPA, SM-DP+ address, matching ID)?
10. Can a profile be revoked/replaced, and what evidence is returned?
11. Are top-ups/renewals supported, and do they create a new profile or mutate the existing one?
12. What refund/cancellation evidence does the supplier provide for a used vs unused profile?
13. What are the supplier’s webhook signature, timestamp, retry, and replay rules?
14. What PII/data-retention terms apply to ICCID, LPA, and usage data?

---

## 13. Full-site audit completion against the requested scope

| Area | Status | Evidence / reason |
|---|---|---|
| Full route inventory and runtime crawl | **VERIFIED WITH EVIDENCE** | 56 page routes (23 admin + 33 public), 3 API routes; admin and public crawls; 404 probe. |
| Internal link integrity | **VERIFIED WITH EVIDENCE (GET only)** | 129 unique internal links; 0 bad. JS-driven navigation not exercised. |
| Asset integrity | **VERIFIED WITH EVIDENCE (sample)** | 10 unique `/_next/` assets; 0 bad; `/icon.svg` 200; `/favicon.ico` 404. |
| Browser console errors / failed requests | **BLOCKED — PLAYWRIGHT/BROWSER TOOLING UNAVAILABLE** | No Playwright, Puppeteer, or Cypress installed. |
| Hydration issues | **NOT DONE** | Requires a browser. |
| Responsive layout at 375/768/1280 px | **BLOCKED — PLAYWRIGHT/BROWSER TOOLING UNAVAILABLE** | 12 CSS media queries exist, but no rendered viewport test. |
| Functional flows in demo/test mode | **PARTIALLY TESTED** | Route-level redirects and no-data states verified; cart/checkout/order mutations not executed. |
| Input validation and duplicate submissions | **PARTIALLY TESTED (source)** | Zod schemas exist; no browser/duplicate-submit tests. |
| Security headers | **VERIFIED WITH EVIDENCE** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, CSP `frame-ancestors/base-uri/form-action/object-src`. |
| Cookie flags | **VERIFIED WITH EVIDENCE (source)** | `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, expiry; `secure` tied to HTTPS `SITE_URL` (`lib/auth/session.ts:113-124`). |
| Open-redirect handling | **PARTIALLY TESTED (source)** | `safeNextPath` rejects non-`/`, `//`, backslashes, control chars (`lib/validation.ts:78-86`); no runtime login POST. |
| Rate limiting | **PARTIALLY TESTED (source)** | Login 10/15 min, 2FA 8/10 min, register 5/60 min, reset path also calls the helper; no runtime brute-force test. |
| Secret exposure checks | **PARTIALLY TESTED** | No credential markers/emails in crawled shells; source review of credential paths; no live secret scan. |
| Environment validation | **PARTIALLY TESTED (source)** | `assertProductionSafe` fails closed in production (`lib/config.ts:35-77`); no production environment to run. |
| Migration readiness | **FAIL** | Supplier tables missing; see F-01. |
| SEO metadata and canonical URLs | **PARTIALLY TESTED** | Titles/descriptions/OG/Twitter/robots/sitemap present; no canonical links; demo `Disallow: /`; 153/153 sitemap URLs 200. |
| Accessibility basics | **PARTIALLY TESTED (static)** | `lang="en"`, skip link, nav labels, `aria-*`, 13 `<label>` vs 16 inputs in auth forms; no axe/browser audit. |
| Bundle size and image optimization | **PARTIALLY TESTED** | Build succeeds; 15 JS chunk files totalling 744,965 B; no per-route first-load/budget analysis; no raw `<img>` tags; one `next/image` import. |
| Terms/privacy/cookie/refund/checkout policy consistency | **PARTIALLY TESTED (static)** | Demo disclaimers present in policies and checkout; no legal review or jurisdiction check. |
| Custom error pages and unknown routes | **PARTIALLY TESTED** | `app/error.tsx` and `app/not-found.tsx` exist; unknown route 404 verified; 500 page not forced. |
| Supplier capability/sandbox verification | **EXTERNAL BLOCKED / MOCK/DEMO ONLY** | No supplier selected; no docs/credentials/sandbox. |

> **Phase 2 update (2026-11-05):** migration readiness, canonical URLs, favicon, and authenticated functional-flow checks were re-verified; see section 0. Browser console/hydration, rendered responsive layouts, axe/accessibility, and a browser checkout flow remain **NOT DONE**. `/favicon.ico` now returns 200.

---

## 14. Contradictions in earlier reports

> **Phase 2 update:** test counts below are Phase 1 historical figures. Current authoritative count is **14 files / 116 tests**; see section 0.

| Earlier claim | Current evidence | Correction |
|---|---|---|
| “61/61 tests passed” | `npm test`: 10 files / 66 tests | Stale; current count is **66**. |
| “63 tests” | Same run: 66 | Stale/incomplete; the three integration guard tests are included. |
| “22 admin directories” / “19 directories listed” | 20 top-level dirs; 23 admin `page.tsx` files | Actual inventory is **20 dirs / 23 routes**. |
| “No security defects demonstrated” / “zero confirmed defects” | 13 findings, 4 High | **Withdrawn.** The earlier scope omitted authenticated tests, migrations, and real SSRF tests. |
| “Admin security verified” | Only anonymous and bogus-cookie access tested | Correct wording: **unauthenticated access control and invalid-session rejection verified locally**; authenticated admin/regular-user denial **NOT DONE**. |
| “Admin routes PASS (curl 200)” | Anonymous requests are 307; bogus cookie is 200 shell | A 200 shell is not authenticated success. Authenticated 200 is **NOT DONE**. |
| “Integration guard tests prove SSRF protection” | Tests import duplicated helpers (`tests/test-helpers.ts`) | Tests do **not** exercise production `ssrf-guard.ts`; see F-03/F-04. |
| “Connection form security PASS” | Form has no handler; no create/credential path | The form is non-functional; see F-02. |
| “Smoke: 7 checks, 1 BLOCKED” | 8 checks pass; 5 authenticated checks skipped; summary says BLOCKED: 0 | Smoke coverage/reporting is inaccurate; see F-12. |
| “18 MISSING items in the gap audit” | Current gap audit: 10 rows marked MISSING, 6 PARTIAL, 7 COMPLETE, 10 BLOCKED | **No 18-item MISSING list exists in the document.** The 18 figure matches the number of admin routes omitted from smoke coverage, not gap-audit rows. |
| “No migration applied; no DB content changed” | True for this audit, but no supplier migration exists | The absence of a migration is the defect; historical command execution remains **CANNOT CONFIRM**. |

### Missing features vs defects

The gap audit’s 10 MISSING rows (profile lifecycle, device compatibility, disputes, tax/invoicing, fraud controls, activation-access logging, supplier wallet, bulk actions, SEO CMS, language/RTL) are **feature gaps**, not automatically defects. They become defects only where implemented UI or documentation claims the capability exists, or where a security/financial requirement is violated.

This audit’s 13 findings are different: they are contradictions between implemented/claimed behaviour and actual behaviour, missing schema/migration paths, weak verification, or security-control gaps.

---

## 15. Work not attempted locally (Phase 1 historical record)

> **Phase 2 update (2026-11-05):** authenticated admin crawl, regular-user denial, Server Action authorization, migration checks, duplicate-refund approval, and API contract checks were completed locally. Browser console/hydration/responsive/accessibility checks, a browser end-to-end purchase flow, authorized job execution, production environment/DB/backup/domain verification, and legal/tax review remain outstanding. See section 0.

- Creating a legitimate admin session or regular-user session.
- HTTP authenticated admin crawl (expected 200 content on all 23 routes).
- Regular-user denial at route and action level.
- Server Action execution with admin/regular/expired sessions and side-effect snapshots.
- Browser console, hydration, failed-request, responsive (375/768/1280), and accessibility (axe) checks.
- End-to-end cart → checkout → order → activation flow (would mutate demo data).
- Duplicate-submit and concurrent refund execution.
- Valid signed webhook replay and authorized job execution (would mutate data).
- Production environment validation, production DB migration, backup/restore, domain/HTTPS.
- Legal, tax, and jurisdiction review.

These are **NOT DONE** because they were not attempted or require a browser/tooling, not because a third party blocks them. Exceptions are listed as **EXTERNAL BLOCKED** below.

---

## 16. External blockers

1. Supplier selection, contract, official API documentation, sandbox URL, and test credentials.
2. Supplier webhook event/signature/retry contract.
3. Payment provider credentials and live/sandbox webhook verification.
4. SMTP/email provider credentials and domain authentication.
5. Production domain, DNS, HTTPS certificate.
6. Managed PostgreSQL production instance.
7. Legal/tax review for target jurisdictions.
8. Backup/monitoring service authorization.

No live supplier, payment, email, or production integration was activated or tested.

---

## 17. Top 10 Phase 1 findings (historical)

> All findings below were locally remediated in Phase 2; see section 0 for final status and evidence.

1. **F-01 High** — Supplier tables have no migration; both fresh and current local DBs lack them.
2. **F-02 High** — Connection creation/credential persistence is non-functional; the form has no handler.
3. **F-03 High** — Guard tests validate duplicated helpers and function exports, not production authorization/SSRF.
4. **F-04 High (latent)** — SSRF validator allows metadata/IPv6/userinfo cases; no DNS/redirect/timeout controls.
5. **F-05 Medium** — Finance role has `refunds.write` but cannot approve refunds; `requirePermission` is unused.
6. **F-06 Medium** — Refund approval is non-atomic and not idempotent.
7. **F-07 Medium** — Refund approval writes duplicate audit records, one without actor identity.
8. **F-08 Medium** — Integration capability display is hardcoded empty.
9. **F-11 Medium** — Credential encryption has no AAD binding and implicitly shares the activation KEK.
10. **F-12 Low / F-09 Low / F-10 Low / F-13 Low** — Smoke coverage/reporting, dead integration links, overstated security copy, SEO/favicon gaps.

---

## 18. Go/no-go recommendation

**NO-GO for live supplier integration or production launch.**

> **Phase 2 update (2026-11-05):** the local remediation sequence below was completed for F-01–F-13 and additional defects N-01–N-06. The local remediation gate passed. Production/live remains NO-GO because external onboarding, production infrastructure, browser/accessibility testing, backup/restore, legal review, and N-07 transport controls remain outstanding. See section 0.

**Conditional GO for Phase 2 remediation after explicit approval**, with this order:

1. Add and test the supplier-table migration (F-01).
2. Implement or remove the connection form; add credential encryption, audit, and redaction tests (F-02, F-11).
3. Replace duplicated guard tests with production-code tests; add session-backed admin/regular-user and Server Action tests (F-03; labels `AUTHENTICATED_ADMIN_ACCESS_VERIFIED`, `REGULAR_USER_DENIAL_VERIFIED`, `SERVER_ACTION_AUTHORIZATION_VERIFIED`).
4. Harden SSRF validation before any adapter HTTP path exists (F-04).
5. Decide and enforce refund role policy; make approval atomic/idempotent; fix audit duplication (F-05, F-06, F-07).
6. Render real capabilities or remove the column; fix dead links and security copy (F-08, F-09, F-10).
7. Expand smoke coverage and fix blocked counting (F-12).
8. Add browser/responsive/accessibility checks and canonical/favicon fixes (F-13).
9. Only then start supplier sandbox onboarding with the Decision 1–3 evidence.

No production-readiness or comprehensive-security claim is made. The local build is healthy; the verification and integration layers are not complete.

---

## Appendix A — Earlier Supplier Connect claims, retained and corrected

The previous version of this report concluded:

> “No security defects demonstrated. All inspected implementation files pass structural review; no authorization bypass, no secret exposure, no hardcoded supplier endpoint, no fabricated verification results.”

That conclusion is **superseded**. It was based on structural inspection without:
- an authenticated admin session,
- a regular-user denial test,
- a migration/DB readiness check,
- execution of the production SSRF validator,
- verification that the guard tests import production code.

The parts that remain true: both integration pages call `requireAdmin()`; no credential is rendered to the client; no supplier endpoint is hardcoded; no fabricated supplier capability is claimed; the adapter contract is supplier-neutral; and no live integration was activated.

The parts that were wrong or incomplete: “no security defects” ignored the incomplete SSRF validator and dead credential path; “connection form security PASS” treated a non-functional form as secure; and “admin security verified” overstated anonymous-only evidence.

## Appendix B — Reproduction notes

- Runtime checks used a temporary Node script outside the repository; it was deleted after use.
- The server was started with `npm start`, crawled, then stopped; temporary server logs were removed.
- The local `.pglite` database was **copied** to a temp directory for read-only inspection. The original was not modified.
- No migration, seed, `db:push`, refund, payment, webhook, or supplier request was executed.
- Secrets, cookies, tokens, and key values are intentionally omitted.
