# Open Issues, Blockers, and Unresolved Defects — Phase 1 Reconciliation

Phase 1 audit date: 2026-11-04
Phase 2 local remediation date: 2026-11-05
Project: `C:\Users\hp\esimprove`
Phase 1 mode: **AUDIT ONLY** — documentation-only reconciliation; no application code, tests, schema, migrations, configuration, `.env.local`, or deployment settings were changed.
Phase 2 mode: **LOCAL REPAIR AND VERIFICATION** — application code, tests, and migrations were changed locally. No live supplier/payment/email/refund call, production database, deployment, secret, `.env.local`, or real customer data was changed. No commit, push, or deployment was performed.

Authoritative source: `ESIMPROVE_FULL_SITE_ERROR_AUDIT.md` (F-01–F-13) and `ESIMPROVE_TASK_VERIFICATION_REGISTER.md`.

## 0. Phase 2 local remediation addendum (2026-11-05)

> The Phase 1 sections below are preserved as the historical audit record. Where they conflict with this addendum, this addendum governs.

### 0.1 F-01–F-13 final status

| ID | Phase 1 finding | Phase 2 status | Evidence |
|---|---|---|---|
| **F-01** | Supplier tables had no migration. | **FIXED** | Added `db/migrations/0004_supplier_connect.sql` with both supplier tables, foreign keys, unique/index constraints. `tests/migrations.test.ts` passes 3/3 against isolated in-memory PGlite, including fresh migration, repeatability, and supplier-table checks. |
| **F-02** | Connection creation and credential persistence were not implemented. | **FIXED (LOCAL)** | Added authenticated `createSupplierConnectionAction` with schema validation, SSRF URL validation, AES-256-GCM credential encryption, audit logging, redaction, and a wired form. Regression test creates a connection, confirms `enabled=false`, decrypts only with the owning connection ID, and confirms plaintext is absent from the row and audit metadata. No supplier network call exists. |
| **F-03** | Guard tests exercised duplicate helpers, not production authorization/SSRF code. | **FIXED** | Deleted the unused `tests/test-helpers.ts` duplicate module and the export-only action test. Tests now import production `validateConnectionUrl`/`validateConnectionUrlWithDns`, and session-backed tests exercise production guards and actions with real database sessions. |
| **F-04** | SSRF validator was materially incomplete. | **FIXED FOR CURRENT SCOPE** | `lib/adapters/ssrf-guard.ts` now rejects IPv4/IPv6 private, loopback, link-local, ULA, metadata, documentation, multicast, mapped/compatible, reserved and numeric host variants; rejects userinfo, non-HTTP(S), and unexpected ports; adds asynchronous DNS resolution validation that fails closed. Regression matrix covers 28 unsafe destinations plus DNS answers. No outbound supplier HTTP client exists; see residual **N-07**. |
| **F-05** | Finance had `refunds.write` but runtime approval required admin. | **FIXED (POLICY)** | `finance` is now explicitly read-only (`orders.read`, `invoices.read`); refund execution is administrator-only. Role and session-backed denial tests cover customer and finance. Four-eyes finance approval remains a future feature, not a hidden permission. |
| **F-06** | Refund approval was non-atomic and not idempotent. | **FIXED** | `applyRefund` now runs in a transaction, claims the refund with `WHERE status='requested'`, conditionally updates the payment, caps cumulative approved refunds at the order total, and rolls back on conflict. Duplicate-approval and cumulative-overrun tests pass. |
| **F-07** | One approval wrote two audit rows, one unattributed. | **FIXED** | `applyRefund` writes the single authoritative `admin.refund.approve` audit row with the real actor ID, order, amount, and resulting payment status. The duplicate action-level audit was removed; test asserts exactly one approval audit. |
| **F-08** | Capability display was hardcoded empty. | **FIXED** | `listCapabilitiesForConnections` now queries `supplier_capabilities`; `/admin/integrations` renders real capability/status labels or “None verified” only when none exist. |
| **F-09** | Dead settings/test/sync links. | **FIXED** | Dead links were removed. The page states that settings, tests, and sync are not implemented rather than linking to nonexistent routes. |
| **F-10** | Security copy overstated controls. | **FIXED** | Copy now states that no supplier adapter/test/sync exists, URL validation happens before save, DNS validation applies when an outbound path is implemented, and credentials are encrypted and connection-bound. |
| **F-11** | Credential encryption lacked context binding and explicit key separation. | **FIXED (WITH LEGACY READ PATH)** | AES-256-GCM now supports AAD; supplier credentials are bound to `supplier-credential:v1:<connectionId>`. New rows set `aadVersion=1`; cross-record ciphertext substitution and tag tampering are rejected by test. Production requires `SUPPLIER_CREDENTIAL_KEK`; activation-KEK fallback requires explicit opt-in and is limited to non-production demo mode. Legacy unbound ciphertext remains readable by design. |
| **F-12** | Smoke coverage/reporting was incomplete. | **FIXED** | `scripts/smoke-test.mjs` covers public, dynamic, auth, admin, API, 404, and streaming-redirect cases; counts blocked checks; detects Next.js `NEXT_REDIRECT` markers. Final local runs: 55 PASS / 0 FAIL / 22 BLOCKED without a cookie; 77 PASS / 0 FAIL / 0 BLOCKED with a real administrator session. |
| **F-13** | Canonical/favicon/SEO gaps. | **FIXED** | Canonical alternates are present on public and dynamic metadata pages; FAQ robots are demo-aware; `/legal/faq` is in the sitemap; `app/favicon.ico` exists; `/favicon.ico` returns 200 in smoke. |

Severity counts remain **4 High, 5 Medium, 4 Low** for the Phase 1 findings. All 13 are locally remediated; none is claimed as live-integration or production verification.

### 0.2 Additional confirmed defects found during remediation

| ID | Severity | Area | Finding | Fix and evidence |
|---|---|---|---|---|
| **N-01** | **High** | Error handling / information disclosure | `app/error.tsx` rendered `error.message`; `/api/health`, `/api/jobs/run`, and `/api/webhooks/payments/mock` returned raw exception messages to clients. | Error boundary shows a generic message plus optional digest. APIs return generic errors and log only the error name server-side. Verified by source review and the API smoke cases (401/405/400). |
| **N-02** | **High** | Payment authorization (IDOR) | The mock payment page and success/failure actions authorized by payment ID alone; any holder of an ID could open or mutate another order’s payment. | Added `loadAuthorizedMockPayment` requiring order owner, admin/super_admin, or a valid order access token. Regression test covers anonymous, other-customer, finance, admin, owner, valid-token, invalid-token, and action-denial cases. |
| **N-03** | **High** | Order token minting | The mock success action minted a new order access token after payment, so a payment ID could be used to obtain order data access without proving ownership. | The order access token is now created during checkout and carried through the payment flow; payment actions no longer mint tokens. The action-level regression test confirms an unauthorized caller is redirected and the payment stays `pending`. |
| **N-04** | Medium | Role consistency | `super_admin` was not consistently treated as an administrator in login, 2FA landing, header links, order access, or portal order/eSIM views. | Replaced ad-hoc role checks with shared `isAdminRole`; role tests assert `super_admin` access and customer/finance denial. Static/admin runtime checks remain separate. |
| **N-05** | Medium | Refund financial integrity | Multiple requested/approved refunds could cumulatively exceed the captured order total. | `requestRefund` reserves the sum of `requested` + `approved` refunds and rejects overruns; `applyRefund` rechecks approved totals inside the transaction. Regression test covers a partial refund followed by an over-refund attempt and a valid remainder. |
| **N-06** | **Critical (latent)** | Whop webhook authentication | `validateWebhookSignature` returned `true` for any non-empty signature whenever a secret was configured. If wired live, forged payment webhooks would be accepted. | The verifier now **fails closed** because the official algorithm is unimplemented. Regression test asserts a configured secret and arbitrary signature still return `false`. Live Whop remains external blocked. |

### 0.3 Residual control requirement

| ID | Status | Requirement |
|---|---|---|
| **N-07** | **OPEN BY DESIGN** | No outbound supplier HTTP client exists. Before adding one, the implementation must call `validateConnectionUrlWithDns` immediately before connecting, bind the request to the validated resolved address (or revalidate), disable automatic redirects, enforce connect/read timeouts and a response-size limit, and keep errors/logs sanitized. This is a forward requirement, not an exploitable path in the current demo. |

### 0.4 Phase 2 verification snapshot

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS — exit 0, no output. |
| `npm run lint` | PASS — 0 errors, 0 warnings. |
| `npm test` | PASS — 14 files, **116 tests**, 0 failed, 0 skipped. |
| `npm run build` | PASS — production build completed; middleware proxy present. |
| Migration test | PASS — `tests/migrations.test.ts` 3/3 in isolated in-memory PGlite. |
| Unauthenticated smoke | PASS — **55 PASS / 0 FAIL / 22 BLOCKED** (blocked = authenticated admin checks with no cookie). |
| Authenticated admin smoke | PASS — **77 PASS / 0 FAIL / 0 BLOCKED** with a real app-created admin session. |
| Role runtime checks | PASS — admin `/admin` 200; customer/finance `/portal` 200; customer/finance `/admin` and `/admin/refunds` 307 → `/portal`; anonymous `/admin` 307 → `/login`. |
| Live supplier/payment/email/refund | **EXTERNAL BLOCKED** — no credentials, contracts, sandbox, or provider calls. |
| Browser/E2E/accessibility | **NOT DONE** — no browser automation available; visual/responsive/a11y verification incomplete. |

### 0.5 Updated go/no-go

**Production/live launch: NO-GO.** External supplier/payment/email/legal/deployment gates remain blocked, and browser/accessibility verification is incomplete.

**Local remediation gate: PASSED** for the audited code, tests, migrations, authorization, smoke, and build scope above. This is not a production-readiness or comprehensive-security claim.


Status labels used below:

| Label | Meaning |
|---|---|
| **CONFIRMED DEFECT (FAIL)** | Reproduced or established by source plus local evidence. |
| **LOCAL NOT DONE** | Locally testable work that was not performed. Not an external blocker. |
| **EXTERNAL BLOCKED** | A genuine third-party dependency prevents the check. |
| **MOCK/DEMO ONLY** | Evidence depends on mocks, fixtures, seeded demo data, or disabled live adapters. |
| **CANNOT CONFIRM** | No reliable evidence exists either way; this is not a pass. |
| **NOT APPLICABLE** | Not required for this deployment. |

---

## 1. Confirmed defects (F-01–F-13)

| ID | Severity | Area | Finding | Evidence | Impact | Required action |
|---|---|---|---|---|---|---|
| **F-01** | **High** | Database/migrations | Supplier tables have no migration. | Fresh in-memory migrations 0001–0003 created 43 public tables; `supplier_connections` and `supplier_capabilities` were absent; a query failed with `relation "supplier_connections" does not exist`. A read-only copy of the local `.pglite` DB had 44 tables, migrations 0001–0003 applied, and the same missing tables. | A legitimate admin visiting `/admin/integrations` would query a missing relation; an HTTP 500 is inferred but was not executed with a real session. Deployment to an empty DB would fail at runtime on `/admin/integrations`. | Add `db/migrations/0004_supplier_connect.sql` matching the Drizzle schema; test on an empty disposable DB; add a schema/migration consistency test. |
| **F-02** | **High** | Supplier Connect | Connection creation and credential persistence are not implemented. | `/admin/integrations/new` renders `<form method="POST" action="/admin/integrations">`; there is no route handler or Server Action at that path. `connection-store.ts` has no create/upsert. A repository search found zero writes to `credentialEncrypted`; `encryptSupplierCredential`/`decryptSupplierCredential` have no callers. | The UI cannot create a connection or store a credential. It is demo UI only. | Implement an authenticated create action with validation, encryption, audit, and redaction; or remove the form/UI until it exists. Add tests. |
| **F-03** | **High** | Test integrity | Guard tests do not test production authorization/SSRF code. | `tests/integrations-auth-guard.test.ts:2` imports `assertPrivateIpBlocked`, `assertUrlSafe`, and `assertUrlNotLocalhost` from `./test-helpers`. `tests/test-helpers.ts:17-27` reimplements a private-IP regex and does not import `lib/adapters/ssrf-guard.ts`. `tests/auth-guard.test.ts:5-14` only asserts that `requireAdmin` is a function and that an action module can be imported. All five tests pass. | The passing suite creates false assurance about SSRF and Server Action authorization; this directly supported the earlier overclaim. | Delete duplicated helper logic; test production functions directly; add session-backed action/route tests; rename tests to match what they prove. |
| **F-04** | **High (latent)** | SSRF | Production validator is materially incomplete. | 16-case matrix against `validateConnectionUrl`: 9 blocked, 7 allowed. Allowed unsafe cases: `http://169.254.169.254`, `http://[::1]`, `http://[::ffff:127.0.0.1]`, `http://[fd00::1]`, `http://[fe80::1]`, and `https://user:pass@example.com/path`. No DNS resolution/rebinding check, redirect policy, timeout, or response-size limit. No outbound HTTP path currently exists. | Latent SSRF bypass once a connection-test or adapter HTTP path is implemented. Not currently exploitable through the application. | Use a maintained SSRF-safe URL/DNS library or resolve and validate all A/AAAA records; block all non-public ranges; reject userinfo; enforce redirect/timeout/size limits before adding HTTP. |
| **F-05** | Medium | Refund authorization | Finance role cannot use its refund permission. | `lib/auth/roles.ts:48` grants `finance` the `refunds.write` permission. `app/admin/actions.ts:138` calls `requireAdmin()` with no permission argument; `requireAdmin` allows only `admin`/`super_admin`. `requirePermission` has no callers outside its definition. | Role model and runtime authorization disagree; a future Finance refund UI would be denied. | Decide whether Finance may approve refunds. If yes, enforce `requirePermission(..., "refunds.write")`; if no, remove the permission and document admin-only policy. Add role tests. |
| **F-06** | Medium | Refund integrity | Approval is non-atomic and not idempotent. | `approveRefundAction` checks `status !== "requested"`, then `applyRefund` re-reads and re-checks, but updates are unconditional. No transaction, no `WHERE status = 'requested'` conditional update, no idempotency key. Concurrent approvals were not runtime-reproduced. | Two concurrent approvals could both pass the check and both update payment/order, insert events, and write audit records. No real money moves because no provider refund call exists. | Wrap the transition in a transaction; use a conditional update with `RETURNING`; add an idempotency key; test concurrent approvals. |
| **F-07** | Medium | Audit trail | One refund approval writes two audit records, one without actor identity. | `applyRefund` writes `action: "refund.approved"` with `actorType: "admin"` and no `actorId` (`lib/refunds.ts:146-152`). `approveRefundAction` writes `action: "admin.refund.approve"` with the real `actorId` (`app/admin/actions.ts:149-156`). | The audit trail is duplicated and one record cannot be attributed to a specific admin. | Write one authoritative audit event with actor, amount, order, and refund ID. Remove the duplicate. |
| **F-08** | Medium | Supplier Connect UI | Capability display is hardcoded empty. | `app/admin/integrations/page.tsx:16-21` assigns `verifiedCapabilities[conn.id] = []` for every connection. `supplierCapabilities` is imported but never queried (also a lint warning). The page renders “None verified” for every row. | Even if capability rows existed, the operator would see none. The UI is misleading. | Query/join `supplier_capabilities` and render real statuses; add a test. |
| **F-09** | Low | Supplier Connect UI | Dead integration links. | `app/admin/integrations/page.tsx:71-73` links to `/admin/integrations/${conn.id}`, `/test`, and `/sync`. Only `app/admin/integrations` and `app/admin/integrations/new` exist. | Those URLs would 404 once a connection row exists. | Add the settings/test/sync routes or remove/disable the links. |
| **F-10** | Low | Documentation/UI accuracy | Integration security copy overstates implemented controls. | `app/admin/integrations/page.tsx:38-39` claims connection tests include SSRF protection, bounded timeouts, and sanitized logging. `app/admin/integrations/new/page.tsx:50` claims credentials are encrypted at rest using a KEK. No connection test, timeout, outbound request, or credential write path exists. | The UI describes controls that are not implemented. | Correct the copy now; restore it only when the controls exist. |
| **F-11** | Medium | Encryption design | No AAD/context binding; key separation is implicit. | AES-256-GCM is used without AAD in `lib/crypto.ts:22-43`. `getSupplierCredentialKey` prefers `SUPPLIER_CREDENTIAL_KEK` but falls back unconditionally to `activationKek()` despite a comment saying “only if explicitly allowed.” Source inspection shows the decrypt API takes no connection identifier/AAD; a local roundtrip passed. Direct cross-record substitution was not separately executed. | Ciphertext substitution between records would not be detected cryptographically. The helpers are currently unused, so there is no stored credential to attack. | Add AAD (`connectionId`, purpose, key version); require a dedicated key or an explicit fallback flag; document rotation. |
| **F-12** | Low | Verification tooling | Smoke test coverage and reporting are incomplete. | `scripts/smoke-test.mjs:59` and `:70` cover only five admin routes. Without `SMOKE_AUTH_COOKIE`, five authenticated checks are skipped; the script prints `[BLOCKED]` but does not push blocked results (`:80-82`), so the summary reports `BLOCKED: 0`. 18 of 23 admin routes are not covered, including both integration routes. | The smoke summary can be read as fully successful even though authenticated coverage was skipped. | Expand the route list from the build manifest or a maintained list; count skipped checks as BLOCKED; include integrations. |
| **F-13** | Low | SEO/assets | Canonical/favicon gaps in the current demo state. | `app/layout.tsx:23-46` defines `metadataBase`, OpenGraph, and Twitter metadata but no `alternates.canonical`; no page exports a canonical URL. `app/robots.ts:7-12` returns `Disallow: /` when `demoMode` is true, while `app/sitemap.ts` advertises 153 URLs. `/favicon.ico` returns 404; `/icon.svg` returns 200. | Search/canonical signals are incomplete; the conventional favicon path is missing. | Add canonical alternates; add `app/favicon.ico` or accept `/icon.svg`; verify robots with production env (`DEMO_MODE=false`). |

Severity counts: **4 High, 5 Medium, 4 Low**.

### High-severity notes

1. **F-01 is the first blocker.** The application cannot create its declared supplier schema from migrations. A production build succeeds, but `/admin/integrations` would fail at runtime once a legitimate admin session reaches `listConnections()`.
2. **F-02 means the Supplier Connect UI is not a working feature.** The form has no handler and no credential is ever written. This is not a “security pass”; it is an unimplemented flow.
3. **F-03 invalidates the earlier guard-test assurance.** The passing tests exercise local duplicate helpers and function imports, not production authorization or SSRF code.
4. **F-04 is latent, not currently exploitable.** No outbound HTTP path exists yet. It must be fixed before any adapter/connection test makes a network request.

---

## 2. Local NOT DONE (Phase 1 historical record)

> **Phase 2 update:** the locally feasible items below were executed or superseded on 2026-11-05. See section 0.4 for the completed verification snapshot. Remaining items are browser/accessibility/visual checks, a full cart→checkout→order→fulfilment browser flow, backup/restore, and production-environment validation.

| Item | Required label | Why it was not done in Phase 1 | Local unblock |
|---|---|---|---|
| Authenticated admin HTTP verification | `AUTHENTICATED_ADMIN_ACCESS_VERIFIED` | No legitimate admin session was created; no authenticated crawl of the 23 admin routes was run. | Create a disposable file-based PGlite DB, seed a test admin, call `createSession()`, start the built server on a non-default port with that DB, send the real cookie, then delete the DB directory. |
| Regular-user denial | `REGULAR_USER_DENIAL_VERIFIED` | No regular-user session was created; admin route/action denial was not exercised. | Seed a regular user; create a session; verify admin routes redirect to `/portal` and admin actions reject before mutation. |
| Server Action authorization | `SERVER_ACTION_AUTHORIZATION_VERIFIED` | Only static ordering was reviewed. No action was invoked with admin, regular-user, expired, or missing sessions; no side-effect snapshots were taken. | Mock `next/headers` `cookies()`; invoke each action with `FormData`; capture `NEXT_REDIRECT`; assert row counts, audit rows, and external-call counts are unchanged for unauthorized callers. |
| Authenticated portal/order/eSIM pages | — | Anonymous and bogus-cookie responses were checked; no real customer/order/eSIM data was opened. | Use seeded/disposable order and eSIM records; verify owner, token, and admin access paths. |
| End-to-end cart → checkout → order → fulfilment | — | Route-level responses were checked; no full flow was executed. | Run against disposable demo data; snapshot/cleanup afterwards. |
| Concurrent refund approval race | — | Source shows check-then-act; no concurrent requests were executed. | Add a deterministic concurrency test or two parallel service calls against a disposable DB; assert one transition/one audit record. |
| Authorized `/api/jobs/run` execution | — | Unauthorized requests returned 401/401; the authorized path was not run because it mutates jobs. | Use disposable DB and a scoped test secret; snapshot job/outbox state. |
| Migration/schema consistency test | — | No test compares `lib/db/schema.ts` tables to migrated tables. | Add a test that migrates an empty DB and compares expected public tables/columns. |
| Authenticated `/admin/integrations` HTTP status | — | Missing supplier tables make a 500 likely, but no legitimate session was used. | After F-01 fix or with the current DB, create an admin session and request the route; record status and body. |
| Browser console/hydration/failed-request checks | — | No Playwright, Puppeteer, or Cypress is installed. | Add a browser test tool or run a manual browser session; capture console/network. |
| Responsive layout at 375/768/1280 px | — | 12 CSS media queries exist, but no rendered viewport test was run. | Use browser tooling or manual screenshots at the three widths. |
| Accessibility (axe/keyboard/screen-reader basics) | — | Static checks found labels/`lang`/skip link, but no automated or manual accessibility audit. | Add axe or manual keyboard/screen-reader checks. |
| Production environment validation | — | Only local/test config was reviewed; no production env exists. | Run `assertProductionSafe` against a staging configuration; verify fail-closed cases. |
| Backup/restore verification | — | No backup procedure or restore test exists. | Define backup policy; restore a disposable copy and verify. |

These are **NOT DONE**, not `EXTERNAL BLOCKED`. They can be executed locally with disposable data and should not be deferred to a supplier or production environment.

---

## 3. MOCK/DEMO ONLY

The following evidence must not be described as live integration, production verification, or supplier verification.

- **Supplier adapter:** mock and disabled adapters only; all 18 capabilities are `unknown`; no supplier selected, no official docs, sandbox URL, credentials, or webhook contract.
- **Supplier Connect:** connection metadata and encrypted credential persistence are implemented and locally tested; no supplier adapter, connection test, catalogue sync, or outbound supplier request exists. **F-02 and F-11 are locally fixed; supplier traffic remains MOCK/DEMO ONLY.**
- **Payment:** mock payment provider and mock webhook; signed mock tests cover replay/idempotency. No live Whop checkout or webhook.
- **Whop adapter:** structure exists; no `WHOP_COMPANY_API_KEY`/`WHOP_WEBHOOK_SECRET`, no account eligibility, no sandbox verification (**P4-14**).
- **Email:** mock/disabled transport; no SMTP provider or domain authentication.
- **Catalogue sync:** mock/disabled adapters; no live supplier catalogue, price, or availability sync.
- **Fulfilment/eSIM:** mock supplier provisions demo eSIMs; LPA/QR content is demo data; no live activation, usage, top-up, renewal, cancellation, or refund call.
- **Refunds:** service-level and action-level mock flow only; `applyRefund` never calls a payment/supplier provider, so no real money moves. Tests cover action-level denial, duplicate approval, cumulative overrun prevention, and a single attributable audit row. Provider refund behaviour is **EXTERNAL BLOCKED**.
- **Tests:** DB tests use `memory://` PGlite with seeded demo data; session-backed action tests inject a disposable memory handle through the global database promise. Persistent `.pglite` is not used by tests.
- **Local runtime:** `.env.local` targets local PGlite (`PGLITE_DATA_DIR`), and **no `DATABASE_URL` key is present in `.env.local`**; no remote/production database is configured.
- **Smoke:** Phase 2 final runs: 55 PASS / 0 FAIL / 22 BLOCKED without a cookie; 77 PASS / 0 FAIL / 0 BLOCKED with a real administrator session. Blocked authenticated checks are counted explicitly.
- **Historical smoke log:** `smoke-test.log` shows four admin routes returning 200. The authentication context, freshness, and test data are **CANNOT CONFIRM**; this log is not authoritative.

---

## 4. EXTERNAL BLOCKED

1. Supplier selection, contract, official API documentation, sandbox base URL, test credentials, and credential-rotation policy.
2. Supplier webhook event types, payload schemas, signature algorithm, timestamp/replay rules, retry policy, and rate limits.
3. Payment provider credentials and live/sandbox webhook verification.
4. Whop account approval, `WHOP_COMPANY_API_KEY`, `WHOP_WEBHOOK_SECRET`, and sandbox eligibility.
5. SMTP/email provider credentials and sender-domain authentication.
6. Production domain, DNS, HTTPS certificate, and production environment validation.
7. Managed PostgreSQL production instance and connection.
8. Legal/tax review for target jurisdictions, including refunds, privacy, cookies, and tax display.
9. Backup, monitoring, and alert-delivery service authorization.
10. Supplier data-retention, PII, sub-processor, and egress/IP-allowlist terms.

No live supplier, payment, email, production database, or deployment integration was activated or tested.

---

## 5. CANNOT CONFIRM

| Item | Why it cannot be confirmed |
|---|---|
| Historical `db:push`/migrate/seed command execution | No logs or shell history establish what was run. The current absence of a supplier migration is a confirmed defect regardless. |
| Historical `scripts/smoke-test-production.ps1` authenticated result | `smoke-test.log` shows four 200 responses, but the cookie/session context, date, and test data are not recorded. |
| Production error-boundary message exposure | **Resolved in code 2026-11-05.** `app/error.tsx` no longer renders `error.message`; APIs return generic errors. Production sanitization was not separately exercised. |
| DNS rebinding / redirect SSRF exploit | **Partially resolved.** DNS answers are validated and unsafe ranges are blocked; no outbound HTTP path exists, so redirect/timeout/size controls remain a forward requirement (**N-07**). No exploit was demonstrated. |
| Concurrent refund approval actually duplicates records | **Duplicate approval is rejected by a conditional claim and regression test.** A true simultaneous multi-process race was not stress-tested; PGlite tests run in one process. |
| Authenticated `/admin/integrations` returns HTTP 500 | **Resolved.** Authenticated admin smoke returned 200 for `/admin/integrations` and `/admin/integrations/new`. |
| Real supplier/payment/email behaviour | No credentials, sandbox, or provider contract. |
| Production environment validation | No production/staging environment was available. |
| Production backup/restore | No backup exists and no restore was attempted. |

---

## 6. Corrections to earlier claims

| Earlier claim | Current evidence | Correction |
|---|---|---|
| “FAIL D1 (monitoring/seo/help) RESOLVED” | All three routes are registered and return 307 anonymously; no 404/500 after fresh build/restart. Authenticated content was not opened. | Route registration and anonymous protection are resolved. **Authenticated admin content remains NOT DONE.** |
| “`DATABASE_URL` points to local/test” | `.env.local` has no `DATABASE_URL`; local runtime uses `PGLITE_DATA_DIR`. | Correction: local runtime targets PGlite. A production database is not configured, but the old statement was inaccurate. |
| “Admin security verified” | Only `UNAUTHENTICATED_ACCESS_CONTROL_VERIFIED` and `INVALID_SESSION_REJECTION_VERIFIED` were demonstrated. | Correct wording: **unauthenticated access control and invalid-session rejection verified locally**; authenticated admin, regular-user denial, and Server Action authorization are **NOT DONE**. |
| “No security defects demonstrated” / “zero confirmed defects” | 13 confirmed findings, including four High. | **Withdrawn.** The earlier scope omitted authenticated tests, migration readiness, and production SSRF tests. |
| “P2-04 Refunds PASS” | F-05/F-06/F-07 confirmed. | **FAIL** for authorization/integrity; no provider refund and no action-level runtime test. |
| “Smoke: 7 checks pass, 1 BLOCKED” | 8/8 public/unauthenticated pass; 5 authenticated checks skipped; summary says `BLOCKED: 0`. | Correct result: 8 pass, 0 fail, 0 reported blocked, with an **F-12** reporting bug. |
| “18 MISSING items in the gap audit” | Current gap audit has **10** rows marked MISSING, 6 PARTIAL, 7 COMPLETE, 10 BLOCKED. | No 18-item MISSING list exists. The 18 figure matches admin routes omitted from smoke coverage, not gap-audit rows. |
| “Connection form security PASS” | Form posts to `/admin/integrations` with no handler; no create/credential path. | **F-02**; the form is non-functional. |
| “Integration guard tests prove SSRF protection” | Tests import duplicated helpers from `tests/test-helpers.ts`. | Tests do **not** exercise production `ssrf-guard.ts`; **F-03/F-04**. |
| `61/61` or `63 tests` | `npm test`: 10 files, 66 tests. | **66** is the current authoritative count. |

---

## 7. Unblock sequence (Phase 2, only after explicit approval)

### Local remediation first

1. **Add the supplier migration (F-01).** Create `db/migrations/0004_supplier_connect.sql` for `supplier_connections` and `supplier_capabilities`, including indexes/foreign keys; test against an empty disposable DB; add a schema/migration consistency test.
2. **Implement or remove the connection flow (F-02, F-11).** Add an authenticated create action with input validation, SSRF-safe URL validation, encryption with AAD, audit record, and redaction. Add tests for validation, encryption, audit, and authorization. If not implementing now, remove the form and misleading copy.
3. **Replace weak tests (F-03).** Delete duplicate SSRF helpers; test `validateConnectionUrl` directly. Add session-backed tests for `AUTHENTICATED_ADMIN_ACCESS_VERIFIED`, `REGULAR_USER_DENIAL_VERIFIED`, and `SERVER_ACTION_AUTHORIZATION_VERIFIED`, including side-effect snapshots.
4. **Harden SSRF before any outbound HTTP (F-04).** Block metadata/link-local/ULA/IPv4-mapped IPv6/userinfo; resolve and validate all addresses; define redirect/timeout/response-size limits.
5. **Fix refund policy and integrity (F-05, F-06, F-07).** Decide Finance permissions; use one transaction/conditional transition/idempotency key; write one attributable audit record; add concurrency tests.
6. **Fix Supplier Connect UI (F-08, F-09, F-10).** Render real capabilities or remove the column; add or remove dead links; correct security copy.
7. **Fix smoke coverage/reporting (F-12).** Cover all admin routes (or derive them from the build manifest); count skipped authenticated checks as BLOCKED; keep the auth cookie opt-in.
8. **Add browser/SEO checks (F-13).** Add canonical URLs, favicon, responsive/accessibility checks, and production `robots` verification.
9. **Re-run the full gate.** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run smoke`; update all three audit documents with the new evidence.

### External onboarding only after local gates pass

10. Supplier contract/docs/sandbox/credentials/webhooks → sandbox verification → production verification.
11. Payment/email provider sandbox/live verification.
12. Production database, domain/DNS/HTTPS, backup/restore, monitoring.
13. Legal/tax/privacy review for target jurisdictions.

F-01–F-04 are locally remediated. Do not begin live supplier integration until the external contract/sandbox evidence exists and the N-07 outbound transport controls are implemented and tested.

---

## 8. Go/no-go

**NO-GO for live supplier integration or production launch.** External supplier, payment, email, legal/tax, production database, domain/HTTPS, backup, monitoring, and deployment gates remain blocked. Browser, responsive, and accessibility verification also remains incomplete.

**Local remediation gate: PASSED** for the audited application scope on 2026-11-05: migration, supplier-connection storage, SSRF validation, refund integrity, authorization, error redaction, webhook fail-closed behaviour, SEO assets, build, tests, and smoke. This is not a production-readiness or comprehensive-security claim.

No application code, tests, schema, migrations, `.env.local`, or deployment settings were changed in Phase 1. Phase 2 changed local application code, tests, and migrations only. No secrets, cookies, session tokens, or key values are included in this report.
