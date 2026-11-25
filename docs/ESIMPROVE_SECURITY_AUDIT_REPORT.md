# ESIMPROVE Security Audit Report

**Audit date:** 24 November 2026  
**Target:** `https://esimprove.netlify.app`  
**Deployed commit:** `f52e25ea32df45b7eecd77168b994f2891b0805f` (short: `f52e25e`)  
**Repository:** `teachermike2026-ship-it/esimprove`, branch `main`  
**Audit type:** Read-only backend security audit (static analysis, configuration review, read-only database inspection, build-artifact inspection, dependency audit)  
**Audit verdict:** **MODERATE RISK**

---

## A. Executive Summary

ESIMPROVE has a substantially better security baseline than a typical early-stage e-commerce deployment. The review found no unauthenticated administrative action, no SQL injection sink, no client-controlled price path, no webhook-forgery path, no confirmed IDOR on orders/eSIMs/support tickets, no secrets in the deployed build output, and no known dependency vulnerabilities.

Seven code-level weaknesses were confirmed, three conditional weaknesses were identified, sixteen suspected issues were dispositioned as false positives, and ten hardening recommendations were recorded. No **critical** or **high-severity, directly exploitable application vulnerability** was confirmed.

The two most important application findings are:

1. **Password-reset token consumption is not atomic** (`AUTH-01`, Medium). A token can pass the “unused” pre-check in two concurrent requests, and the subsequent update is unconditional. The correct conditional-claim pattern already exists in the email-verification flow, which makes this a clear implementation inconsistency.
2. **Support and finance staff roles bypass TOTP at login** (`AUTH-03`, Medium, latent). The TOTP gate is tied to `isAdminRole`, while `requireStaff` does not enforce TOTP. Production currently has one administrator and no support/finance accounts, so this is latent rather than presently exploitable.

Other notable findings:

- **TOTP codes can be replayed within the ±1-step window** because no last-used timestep is stored (`AUTH-02`, Low).
- **The Whop webhook reads an unbounded body before signature verification** (`WEB-01`, Low). The codebase already has a bounded-body helper used by other public routes.
- **Anonymous contact-form submissions can be linked to an existing account by unverified email address** (`DATA-01`, Low).
- **Checkout idempotency keys are global and mint a fresh order access token without cart/user binding** (`PAY-01`, Low; exploitation requires knowledge of an unguessable UUID).
- **GA4’s global loader can send order/reset tokens in query strings to Google if GA4 is enabled** (`ANL-01`, Medium conditional). GA4 is not configured today (`seo_settings` has zero rows).
- **Session TTL environment variables are not validated** (`CFG-01`, Low; operator misconfiguration risk).

Current production exposure is reduced by several controls: the site is behind Netlify Edge Access, the only production account is an administrator with TOTP enabled, there are zero active sessions, GA4 is unconfigured, live email is disabled, mock commerce is disabled in production, and no orders/payments were created during this audit.

One **operational credential risk** remains outside the application code: an active Netlify access token referenced in the engagement hand-off had previously been exposed and was not rotated because credential rotation was explicitly out of scope. If that token has deploy or environment-variable write scope, and if it was exposed beyond the owner, it could enable arbitrary deployment or secret disclosure. This is recorded as `OPS-01` (High priority, Informational Recommendation in the application-finding taxonomy). If the exposure audience is uncertain, treat the overall operational risk as **HIGH** until the token is rotated and Netlify audit logs are reviewed.

### Finding counts

| Classification | Count |
|---|---:|
| CONFIRMED VULNERABILITY | 7 |
| POTENTIAL VULNERABILITY | 3 |
| FALSE POSITIVE | 16 |
| INFORMATIONAL RECOMMENDATION | 10 |

---

## B. Scope and Objectives

### In scope

- The exact deployed commit `f52e25ea32df45b7eecd77168b994f2891b0805f`.
- Authentication, session management, password reset, email verification, TOTP, and registration.
- Authorization for admin, staff, portal, order, eSIM, support, and payment surfaces.
- All six API route handlers.
- All server-action modules, including checkout, contact, privacy, portal, auth, and admin actions.
- Checkout pricing, idempotency, payment state transitions, refunds, and webhook handling.
- Database schema constraints and indexes relevant to security.
- Configuration and deployment safety controls.
- Security headers and browser protections.
- Secrets handling and build-artifact exposure.
- Dependency and supply-chain posture.
- Privacy, logging, analytics, and sensitive-token handling.

### Out of scope

- Exploitation of the live production system.
- Denial-of-service testing, load testing, or fuzzing against production.
- Social engineering, phishing, or physical security.
- Netlify platform internals, TLS termination internals, and DNS provider controls.
- Third-party provider internals (Whop, Resend, Google Analytics).
- Credential rotation, deployment, source changes, dependency changes, database writes, migrations, seeds, or production setting changes.
- A production build or local production-mode execution.

### Objectives

1. Determine whether the deployed code contains exploitable authentication, authorization, injection, payment, or data-exposure weaknesses.
2. Separate confirmed code defects from theoretical concerns and false positives.
3. Provide exact file/function/line evidence and practical remediation.
4. Deliver a defensible overall risk verdict without modifying the system under review.

---

## C. Methodology and Evidence Handling

### 1. Repository and commit verification

- The deployed Netlify deploy was identified as commit `f52e25ea32df45b7eecd77168b994f2891b0805f`.
- An isolated clone was created at `C:\Users\hp\AppData\Local\Temp\opencode\esimprove-final-ce8f328-20261123`.
- `git rev-parse HEAD` returned the exact deployed SHA.
- `git status --porcelain` returned clean output before and after review.
- The clone contains 368 tracked files and 15 commits.
- The primary project at `C:\Users\hp\esimprove` was not modified except for the two report files in `docs/`.

### 2. Static review coverage

The review covered, at minimum:

- **6 API routes:** `/api/health`, `/api/track`, `/api/consent`, `/api/jobs/run`, `/api/webhooks/whop`, `/api/webhooks/payments/mock`.
- **13 server-action modules:** auth, checkout, cart, contact, privacy, portal orders, portal profile, portal support, admin, and related action files.
- **Authentication core:** `lib/auth/actions.ts`, `session.ts`, `guards.ts`, `roles.ts`, `password.ts`, `totp.ts`, `admin-access.ts`.
- **Authorization surfaces:** all `app/admin/**/page.tsx` guards, `app/admin/layout.tsx`, all portal pages, order/eSIM pages, support pages, and admin actions.
- **Payment and checkout:** `lib/checkout.ts`, `lib/payments.ts`, `lib/refunds.ts`, `lib/integrations/payment/whop.ts`, `app/checkout/**`, `app/api/webhooks/**`.
- **Database:** `lib/db/schema.ts`, `lib/db/client.ts`, `lib/rate-limit.ts`, `lib/orders.ts`, `lib/support.ts`, `lib/privacy-requests.ts`.
- **Configuration and headers:** `lib/config.ts`, `proxy.ts`, `lib/security-headers.ts`, `next.config.ts`, `netlify.toml`.
- **Analytics and email:** `components/analytics-tracker.tsx`, `lib/analytics-web.ts`, `lib/analytics-commerce.ts`, `lib/email-notices.ts`, `lib/integrations/email/**`, `lib/fulfillment.ts`.
- **Dependencies:** `package.json`, `package-lock.json`, `npm audit --package-lock-only`.

### 3. Read-only database inspection

A read-only PostgreSQL connection was used solely for aggregate security-posture checks. No writes, migrations, seeds, DDL, or row-level PII extraction were performed. The queries returned:

- `seo_settings`: **0 rows** (GA4 is not configured).
- Users by role: **1 admin**, `totp_enabled = true`; **0 support**, **0 finance**.
- Active sessions (`expires_at > now()`): **0**.

These results are aggregate and contain no personal data or secret values.

### 4. Build-artifact inspection

- No production build was run.
- The existing `.next` output was inspected read-only.
- No tracked `.env` file exists other than `.env.example`.
- No secret values were found in the build output; only non-secret environment identifiers (`APP_ENV`, `DATABASE_ENV`, `DATABASE_SSL`) appeared.
- No public source maps were found under `.next/static`.
- No `.env` copies were found in the served build output.
- No `NEXT_PUBLIC_*` variable was found to carry a secret.

### 5. Controlled non-destructive testing

Live application testing was limited by Netlify Edge Access, which returned `401 Login Redirect` for the homepage, `/api/health`, login, and administrative paths. No credentials were available, and no authentication bypass, credential reset, or 2FA reset was attempted. No live exploit requests, webhook posts, load tests, or authenticated admin actions were performed.

### 6. Secret handling

No secret values, passwords, session tokens, database credentials, TOTP seeds, encryption keys, or Netlify tokens are reproduced in this report or the companion JSON. Environment variable names are referenced only where necessary to describe configuration behavior. The isolated workspace contained untracked local environment files used for read-only database access; they are gitignored and are not part of the deployed commit.

---

## D. System and Trust Boundaries

ESIMPROVE is a Next.js 16 App Router application deployed on Netlify Functions with a PostgreSQL database accessed through Drizzle ORM. Local development uses embedded PGlite; deployed environments refuse PGlite and require PostgreSQL.

### Primary trust boundaries

1. **Internet → Netlify Edge Access.** The deployed site is currently gated by Netlify Edge Access. Unauthenticated requests receive a `401 Login Redirect` before the application runs. This is a deployment-level control, not an application authorization control.
2. **Browser → Next.js server.** Session cookies, cart cookies, consent state, and server actions cross this boundary. The application relies on HttpOnly cookies, SameSite=Lax, same-origin server-action checks, and page/action guards.
3. **Next.js server → PostgreSQL.** Drizzle parameterizes queries. The only raw SQL uses parameterized templates or closed enum identifiers.
4. **Next.js server → Whop.** Checkout creation uses the server-side order total and a server-side variant mapping. Webhooks are verified with the Standard Webhooks signature scheme and a five-minute timestamp tolerance.
5. **Next.js server → Google Analytics.** GA4 is loaded client-side only after consent. The first-party analytics tracker deliberately excludes private paths, but the GA4 loader itself is global.
6. **Admin/staff → customer data.** Admin pages use `requireStaff`/`requireAdmin`; portal pages enforce ownership. Sensitive payment fields are permission-gated.
7. **Operator → production secrets.** Environment variables supply database credentials, KEKs, session hashing, rate-limit hashing, analytics hashing, and the internal job secret. Configuration validation fails closed on missing or unsafe values.

### Key components

- **Authentication:** scrypt password hashing, opaque random session tokens stored as SHA-256 hashes, HttpOnly/Secure/SameSite=Lax cookies, database-backed fixed-window rate limits, TOTP for administrators.
- **Authorization:** centralized `requireUser`, `requireAdmin`, `requirePermission`, and `requireStaff` guards; role/permission matrix; page-level and action-level enforcement.
- **Commerce:** server-side cart and pricing; UUID idempotency keys; order access tokens stored as hashes; Whop hosted checkout; transactional payment state transitions; fulfillment outbox and jobs.
- **Data protection:** AES-256-GCM envelope encryption for eSIM LPA data and TOTP secrets; hashed session/order/reset/verification tokens; TLS-verified PostgreSQL connections in deployed contexts.
- **Operations:** fail-closed configuration checks, CSP nonce per request, HSTS in production builds, no auto-migration against deployed PostgreSQL, internal job secret, health-check token.

---

## E. Authentication and Session Management

### Positive controls verified

- **Password hashing:** `lib/auth/password.ts` uses scrypt with `N=16,384`, `r=8`, `p=1`, a 16-byte random salt, and a 64-byte derived key (lines 8, 24–40). Verification uses `timingSafeEqual` (lines 42–56).
- **Session tokens:** `lib/auth/session.ts` creates 32 random bytes (`randomToken(32)`), stores only `hashToken(token)` (SHA-256), and sets an expiry (lines 37–60). Lookup requires the hash and a non-expired row (lines 62–84).
- **Session cookie:** `HttpOnly`, `Secure` when `SITE_URL` is HTTPS, `SameSite=Lax`, `Path=/`, explicit expiry (lines 120–131).
- **Session invalidation:** password change and password reset delete all sessions for the user (`lib/auth/actions.ts` lines 597–604 and 544–552). First-login owner rotation deletes sessions conditionally (lines 655–664).
- **Login rate limits:** independent account and IP counters, 10 attempts/15 minutes per account and 30/15 minutes per IP (lines 65–70).
- **2FA attempt limit:** 8 attempts/10 minutes per user (lines 135–138).
- **TOTP generation/verification:** RFC 6238-compatible HMAC-SHA1, 6 digits, 30-second period, timing-safe comparison (`lib/auth/totp.ts` lines 45–77).
- **Admin 2FA enforcement:** deployed configurations must set `ADMIN_2FA_REQUIRED=true` (`lib/config.ts` lines 304–306); the flag defaults to enabled unless explicitly `"false"` (line 52).
- **Reset/verification tokens:** 32 random bytes, stored only as hashes, 30-minute reset TTL (`lib/auth/actions.ts` line 314), prior reset tokens invalidated on a new request (lines 469–478).
- **Email verification:** conditional claim pattern using `isNull(passwordResets.consumedAt)` and `RETURNING` (`lib/auth/actions.ts` lines 416–422). This is the correct pattern that the password-reset flow lacks.
- **Safe redirects:** `safeNextPath` accepts only same-origin absolute paths, rejects protocol-relative paths, backslashes, and control characters (`lib/validation.ts` lines 288–296).
- **Password change:** requires the current password and deletes all sessions (`lib/auth/actions.ts` lines 590–604).
- **First-login owner rotation:** conditional on `passwordChangeRequired = true` and the unchanged password hash, with session deletion (`lib/auth/actions.ts` lines 636–664).

### Findings in this area

| ID | Classification | Severity | Title |
|---|---|---|---|
| AUTH-01 | CONFIRMED VULNERABILITY | Medium | Password-reset token can be consumed more than once under concurrency |
| AUTH-02 | CONFIRMED VULNERABILITY | Low | TOTP codes can be replayed within the acceptance window |
| AUTH-03 | CONFIRMED VULNERABILITY | Medium (latent) | Support/finance staff roles bypass TOTP at login |
| AUTH-04 | CONFIRMED VULNERABILITY | Low | Registration discloses whether an email is registered |
| AUTH-05 | CONFIRMED VULNERABILITY | Low | Login has an account-existence timing oracle |
| AUTH-06 | INFORMATIONAL RECOMMENDATION | Low | Email verification is not required before account use |
| AUTH-07 | INFORMATIONAL RECOMMENDATION | Low | Reset-token redemption is not rate-limited |
| AUTH-08 | INFORMATIONAL RECOMMENDATION | Low | Account-based login limit enables targeted lockout |

Detailed evidence appears in Section O.

---

## F. Authorization and Access Control

### Positive controls verified

- **Central guards:** `lib/auth/guards.ts` defines `requireUser` (lines 9–15), `requireAdmin` (lines 21–39), `requirePermission` (lines 41–56), and `requireStaff` (lines 64–82). All check session presence and pending 2FA; admin/staff guards also check first-login password rotation.
- **Role matrix:** `lib/auth/roles.ts` lines 45–54 grants `admin`/`super_admin` all permissions, `support` orders/support read-write, and `finance` orders/invoices read-only. Refund execution remains administrator-only.
- **Admin layout:** `app/admin/layout.tsx` lines 17–33 calls `requireStaff("/admin")` and filters navigation by `canAccessAdminSection`.
- **Admin pages:** every `app/admin/**/page.tsx` reviewed carries a `requireStaff(...)` or `requireAdmin(...)` guard at the top. Examples: `app/admin/page.tsx:33`, `app/admin/analytics/page.tsx:97`, `app/admin/audit/page.tsx:13`, `app/admin/blog/page.tsx:25`, `app/admin/coupons/page.tsx:13`, `app/admin/customers/page.tsx:32`, `app/admin/emails/page.tsx:16`, `app/admin/finance/page.tsx:16`, `app/admin/help/page.tsx:48`.
- **Admin actions:** all exported actions in `app/admin/actions.ts` call `requireAdmin(...)` with the appropriate permission before work. Examples: `runJobsAction` line 37 (`orders.write`), `retryJobAction` line 61, `approveRefundAction` line 111 (`refunds.write`), `rejectRefundAction` line 151, `adminReplySupportAction` line 217 (`support.write`), `adminUpdateSupportAction` line 259. The `requireAdmin` function resolves the supplied permission through `requirePermissionFor`, so a support account with `support.write` can reply but cannot approve refunds.
- **Portal pages:** require a fully authenticated user and enforce ownership. Examples:
  - `app/portal/esims/[esimId]/page.tsx` lines 28–38 filters by `orders.userId` unless the viewer is an administrator.
  - `app/portal/support/[ticketId]/page.tsx` lines 31–34 uses `getSupportTicketForUser`, which returns `null` unless `ticket.userId === userId` (`lib/support.ts` lines 182–190).
  - `app/portal/support/page.tsx:24` lists only tickets for the current `userId`.
- **Order/eSIM pages:** `lib/orders.ts` `canViewOrder` (lines 69–78) allows an administrator, the owning user, or a valid unexpired order access token. The guest activation page checks this before decrypting the LPA (`app/orders/[orderNumber]/esim/[esimId]/page.tsx` lines 31–58).
- **Proxy gate:** `proxy.ts` lines 72–87 redirects anonymous visitors away from `/admin` and `/portal` when the session cookie is absent. The comment correctly notes that deeper role/permission authorization remains in the layout, pages, and actions. A cookie-presence check is not an authorization decision; it is an early redirect optimization.

### Finding in this area

`AUTH-03` is the only authorization-relevant code weakness: staff roles are considered “staff” for admin access but are not required to complete TOTP. Detailed evidence appears in Section O.

### Dispositioned concerns

- **Proxy cookie-presence check:** false positive. An invalid or forged cookie passes the proxy but is rejected by `requireStaff`/`requireAdmin` when the session is looked up.
- **Admin action authorization:** no unguarded admin action was found.
- **IDOR:** no confirmed IDOR. Ownership and token checks are present on order, eSIM, support, refund, and portal surfaces.

---

## G. Input Validation, Injection, and Browser Security

### Positive controls verified

- **Validation:** Zod schemas centralize email normalization, password policy, checkout fields, support fields, and admin inputs (`lib/validation.ts`).
- **SQL injection:** Drizzle parameterizes values. The only `sql.raw` uses in `lib/analytics-commerce.ts` interpolate closed enum values (`"day"`/`"month"`) and constant format strings (`BUCKET_SQL`) at lines 102–117, 201–207, and 250–254. The rate-limit upsert is a parameterized `sql` template (`lib/rate-limit.ts` lines 54–82). The analytics event-count query is parameterized (`lib/analytics-web.ts` lines 225–231).
- **XSS:** React escapes normal text. The CSP uses a fresh 128-bit nonce per request, `script-src` without `'unsafe-inline'`, and `script-src-attr 'none'` (`lib/security-headers.ts` lines 70–120; `proxy.ts` lines 27–34). The only `dangerouslySetInnerHTML` uses are admin-authored blog HTML and JSON-LD; see `DATA-02`.
- **CSRF:** State-changing operations are server actions; Next.js enforces same-origin action requests. Session and cart cookies are `SameSite=Lax`. No state-changing GET endpoint was found.
- **Open redirect:** `safeNextPath` rejects external, protocol-relative, backslash, and control-character variants (`lib/validation.ts` lines 288–296).
- **File upload:** no upload feature exists.
- **Command injection:** no `child_process`, `execSync`, or `spawnSync` usage exists in application code.
- **SSRF:** no user-controlled outbound fetch was found. Supplier adapters are mock/disabled; future supplier connections have a public-HTTPS guard (`lib/config.ts` lines 141–149). Image handling uses local assets, not a remote image optimizer allowlist.
- **Bounded bodies:** `/api/track` and `/api/consent` use `readBoundedText` with 32 KiB and 8 KiB limits (`app/api/track/route.ts` lines 20, 98–100; `app/api/consent/route.ts` lines 15, 66–72; `lib/http/bounded-body.ts` lines 1–28).

### Finding in this area

`WEB-01` — the Whop webhook and the non-production mock webhook read an unbounded body before verification. The bounded-body helper already exists and is used elsewhere, making this an implementation gap rather than a design limitation.

### Informational browser-security items

- `WEB-02` — sensitive pages do not explicitly set `Cache-Control: no-store` / `Referrer-Policy: no-referrer` in source; Next.js may default dynamic pages to private/no-store, but this was not live-verifiable.
- `WEB-03` — CSP always allows `https://www.googletagmanager.com` even when GA4 is not configured.
- `DATA-02` — admin-authored blog HTML and JSON-LD are not sanitized/escaped against `</script>` breakout; admin-only, defense-in-depth.

---

## H. Payment, Checkout, and Webhook Security

### Positive controls verified

- **Server-side pricing:** `lib/checkout.ts` loads plans from the database, rejects unpublished plans, derives unit prices from database rows, and calculates totals server-side (lines 194–248). The client submits plan IDs/quantities, not prices.
- **Server-side checkout:** `app/checkout/actions.ts` passes only the cart token, contact fields, idempotency key, and authenticated user ID (lines 30–51). It does not accept a price or total.
- **Whop amount/currency checks:** `lib/integrations/payment/whop.ts` compares the returned variant price and currency to the server-side expected values before returning a checkout URL (lines 249–261), and rejects tax-inclusive totals (lines 199–203).
- **Webhook signature:** `lib/payments.ts` line 61 calls `provider.verifyWebhook(rawBody, signature, headers)` before any state change. The Whop adapter uses `unwrapWebhook` with the Standard Webhooks header set (`lib/integrations/payment/whop.ts` lines 312–315). The Standard Webhooks library enforces a five-minute timestamp tolerance (`node_modules/standardwebhooks/dist/index.js` lines 7, 119–122).
- **Webhook reference checks:** `lib/payments.ts` lines 78–109 resolve the internal payment by ID, provider payment ID, and order ID; reject unknown payments/orders; and compare amount and currency before transition.
- **Deduplication:** `webhook_events` has a unique index on `(provider, external_event_id)` (`lib/db/schema.ts` lines 246–263), and `handlePaymentWebhook` checks for an existing event before processing (`lib/payments.ts` lines 64–76).
- **Transactional transitions:** payment/order updates, order events, and outbox inserts occur in one transaction (`lib/payments.ts` lines 139–220). Invalid state transitions are rejected (lines 122–128).
- **Mock webhook disabled in production:** `app/api/webhooks/payments/mock/route.ts` lines 9–13 returns 404 when `mockCommerceAllowed` is false; `mockCommerceAllowed = !isProduction` (`lib/config.ts` line 35).
- **Refund approval:** `lib/refunds.ts` applies refunds transactionally and checks the remaining refundable balance at approval time (lines 242–360). A customer request race can over-reserve, but cannot over-refund.

### Finding in this area

`PAY-01` — the idempotency-key branch returns an existing order and mints a fresh access token without verifying that the current cart or user matches the existing order. The key is a server-generated UUID (`app/checkout/page.tsx:39`; `lib/ids.ts` lines 3–5), so exploitation requires knowledge of that UUID.

### Dispositioned concerns

- **Price manipulation:** false positive. No client price is trusted.
- **Webhook forgery/replay:** false positive. Signature, timestamp tolerance, reference checks, amount/currency checks, and unique event IDs are present.
- **Webhook dedupe race:** false positive at the security boundary. The unique index prevents two webhook events from both committing; a losing transaction may return an error and be retried by the provider, but it cannot double-apply payment.
- **Mock webhook in production:** false positive. The route returns 404 before reading the body.
- **Over-refund:** false positive. Approval-time balance checks prevent refunds beyond the order total.

---

## I. Data Protection, Cryptography, and Secrets

### Positive controls verified

- **Envelope encryption:** eSIM LPA data and TOTP secrets use AES-256-GCM with a random per-record DEK wrapped by a versioned KEK (`lib/crypto.ts` lines 53–107). The KEK is supplied by environment, not stored in the database.
- **KEK validation:** `ACTIVATION_KEK_V1` must decode to exactly 32 bytes; `ACTIVATION_KEK_ACTIVE_VERSION` must be a positive integer (`lib/config.ts` lines 217–226).
- **Token hashing:** sessions, order access tokens, password resets, email verification tokens, and unsubscribe tokens are stored as SHA-256 hashes, not plaintext.
- **Token entropy:** session/order/reset/verification tokens use `randomToken(32)` (32 random bytes, base64url), and IDs use `randomUUID` (`lib/crypto.ts` lines 124–126; `lib/ids.ts` lines 1–5).
- **Order access tokens:** 30-day TTL, unique hash index, revocation field, and `canViewOrder` enforcement (`lib/orders.ts` lines 33–78; `lib/db/schema.ts` lines 355–370).
- **Database TLS:** deployed contexts default to `require` with certificate verification; `disable` is rejected by configuration validation (`lib/db/client.ts` lines 44–62; `lib/config.ts` lines 181–189).
- **PGlite refusal:** deployed environments refuse to start an embedded PGlite database (`lib/db/client.ts` lines 102–106).
- **No deployed auto-migration:** only local PGlite runs migrations automatically; deployed PostgreSQL must be migrated explicitly (`lib/db/client.ts` lines 125–133).
- **Email redaction:** transactional email bodies are redacted before storage, and transport error messages are redacted and truncated (`lib/email-notices.ts` lines 22–69; `lib/integrations/email/redact.ts` lines 1–15). Fulfillment email logs redact the order access token (`lib/fulfillment.ts` lines 123–145).
- **No secrets in source/build:** no tracked `.env` other than `.env.example`; no secret values in `.next`; no public source maps; no `NEXT_PUBLIC_*` secret.
- **Netlify secret scanner:** the prior warnings concerned non-secret `APP_ENV`, `DATABASE_ENV`, and `DATABASE_SSL` identifiers, which are also explicitly omitted via `SECRETS_SCAN_OMIT_KEYS`.

### Finding in this area

`DATA-01` — the anonymous contact form resolves the submitted email to an existing user ID and attaches the ticket to that account without verifying ownership of the email. This is a data-integrity/abuse issue rather than a direct disclosure.

### Operational credential item

`OPS-01` — an active Netlify access token with prior exposure was not rotated during this audit. This is outside application code but is the highest-priority operational action. No token value is reproduced.

---

## J. Configuration and Deployment Hardening

### Positive controls verified

- **Fail-closed configuration:** `getConfigurationProblems()` validates `SITE_URL`, `DATABASE_URL`, `DATABASE_ENV`, shared secrets, live flags, Whop configuration, and `ADMIN_2FA_REQUIRED` (`lib/config.ts` lines 286–334). `assertProductionSafe()` throws on any problem (lines 336–345).
- **Deployment detection:** `isDeployed` is true on Netlify or for preview/staging/production contexts; `isLocal` is the inverse (`lib/config.ts` lines 18–28). Netlify alone does not select production.
- **Production guardrails:** `DEMO_MODE` and `SEED_DEMO_DATA` must be false in production; `SUPPLIER_CREDENTIAL_KEK` is required; the activation-KEK fallback must be false (lines 308–323).
- **Live integrations fail closed:** `EMAIL_LIVE_ENABLED`, `CATALOGUE_SYNC_ENABLED`, `ANALYTICS_ENABLED`, and `STAGING_ACCESS_ENABLED` are rejected as “not implemented in this build” when enabled (lines 249–253).
- **Internal job secret:** required in deployed environments; local fallback is a clearly-labeled demo value (`lib/config.ts` lines 383–390). `/api/jobs/run` compares it with `safeEqual` and returns 401 otherwise (`app/api/jobs/run/route.ts` lines 14–26).
- **Health endpoint:** detailed output requires `HEALTH_CHECK_TOKEN` via header or Bearer token; if unset, detailed output is disabled (`app/api/health/route.ts` lines 20–28). Public output is generic and no-store.
- **Proxy fail-closed:** if configuration problems exist, all routes except `/api/health` return a generic 503 before application code runs (`proxy.ts` lines 41–70).
- **No production build run:** this audit did not execute `next build`, `npm run build`, or any deploy hook.

### Finding in this area

`CFG-01` — `SESSION_TTL_DAYS` and `ADMIN_SESSION_TTL_MINUTES` are parsed with `Number(...)` and used without validation, and are not included in `getConfigurationProblems()`.

### Hardening items

- `IR-05` — explicitly set `Cache-Control: no-store` and a restrictive `Referrer-Policy` on sensitive order/activation/portal routes.
- `IR-08` — consider `__Host-` cookie prefixes and an idle-timeout in addition to absolute expiry.
- `IR-10` — keep production env files access-controlled, gitignored, and out of build artifacts; rotate any secret that has been copied into an untracked workspace file.

---

## K. Security Headers and Browser Protections

### Positive controls verified

- **CSP:** per-request 128-bit nonce; `default-src 'self'`; `script-src 'self' 'nonce-...' https://www.googletagmanager.com`; `script-src-attr 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `frame-src 'none'` (`lib/security-headers.ts` lines 78–120; `proxy.ts` lines 27–40).
- **No `'unsafe-inline'` in `script-src`.** `'unsafe-inline'` is present only in `style-src`, which is a common framework compatibility tradeoff.
- **Frame denial:** both `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` (`next.config.ts` lines 19–24; `lib/security-headers.ts` line 111).
- **HSTS:** `max-age=31536000; includeSubDomains` in production builds only (`next.config.ts` lines 3–5, 31–38).
- **Other headers:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` disabling camera/microphone/geolocation/payment, `X-DNS-Prefetch-Control: off`, and `poweredByHeader: false` (`next.config.ts` lines 7–30).
- **Header injection resistance:** CSP host parsing accepts only exact HTTPS origins and drops invalid entries (`lib/security-headers.ts` lines 44–60).

### Limitations

Live header verification was not possible because Netlify Edge Access returned a 401 before the application. The assessment is based on `next.config.ts`, `proxy.ts`, and `lib/security-headers.ts`. The code path is clear, but a future post-access verification should confirm the emitted headers on the deployed origin.

### Hardening items

- `WEB-03` — conditionally include the Google Tag Manager origin only when GA4 is configured; currently it is always allowlisted.
- `IR-07` — consider a nonce/hash-based style strategy if framework constraints permit, and review `style-src 'unsafe-inline'` risk periodically.
- Consider adding `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` after compatibility testing.

---

## L. Dependency and Supply Chain

### Results

- `npm audit --package-lock-only`: **0 known vulnerabilities**.
- 528 packages resolved.
- 3 packages with install scripts: `esbuild`, `fsevents`, `unrs-resolver`.
- 0 packages with missing integrity metadata.
- 0 packages resolved outside the npm registry.
- 1 deprecated package: `eslint 9.39.5`.
- Key versions: `next 16.4.6`, `react 19.3.1`, `drizzle-orm 0.45.4`, `pg 8.23.1`, `zod 4.6.7`, `@whop/sdk ^2.8.1`.

### Assessment

No known dependency vulnerability was identified. The lockfile has integrity metadata and registry-only resolution. The install-script packages are common build-time dependencies, but their scripts should be reviewed as part of routine supply-chain hygiene. `npm audit` is not a complete supply-chain audit; it does not detect malicious packages, compromised maintainers, or zero-days.

### Recommendation

- `IR-09` — generate an SBOM, pin production dependency versions, review install scripts, and monitor advisories. Do not run `npm audit fix --force` without a compatibility review.

---

## M. Privacy, Logging, and Monitoring

### Positive controls verified

- **Consent:** analytics is consent-gated; `browserPrivacySignalsBlockAnalytics()` honors DNT/GPC; consent state is versioned (`components/analytics-tracker.tsx` lines 674–738).
- **Private-path exclusion:** the first-party tracker excludes `/admin`, `/portal`, `/orders`, `/checkout`, `/cart`, `/login`, `/register`, and `/privacy/request` (`components/analytics-tracker.tsx` lines 29–38, 564–587).
- **Data minimization:** analytics stores hashed visitor/session identifiers, coarse country, and minimized referrers; raw IP addresses are not stored (`app/api/track/route.ts` lines 53–66; `components/analytics-tracker.tsx` lines 233–256).
- **Audit logging:** authentication, password changes, refunds, support actions, privacy requests, and job runs are recorded with actor/entity metadata.
- **Error handling:** webhook signature failures log only the error class and never echo verification material (`app/api/webhooks/whop/route.ts` lines 51–55). Generic public errors avoid stack traces.
- **Email redaction:** reset links, order access tokens, and other high-entropy tokens are redacted before `email_events` persistence (`lib/email-notices.ts` lines 22–69; `lib/integrations/email/redact.ts` lines 1–15).

### Finding in this area

`ANL-01` — the global GA4 loader does not exclude private paths and does not disable automatic `page_view`, so enabling GA4 could send query-string tokens to Google after analytics consent.

### Monitoring recommendations

- Alert on repeated webhook 4xx/5xx, unusual 2FA failure rates, password-reset bursts, and admin login anomalies.
- Retain audit logs according to policy and protect them from deletion by lower-privileged staff.
- Review Netlify deploy and environment-variable audit logs after rotating the exposed token.

---

## N. Findings Summary

### Confirmed vulnerabilities

| ID | Severity | Confidence | Finding | Primary location |
|---|---|---|---|---|
| AUTH-01 | Medium | High | Password-reset token consumption is not atomic | `lib/auth/actions.ts:504-570` |
| AUTH-02 | Low | High | TOTP codes can be replayed within the ±1 window | `lib/auth/totp.ts:62-77` |
| AUTH-03 | Medium (latent) | High | Support/finance staff bypass TOTP | `lib/auth/actions.ts:80-87`, `lib/auth/guards.ts:64-82` |
| AUTH-04 | Low | High | Registration account-existence disclosure | `lib/auth/actions.ts:207-210` |
| AUTH-05 | Low | Medium | Login account-existence timing oracle | `lib/auth/actions.ts:73-76` |
| WEB-01 | Low | High | Unbounded webhook body read before verification | `app/api/webhooks/whop/route.ts:27` |
| DATA-01 | Low | High | Anonymous contact form links tickets to unverified accounts | `app/contact/actions.ts:54-85` |

### Potential vulnerabilities

| ID | Severity | Confidence | Finding | Primary location |
|---|---|---|---|---|
| PAY-01 | Low | High (code) / Low (exploitability) | Checkout idempotency key not bound to cart/user; mints new access token | `lib/checkout.ts:250-312` |
| ANL-01 | Medium (conditional) | High | GA4 auto page_view can leak order/reset tokens if GA4 is enabled | `components/analytics-tracker.tsx:674-738` |
| CFG-01 | Low | High | Session TTL env vars unvalidated | `lib/auth/actions.ts:109,156,280` |

### Informational recommendations

| ID | Priority | Finding |
|---|---|---|
| OPS-01 | High (operational) | Active Netlify token with prior exposure not rotated |
| AUTH-06 | Low | Email verification not required before account use |
| CRYPTO-01 | Low | scrypt `N=16,384` below current OWASP recommendation |
| WEB-02 | Low | Sensitive pages lack explicit no-store/no-referrer headers |
| WEB-03 | Low | CSP always allows Google Tag Manager origin |
| DATA-02 | Low | Admin-authored HTML/JSON-LD not sanitized/escaped |
| AUTH-07 | Low | Reset-token redemption not rate-limited |
| AUTH-08 | Low | Account-based login limit enables targeted lockout |
| IR-09 | Low | Supply-chain/SBOM and security monitoring improvements |
| IR-10 | Low | Production env-file hygiene and secret rotation discipline |

### False positives

Sixteen suspected issues were dispositioned as false positives after code and configuration review. See Section P.

---

## O. Detailed Findings

### AUTH-01 — Password-reset token can be consumed more than once under concurrency

- **Classification:** CONFIRMED VULNERABILITY
- **Severity:** Medium
- **Confidence:** High
- **Component:** `lib/auth/actions.ts` → `resetPasswordAction`
- **Locations:** function lines 504–570; token lookup/pre-check lines 520–536; transaction lines 544–552; unconditional consumption line 545.

**Evidence**

`resetPasswordAction` first selects the reset row by token hash, checks `reset.consumedAt` and expiry in application code (lines 520–536), and then opens a transaction that unconditionally updates the row:

```ts
await db.transaction(async (tx) => {
  await tx.update(passwordResets).set({ consumedAt: new Date() }).where(eq(passwordResets.id, reset.id));
  await tx.update(users).set({
    passwordHash: await hashPassword(parsed.data.password),
    passwordChangeRequired: false,
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));
  await tx.delete(sessions).where(eq(sessions.userId, user.id));
});
```

The update at line 545 has no `isNull(passwordResets.consumedAt)` predicate and does not use `RETURNING` to confirm that this request won the claim. Because `hashPassword` (scrypt) runs inside the transaction at line 547, the transaction is held open for a meaningful period, widening the concurrency window.

The email-verification flow demonstrates the correct pattern in the same file: `verifyEmailAction` performs a conditional claim with `isNull(passwordResets.consumedAt)` and `RETURNING`, and returns without applying the change if the claim fails (`lib/auth/actions.ts` lines 416–422).

**Attack scenario**

1. An attacker obtains a valid reset token (for example, via mailbox access, a leaked email, a shared device, or a referrer/log leak).
2. The legitimate user also opens the reset link and submits a new password at approximately the same time as the attacker.
3. Both requests pass the `consumedAt` pre-check before either transaction commits.
4. Both transactions update the password. The last writer wins; both requests report success.
5. The attacker can attempt to be the last writer, or can reuse the token in a concurrent retry even after the first successful reset.

**Impact**

The single-use guarantee for password-reset tokens is broken under concurrency. The impact is bounded by the need to possess the token, but the flaw undermines a core account-recovery control and can produce a last-writer-wins race over the account password. It also creates a misleading success state for one of the two requests.

**Current exposure**

Production email delivery is disabled (`lib/integrations/email/index.ts` lines 11–21; `lib/integrations/email/disabled.ts` lines 4–33), so reset links are not currently delivered by this build. The code defect remains and becomes directly relevant when a live email transport is added.

**Remediation**

Use a single atomic claim inside the transaction:

```ts
const claimed = await tx
  .update(passwordResets)
  .set({ consumedAt: new Date() })
  .where(and(
    eq(passwordResets.id, reset.id),
    isNull(passwordResets.consumedAt),
    gt(passwordResets.expiresAt, new Date()),
  ))
  .returning({ id: passwordResets.id });

if (claimed.length === 0) {
  throw new Error("RESET_TOKEN_ALREADY_USED");
}
```

Then update the password and delete sessions in the same transaction. Treat a failed claim as an invalid/used link. Add a regression test that fires two concurrent redemption requests with the same token and asserts exactly one success. Consider a partial unique index or a `SELECT ... FOR UPDATE` only if the conditional update alone is insufficient for the chosen isolation level.

**Verification**

- Static: confirm the update predicate includes `isNull(consumedAt)` and `RETURNING`.
- Dynamic (staging): create a reset token, issue two concurrent redemption requests, assert one success and one “invalid or already used” response, and assert the final password corresponds to the winning request only.

---

### AUTH-02 — TOTP codes can be replayed within the acceptance window

- **Classification:** CONFIRMED VULNERABILITY
- **Severity:** Low
- **Confidence:** High
- **Component:** `lib/auth/totp.ts` → `verifyTotp`; `lib/auth/actions.ts` → `loginTwoFactorAction`
- **Locations:** `lib/auth/totp.ts` lines 62–77; `lib/auth/actions.ts` lines 147–154; `lib/db/schema.ts` lines 28–44 (no replay-state column).

**Evidence**

`verifyTotp` accepts a default window of `1`, iterating offsets `-1, 0, +1` and returning true on the first match:

```ts
export function verifyTotp(secret, code, window = 1, timeMs = Date.now()) {
  ...
  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = totpCode(secret, timeMs + offset * 30_000, 30, 6);
    ...
    if (left.length === right.length && timingSafeEqual(left, right)) return true;
  }
  return false;
}
```

`loginTwoFactorAction` verifies the code but does not persist the accepted timestep or reject a code that was already used (`lib/auth/actions.ts` lines 147–154). The `users` table has `totpEnabled` and `totpSecretEncrypted`, but no `totpLastUsedStep`/`totpLastUsedAt` column (`lib/db/schema.ts` lines 28–44).

**Attack scenario**

An attacker who knows the account password and observes or phishes a valid six-digit code can reuse that code within the acceptance window (roughly 90 seconds around the current step, subject to the ±1-step window). The 8-attempts/10-minutes limit reduces brute force but does not prevent replay of a known-valid code.

**Impact**

TOTP’s “one-time” property is weakened. The practical impact is limited because the attacker already needs the password and a valid code, but replay protection is a standard requirement for a second factor.

**Remediation**

- Persist the last accepted TOTP timestep per user (for example, `totpLastUsedStep integer`) and reject any code whose matched step is less than or equal to the stored value.
- Perform the check-and-update atomically with a conditional `UPDATE ... WHERE totp_last_used_step IS NULL OR totp_last_used_step < :step RETURNING ...`.
- Optionally reduce the window to `0` after measuring clock skew, or keep `±1` with replay protection.
- Add a test that accepts a code once and rejects the same code immediately afterward.

---

### AUTH-03 — Support/finance staff roles bypass TOTP at login

- **Classification:** CONFIRMED VULNERABILITY
- **Severity:** Medium (latent)
- **Confidence:** High
- **Component:** `lib/auth/actions.ts` → `loginAction`; `lib/auth/guards.ts` → `requireStaff`; `lib/auth/roles.ts`
- **Locations:** `lib/auth/actions.ts` lines 80–105; `lib/auth/roles.ts` lines 45–67; `lib/auth/guards.ts` lines 64–82; `app/admin/layout.tsx` lines 17–33.

**Evidence**

The login flow defines the 2FA requirement using the administrator role only:

```ts
const adminAccount = isAdminRole(user.role);
...
if (adminAccount && flags.admin2faRequired) {
  // create pending session, require TOTP
}
```

`isAdminRole` returns true only for `admin` and `super_admin` (`lib/auth/roles.ts` lines 56–58). `support` and `finance` are staff roles (`isStaffRole`, lines 60–67), but they are not administrator roles. If a support or finance account signs in successfully, the code skips the TOTP gate and creates a full session at lines 108–113.

`requireStaff` checks session presence, `pendingTwoFactor`, and the access matrix, but does not require that the user has completed TOTP (`lib/auth/guards.ts` lines 64–82). The admin layout uses `requireStaff("/admin")` (`app/admin/layout.tsx` line 27), so a support/finance session can open staff surfaces permitted by the role matrix without a second factor.

**Attack scenario**

1. A support or finance account is created (manually, by seed, or by a future admin user-management feature).
2. The account’s password is compromised through phishing, reuse, or a leak.
3. The attacker signs in and receives a full staff session without a TOTP challenge.
4. A support account can read customer/order data and read/write support tickets; a finance account can read orders and invoices. The blast radius is smaller than an administrator, but still includes customer PII and commercial data.

**Impact**

The deployment’s “admin 2FA required” policy does not cover all staff roles. This is a latent authorization-policy gap: it is not exploitable in the current production data set because there are zero support/finance accounts, but it will become exploitable as soon as such accounts are provisioned.

**Current exposure**

Read-only production DB check: 1 admin with TOTP enabled; 0 support; 0 finance. No staff account currently exists to exploit.

**Remediation**

- Require TOTP for every role that can access `/admin` (all `isStaffRole` users), not only `isAdminRole`.
- Enforce the requirement in both login and `requireStaff` as defense-in-depth, so a session created before a policy change cannot bypass it.
- Provision support/finance accounts with TOTP secrets and test the flow.
- If a deliberate exception is required for a read-only role, document it explicitly and require a separate step-up mechanism for sensitive reads.

---

### AUTH-04 — Registration discloses whether an email is registered

- **Classification:** CONFIRMED VULNERABILITY
- **Severity:** Low
- **Confidence:** High
- **Component:** `lib/auth/actions.ts` → `registerAction`
- **Locations:** lines 207–210.

**Evidence**

```ts
const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
if (existing.length > 0) {
  return { error: "An account with that email already exists. Sign in instead." };
}
```

The response is specific and distinguishable from a successful registration. The registration endpoint is rate-limited to 5 attempts per hour per IP (line 204), which slows but does not prevent enumeration.

**Attack scenario**

An attacker submits candidate email addresses to the registration form and records which ones return the “already exists” error. This produces a list of valid accounts for credential stuffing, phishing, or targeted support impersonation.

**Impact**

Account enumeration. The impact is amplified by the contact-form account linkage (`DATA-01`) and the login timing oracle (`AUTH-05`), which provide additional confirmation channels.

**Remediation**

- Return a uniform response for both new and existing addresses (for example, “Check your email to continue”).
- If the address already exists, send an email to the existing owner explaining that someone attempted to register with their address, rather than disclosing the fact in the HTTP response.
- Keep the per-IP rate limit and consider a CAPTCHA or proof-of-work for repeated attempts.
- Apply the same uniform-response principle to any future “email available” check.

---

### AUTH-05 — Login has an account-existence timing oracle

- **Classification:** CONFIRMED VULNERABILITY
- **Severity:** Low
- **Confidence:** Medium
- **Component:** `lib/auth/actions.ts` → `loginAction`
- **Locations:** lines 73–76; password hashing `lib/auth/password.ts` lines 8, 24–40.

**Evidence**

```ts
const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
const user = rows[0];
const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
if (!user || !valid) {
  return { error: "Email or password is incorrect." };
}
```

For an unknown email, the code skips scrypt entirely. For a known email, it performs a scrypt derivation with `N=16,384`, which takes a measurable amount of CPU time. The error message is uniform, but the response time is not.

**Attack scenario**

An attacker sends login attempts for candidate emails and measures response latency over many samples. Unknown emails cluster at the lower latency; known emails cluster higher. The account and IP rate limits (10/15 min and 30/15 min) constrain the sampling rate, but a patient attacker using multiple source addresses can still collect enough samples. The registration enumeration (`AUTH-04`) already provides a simpler channel; this is a secondary oracle.

**Impact**

Account enumeration. The practical impact is low because of rate limits, network noise, and the existence of an easier enumeration channel, but the timing difference is a real side channel and should be removed.

**Remediation**

- When the user is not found, run `verifyPassword` against a fixed dummy scrypt hash with the same parameters, then return the same error.
- Ensure the dummy hash uses the same `N`, `r`, `p`, and key length so the work is comparable.
- Consider a constant-time response wrapper and monitor login latency distributions.
- Do not rely on a fixed sleep alone; perform equivalent cryptographic work.

---

### WEB-01 — Whop webhook reads an unbounded body before signature verification

- **Classification:** CONFIRMED VULNERABILITY
- **Severity:** Low
- **Confidence:** High
- **Component:** `app/api/webhooks/whop/route.ts` → `POST`; `app/api/webhooks/payments/mock/route.ts` → `POST`
- **Locations:** Whop route line 27; mock route line 14; available helper `lib/http/bounded-body.ts` lines 1–28.

**Evidence**

```ts
// app/api/webhooks/whop/route.ts
const rawBody = await request.text();
```

The route reads the entire request body into memory before verifying the signature. The mock route does the same at line 14, but is non-production only (`mockCommerceAllowed` is false in production). Other public endpoints already use `readBoundedText` with explicit limits (`app/api/track/route.ts` lines 20, 98–100; `app/api/consent/route.ts` lines 15, 66–72).

**Attack scenario**

An unauthenticated attacker sends large POST bodies to `/api/webhooks/whop`. Because the signature is checked only after the full body is read, the function allocates memory and spends time on the body before rejecting the request. Repeated requests can increase memory pressure and consume function concurrency. Netlify’s platform payload limits and timeouts reduce the maximum impact, but the application should not rely on them as its only bound.

**Impact**

Denial-of-service/resource-exhaustion risk. The severity is Low because the platform imposes its own limits and the attacker gains no data or state change, but the code path is unnecessarily exposed.

**Remediation**

- Replace `request.text()` with `readBoundedText(request, MAX_WEBHOOK_BYTES)` (for example, 1 MiB, comfortably above Whop’s event size).
- Return `413 Payload Too Large` when the helper returns `null`.
- Verify the signature immediately after reading the bounded body, before JSON parsing or database access.
- Apply the same change to the mock route for consistency, even though it is non-production.
- Add a test that sends a body above the limit and asserts a 413 without database access.

---

### DATA-01 — Anonymous contact form links tickets to unverified accounts

- **Classification:** CONFIRMED VULNERABILITY
- **Severity:** Low
- **Confidence:** High
- **Component:** `app/contact/actions.ts` → `submitContactAction`; `lib/support.ts` → `createSupportTicket` / `listSupportTicketsForUser`
- **Locations:** `app/contact/actions.ts` lines 54–66 and 78–96; `lib/support.ts` lines 86–121, 131–146; `app/portal/support/page.tsx:24`.

**Evidence**

The contact action resolves the submitted email to a user ID even when the requester is not signed in or is signed in as a different user:

```ts
const email = normalizeEmail(parsed.data.email);
const sessionUser = await getCurrentUser();
let userId: string | null = null;
if (sessionUser && normalizeEmail(sessionUser.email) === email) {
  userId = sessionUser.id;
} else {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  userId = rows[0]?.id ?? null;
}
```

The ticket is then created with that `userId` (lines 79–85), and the consent event is recorded under the same user ID (lines 87–96). Portal support lists tickets by `userId` (`lib/support.ts` lines 131–146; `app/portal/support/page.tsx:24`).

**Attack scenario**

1. An attacker submits the contact form using a victim’s email address.
2. The ticket is attached to the victim’s account and appears in the victim’s portal support list.
3. The attacker’s message is attributed to the victim; staff may act on it or reply to the victim.
4. The attacker can repeat this to pollute the support queue, impersonate the victim to staff, or create misleading consent evidence under the victim’s account.

The attacker cannot read the ticket through the portal (ownership checks prevent that), so this is not a direct data breach. It is an integrity/abuse issue with social-engineering potential.

**Impact**

Support-queue pollution, false attribution, potential staff deception, and incorrect consent records. The victim may receive unexpected support replies.

**Remediation**

- Only attach `userId` when the request is authenticated and the submitted email matches the session email.
- For anonymous submissions, store `userId = null` and require a verification step before linking the ticket to an account.
- Do not record user-scoped consent for an unverified email; use an anonymous subject key or defer until verification.
- Add a test that submits a contact form with a known account email while unauthenticated and asserts `userId` remains null.

---

### PAY-01 — Checkout idempotency key is not bound to the cart or user and mints a fresh access token

- **Classification:** POTENTIAL VULNERABILITY
- **Severity:** Low
- **Confidence:** High (code flaw) / Low (current exploitability)
- **Component:** `lib/checkout.ts` → `createCheckout`; `app/checkout/page.tsx`; `lib/ids.ts`
- **Locations:** `lib/checkout.ts` lines 250–312; `app/checkout/page.tsx:39`; `lib/ids.ts` lines 3–5.

**Evidence**

After pricing the current cart, `createCheckout` looks up an order by the supplied idempotency key globally:

```ts
const existingRows = await db
  .select()
  .from(orders)
  .where(eq(orders.idempotencyKey, input.idempotencyKey))
  .limit(1);
const existing = existingRows[0];
if (existing) {
  const existingPayment = await paymentForOrder(db, existing.id);
  const accessToken = await createOrderAccessToken(db, existing.id);
  ...
  return { orderId: existing.id, orderNumber: existing.orderNumber, ... accessToken ... };
}
```

The branch does not compare `existing.userId` with `input.userId`, and it does not compare the existing order’s cart contents with `input.cartToken`. It mints a new 30-day order access token every time the branch is hit.

The key is generated server-side per checkout page render with `newId("checkout")`, which uses `crypto.randomUUID()` (`lib/ids.ts` lines 3–5). It is submitted as a hidden form field. An attacker cannot choose a victim’s key unless they learn it.

**Attack scenario**

1. An attacker obtains a victim’s idempotency key (for example, from a shared device, a browser extension, an application log, a referrer, or a future XSS).
2. The attacker creates their own non-empty cart so the `getCartView` check passes.
3. The attacker submits checkout with the victim’s key and their own cart.
4. The `existing` branch ignores the attacker’s cart and returns the victim’s order number, total, payment URL, and a fresh access token.
5. The attacker uses the token to view the victim’s order and, if fulfilled, the eSIM activation details.

**Impact**

Potential unauthorized access to order data and eSIM activation secrets. The severity is Low because the UUID is not exposed in URLs, is generated with a CSPRNG, and no leakage path was confirmed. The code flaw is nevertheless real: an idempotency key should not be a bearer capability for an unrelated order.

**Remediation**

- Bind the idempotency key to the cart and, when present, the user: add `cartId`/`userId` to the order or use a composite unique key.
- On replay, verify that the current cart and user match the existing order; otherwise return a conflict, not the order.
- Do not mint a new access token on replay. Return the existing token only if the caller proves ownership; otherwise require the normal ownership/token path.
- Handle the unique-constraint race explicitly: catch duplicate-key errors and return the existing order only after the same ownership check.
- Add a test that replays a key with a different cart/user and asserts rejection.

---

### ANL-01 — GA4 automatic page_view can leak order/reset tokens if GA4 is enabled

- **Classification:** POTENTIAL VULNERABILITY
- **Severity:** Medium (conditional)
- **Confidence:** High
- **Component:** `app/layout.tsx`; `components/analytics-tracker.tsx` → `Ga4Loader`
- **Locations:** `app/layout.tsx` lines 101–102, 123–127; `components/analytics-tracker.tsx` lines 674–738 (especially 725–729); private-path list lines 29–38; first-party page-view logic lines 564–587.

**Evidence**

`Ga4Loader` is rendered globally in the root layout whenever `ga4Enabled` is true:

```tsx
<Ga4Loader
  measurementId={ga4Enabled && ga4 ? ga4 : ""}
  consentVersion={consentVersion}
  nonce={nonce}
/>
```

When consent is granted, the loader calls:

```ts
window.gtag("config", measurementKey, {
  anonymize_ip: true,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
});
```

It does not set `send_page_view: false`, so GA4’s automatic page_view sends the full page URL, including query parameters, to Google. The loader also does not check `isPrivatePath`.

The first-party tracker does exclude private prefixes (`/admin`, `/portal`, `/orders`, `/checkout`, `/cart`, `/login`, `/register`, `/privacy/request`) at lines 29–38 and skips them at lines 570–571. That protection does not apply to the GA4 loader.

Sensitive URLs in the application include:

- `/orders/[orderNumber]?token=...` — order access token (`app/orders/[orderNumber]/page.tsx` lines 22–34).
- `/orders/[orderNumber]/esim/[esimId]?token=...` — activation page token.
- `/login/reset?token=...` — password-reset token (`lib/auth/actions.ts` lines 490–492).

**Attack scenario**

1. The owner configures a GA4 measurement ID in `seo_settings`.
2. A user grants analytics consent.
3. The user opens an order, activation, or password-reset link containing a token.
4. The global GA4 loader automatically sends a page_view to Google with the full URL, including the token.
5. Anyone with access to the Google Analytics property, or anyone who intercepts the analytics request, can extract the token and use it to access the order/eSIM or reset the password.

**Impact**

Potential disclosure of high-value bearer tokens to a third-party analytics provider. The severity is Medium because the impact is high (eSIM activation data or password reset) but the preconditions are significant: GA4 must be enabled and consent granted. The current production database has zero `seo_settings` rows, so GA4 is not configured today.

**Remediation**

- Set `send_page_view: false` in the `gtag("config", ...)` call and send page views manually only for non-private paths.
- Add an `isPrivatePath(pathname)` guard in `Ga4Loader`, or do not render the loader on private routes.
- Strip query strings before sending any page_view; send only the pathname.
- Consider setting `page_location` explicitly to an origin + sanitized path.
- Add a test that mounts the loader on `/orders/...?...token=...` and asserts no analytics request contains the token.

---

### CFG-01 — Session TTL environment variables are unvalidated

- **Classification:** POTENTIAL VULNERABILITY
- **Severity:** Low
- **Confidence:** High
- **Component:** `lib/auth/actions.ts`; `lib/auth/session.ts`; `lib/config.ts`
- **Locations:** `lib/auth/actions.ts` lines 109, 156, 280; `lib/auth/session.ts` lines 37–60, 152–163; `lib/config.ts` lines 286–334.

**Evidence**

```ts
// lib/auth/actions.ts
ttlMinutes: Number(process.env.SESSION_TTL_DAYS || "30") * 24 * 60,
...
const ttlMinutes = Number(process.env.ADMIN_SESSION_TTL_MINUTES || "60");
```

`createSession` and `promotePendingSession` compute `new Date(Date.now() + ttlMinutes * 60_000)` without validating that the value is a positive, bounded number. `getConfigurationProblems()` validates many deployment values but does not include these two TTLs.

**Attack scenario**

This is an operator-misconfiguration risk, not an attacker-controlled input. A typo such as an empty string, a non-numeric value, a negative value, or an excessively large value can produce an invalid `expiresAt`, an immediately expired session, or an unexpectedly long-lived administrator session. A very large admin TTL would extend the window in which a stolen administrator cookie is usable.

**Impact**

Configuration-dependent session lifetime errors. The severity is Low because it requires an operator mistake and does not create a direct external attack path.

**Remediation**

- Parse both values with a positive-integer helper and enforce sane bounds (for example, `SESSION_TTL_DAYS` 1–90; `ADMIN_SESSION_TTL_MINUTES` 5–480).
- Add both checks to `getConfigurationProblems()` so a bad value fails closed in deployed environments.
- Log the effective TTLs at startup without logging secrets.
- Add unit tests for empty, non-numeric, zero, negative, and huge values.

---

### OPS-01 — Active Netlify access token with prior exposure was not rotated

- **Classification:** INFORMATIONAL RECOMMENDATION (operational)
- **Priority:** High
- **Confidence:** Medium (scope/exposure audience not verified)
- **Component:** Netlify account/site access, outside application code.

**Evidence**

The engagement hand-off noted that a Netlify access token had previously been exposed and remained active. This audit did not use the token for any write operation, did not print it, and did not rotate it because credential rotation was explicitly outside the read-only scope.

**Impact**

If the token has deploy, environment-variable, or site-admin scope, an attacker with the token could deploy arbitrary code, read production secrets (including database credentials and KEKs), or alter site configuration. That would dominate the application-level risk. If the token was exposed only to the owner/audit operator and has read-only scope, the immediate risk is lower, but the exposure is still unresolved.

**Remediation**

1. Rotate the token immediately and revoke the old token.
2. Review Netlify deploy, environment-variable, and member audit logs for unauthorized changes.
3. Replace long-lived personal tokens with scoped, short-lived credentials where possible.
4. Enable 2FA on the Netlify account and restrict team membership.
5. Store production secrets in a managed secret store, not in ad hoc local files.
6. Re-run the production configuration check after rotation.

**Verdict impact**

This report’s application verdict is **MODERATE RISK**. If the token’s exposure audience or scope is uncertain, treat the overall operational risk as **HIGH** until rotation and log review are complete.

---

### AUTH-06 — Email verification is not required before account use

- **Classification:** INFORMATIONAL RECOMMENDATION
- **Severity:** Low
- **Confidence:** High
- **Locations:** `lib/auth/actions.ts` lines 213–220, 273–284; login flow lines 108–113; `app/checkout/actions.ts` lines 40–51.

Registration sets `emailVerifiedAt: null` (line 219), issues a verification token (lines 273–277), and immediately creates a full session (lines 279–284). Login does not check `emailVerifiedAt`. Checkout does not require verification.

**Impact**

An attacker can register with an arbitrary email address and use the account without proving control of the mailbox. This enables spam, false account attribution, and delivery of order notifications to an unverified address. It is not a direct takeover because the attacker cannot read the victim’s mailbox.

**Remediation**

- Gate account-linked features (portal access, order history, support ticket creation) on verification, or show a persistent verification banner with limited functionality.
- Allow guest checkout but require verification before linking an order to an account.
- Expire verification tokens and rate-limit re-sends.
- Consider a “verify before first login” flow for accounts that will receive order or eSIM data by email.

---

### CRYPTO-01 — scrypt cost is below current OWASP recommendation

- **Classification:** INFORMATIONAL RECOMMENDATION
- **Severity:** Low
- **Confidence:** High
- **Locations:** `lib/auth/password.ts` line 8.

`N=16,384`, `r=8`, `p=1`. OWASP’s Password Storage Cheat Sheet currently recommends scrypt `N=2^17` (131,072), `r=8`, `p=1`, or Argon2id with appropriate memory/time parameters. The current cost is eight times lower than the recommendation.

**Impact**

If the password hash database is exfiltrated, offline cracking is faster than it should be. Online attacks are constrained by rate limits, and the deployed database is not publicly accessible, so the immediate risk is low.

**Remediation**

- Benchmark a higher cost on the production runtime (Netlify Function CPU/memory limits) and raise `N` to the highest tolerable value, ideally 131,072.
- Store the parameters in the hash string (already done) and rehash on successful login when the stored cost is below policy.
- Consider Argon2id if the runtime supports it and the operational complexity is acceptable.
- Do not lower the cost to compensate for slow functions without a documented risk decision.

---

### WEB-02 — Sensitive pages lack explicit no-store / no-referrer headers in source

- **Classification:** INFORMATIONAL RECOMMENDATION
- **Severity:** Low
- **Confidence:** Medium
- **Locations:** `app/orders/[orderNumber]/page.tsx`; `app/orders/[orderNumber]/esim/[esimId]/page.tsx`; `app/portal/**`; `app/login/reset/**`; `proxy.ts`; `next.config.ts`.

The sensitive order/activation pages carry bearer tokens in query strings and display PII/eSIM activation data. The source does not explicitly set `Cache-Control: no-store` or `Referrer-Policy: no-referrer` for these routes. Next.js may emit a private/no-store default for dynamically rendered pages, and the global `Referrer-Policy` is `strict-origin-when-cross-origin`, which limits cross-origin referrer leakage. However, this was not live-verifiable because Edge Access blocked the application.

**Impact**

If a shared cache, browser cache, or same-origin referrer logs the full URL, the token could be retained or disclosed. The risk is defense-in-depth rather than a confirmed leak.

**Remediation**

- Set `Cache-Control: no-store, max-age=0` and `Referrer-Policy: no-referrer` on `/orders`, `/portal`, `/admin`, `/checkout`, and `/login/reset` in `proxy.ts` or route-level headers.
- Avoid placing tokens in URLs where a cookie or POST body can be used; if URLs are required for guest access, minimize lifetime and add `no-referrer`.
- Add a post-access header verification step once Edge Access credentials are available.

---

### WEB-03 — CSP always allows the Google Tag Manager origin

- **Classification:** INFORMATIONAL RECOMMENDATION
- **Severity:** Low
- **Confidence:** High
- **Locations:** `lib/security-headers.ts` lines 37–42, 84–90.

`script-src` always includes `https://www.googletagmanager.com`, and `connect-src` always includes Google Analytics collection origins, even when GA4 is not configured. This broadens the allowlist unnecessarily and means a future markup injection has an allowed third-party script origin available.

**Impact**

Low. An attacker would still need a script injection primitive; the CSP is nonce-based and blocks inline scripts. The recommendation is to reduce the allowlist to the minimum required by the current configuration.

**Remediation**

- Build the CSP conditionally: include GA4 script/connect origins only when a valid measurement ID is configured.
- Keep `script-src-attr 'none'` and the nonce requirement.
- Re-test the consent-gated analytics flow after the change.

---

### DATA-02 — Admin-authored HTML and JSON-LD are not sanitized/escaped

- **Classification:** INFORMATIONAL RECOMMENDATION
- **Severity:** Low
- **Confidence:** High
- **Locations:** `app/blog/[slug]/page.tsx:159` (`article.bodyHtml`); `app/layout.tsx:115` (site JSON-LD); `lib/seo.ts:275` and `lib/seo.ts:333-371` (JSON.stringify without `<` escaping); `app/blog/[slug]/page.tsx:110,115`.

`article.bodyHtml` is rendered with `dangerouslySetInnerHTML`. The site and article JSON-LD are produced with `JSON.stringify` and inserted into a `<script type="application/ld+json">` block without escaping `<` as `\u003c`. A value containing `</script>` could break out of the JSON-LD block if it reaches these fields.

Only administrator-authorized users can edit blog content and SEO settings, so this is not a lower-privileged-user XSS path. It becomes relevant if an administrator account is compromised, if content is imported from an external feed, or if a future role is allowed to edit blog content without full administrator trust.

**Remediation**

- Sanitize blog HTML with a strict allowlist (for example, a maintained HTML sanitizer) before storage or render.
- Serialize JSON-LD with `<` escaped as `\u003c` (and `>`/`&` as appropriate).
- Add a CSP report-only test with a benign `</script>` payload in a staging article.
- Keep blog editing restricted to trusted administrators until sanitization is in place.

---

### AUTH-07 — Reset-token redemption is not rate-limited

- **Classification:** INFORMATIONAL RECOMMENDATION
- **Severity:** Low
- **Confidence:** High
- **Locations:** `lib/auth/actions.ts` lines 504–570.

`requestPasswordResetAction` is rate-limited (5 requests/30 minutes per IP+email, lines 453–461), but `resetPasswordAction` has no rate limit. An attacker can send many invalid-token redemption requests, causing database lookups and, for valid tokens, scrypt work.

**Impact**

Low. Token entropy (32 random bytes) makes brute force infeasible, and invalid requests do not perform scrypt. The endpoint could still be used for low-volume resource consumption or log noise.

**Remediation**

- Add a per-IP and per-token-hash rate limit to redemption attempts.
- Return a generic error for invalid/used/expired tokens.
- Monitor spikes in invalid redemption attempts.

---

### AUTH-08 — Account-based login limit enables targeted lockout

- **Classification:** INFORMATIONAL RECOMMENDATION
- **Severity:** Low
- **Confidence:** High
- **Locations:** `lib/auth/actions.ts` lines 65–70.

The login limiter uses an account key (`login:account:${email}`, 10 attempts/15 minutes) in addition to an IP key. An attacker who knows a victim’s email can deliberately fail 10 logins to lock the account for 15 minutes.

**Impact**

Targeted denial of service against a known account. The IP limiter also constrains the attacker, and the lockout is short. This is a common tradeoff between brute-force resistance and availability.

**Remediation**

- Prefer progressive delays, CAPTCHA, or risk-based challenges over a hard account lock.
- Notify the account owner of repeated failed attempts.
- Allow recovery through a verified email channel.
- Consider separate counters for password failures and 2FA failures.

---

## P. False Positives and Non-Findings

The following suspected issues were investigated and dispositioned as false positives. They are recorded here to prevent redundant future work and to document the controls that were verified.

| ID | Suspected issue | Disposition and evidence |
|---|---|---|
| FP-01 | Netlify secret-scanner warnings indicate leaked secrets | **False positive.** Warnings concerned non-secret `APP_ENV`, `DATABASE_ENV`, and `DATABASE_SSL` identifiers. No secret values were found in 368 tracked files or the `.next` output. `SECRETS_SCAN_OMIT_KEYS` also excludes them. |
| FP-02 | SQL injection in rate-limit or analytics SQL | **False positive.** Rate-limit SQL is parameterized (`lib/rate-limit.ts:54-82`). `sql.raw` uses only closed enums `"day"`/`"month"` and constant formats (`lib/analytics-commerce.ts:102-117,201-207,250-254`). Analytics event counts are parameterized (`lib/analytics-web.ts:225-231`). |
| FP-03 | Client-side price manipulation at checkout | **False positive.** Plans and prices are loaded from the database; totals are calculated server-side (`lib/checkout.ts:194-248`). The client submits plan IDs/quantities, not prices (`app/checkout/actions.ts:30-51`). |
| FP-04 | Webhook forgery, replay, or duplicate processing | **False positive.** Whop uses Standard Webhooks signature verification with a five-minute timestamp tolerance; payment/order references and amount/currency are checked; `webhook_events` has a unique `(provider, external_event_id)` index (`lib/payments.ts:54-128,139-220`; `lib/db/schema.ts:246-263`; `lib/integrations/payment/whop.ts:312-360`). |
| FP-05 | IDOR on orders, eSIMs, or support tickets | **False positive.** `canViewOrder` enforces admin/owner/token (`lib/orders.ts:69-78`); portal eSIM queries filter by `orders.userId` (`app/portal/esims/[esimId]/page.tsx:28-38`); support detail uses `getSupportTicketForUser` (`lib/support.ts:182-190`). |
| FP-06 | Open redirect via the `next` parameter | **False positive.** `safeNextPath` rejects external/protocol-relative/backslash/control-character values (`lib/validation.ts:288-296`). |
| FP-07 | Admin authorization bypass via the proxy cookie-presence gate | **False positive.** The proxy only checks cookie presence for an early redirect (`proxy.ts:72-87`). Invalid/forged cookies fail `requireStaff`/`requireAdmin` session lookup (`lib/auth/guards.ts:21-82`). |
| FP-08 | Secrets in build output or public source maps | **False positive.** No tracked `.env` beyond `.env.example`; no secret values in `.next`; zero source maps under `.next/static`; no `NEXT_PUBLIC_*` secret. |
| FP-09 | Known dependency vulnerabilities | **False positive.** `npm audit --package-lock-only` reported 0 vulnerabilities across 528 packages; 0 missing integrity; 0 non-registry resolutions. |
| FP-10 | SSRF, command injection, or file upload | **False positive.** No upload feature; no `child_process`/`execSync`/`spawnSync`; supplier adapters are mock/disabled; future supplier URLs are restricted to public HTTPS (`lib/config.ts:141-149`). |
| FP-11 | CSRF on state-changing operations | **False positive.** Server actions are same-origin checked by Next.js; cookies are `SameSite=Lax`; no state-changing GET endpoints were found. |
| FP-12 | Password-reset response reveals account existence | **False positive.** `requestPasswordResetAction` always returns `{ success: true }` after validation, regardless of whether the user exists (`lib/auth/actions.ts:463-501`). The separate timing observation is `AUTH-05`. |
| FP-13 | Reset/order tokens stored in `email_events` or logs | **False positive.** `sendTransactionalEmail` stores a redacted body (`lib/email-notices.ts:22-69`); the redactor removes query tokens and high-entropy strings (`lib/integrations/email/redact.ts:1-15`); fulfillment logs redact the access token (`lib/fulfillment.ts:123-145`). |
| FP-14 | Session cookies lack protective flags | **False positive.** Session cookie is HttpOnly, Secure when `SITE_URL` is HTTPS, SameSite=Lax, Path=/, with expiry (`lib/auth/session.ts:120-131`). Cart cookie has the same flags (`app/actions/cart.ts:23-31`). |
| FP-15 | Mock payment webhook is reachable in production | **False positive.** The route returns 404 when `mockCommerceAllowed` is false, and `mockCommerceAllowed = !isProduction` (`app/api/webhooks/payments/mock/route.ts:9-13`; `lib/config.ts:35`). |
| FP-16 | Refund race allows over-refunding | **False positive at the security boundary.** `applyRefund` is transactional and checks the remaining refundable balance at approval time (`lib/refunds.ts:242-360`). Concurrent requests may over-reserve, but approval cannot exceed the order total. |

---

## Q. Remediation Plan, Limitations, and Final Verdict

### Prioritized remediation plan

#### Immediate (0–7 days)

1. **Rotate the exposed Netlify token** (`OPS-01`) and review deploy/env-var audit logs. This is the only item that could independently warrant a HIGH operational risk rating.
2. **Fix the password-reset claim** (`AUTH-01`) with a conditional `UPDATE ... WHERE consumed_at IS NULL ... RETURNING`, and add a concurrency regression test.
3. **Require TOTP for all staff roles** (`AUTH-03`) or explicitly disable support/finance accounts until the policy is enforced.

#### Short term (1–4 weeks)

4. **Add TOTP replay protection** (`AUTH-02`) with a last-used timestep column and atomic check-and-update.
5. **Bound the webhook body** (`WEB-01`) using `readBoundedText` and return 413 on excess.
6. **Disable GA4 automatic page_view and exclude private paths** (`ANL-01`) before enabling GA4.
7. **Bind checkout idempotency to cart/user and stop minting tokens on replay** (`PAY-01`).
8. **Fix contact-form account linkage** (`DATA-01`) by requiring an authenticated matching email or deferring linkage until verification.
9. **Make registration responses uniform** (`AUTH-04`) and add a dummy scrypt verification for unknown logins (`AUTH-05`).

#### Medium term (1–3 months)

10. **Validate session TTLs** in configuration and fail closed (`CFG-01`).
11. **Add no-store/no-referrer headers** for sensitive routes (`WEB-02`).
12. **Sanitize admin-authored HTML/JSON-LD** (`DATA-02`).
13. **Require email verification** for account-linked features (`AUTH-06`).
14. **Increase scrypt cost** to the highest tolerable setting (`CRYPTO-01`).
15. **Rate-limit reset redemption** (`AUTH-07`) and review account-lockout behavior (`AUTH-08`).
16. **Conditionally include GA4 origins in CSP** (`WEB-03`).
17. **Add monitoring/alerting** for webhook failures, 2FA failures, reset bursts, and admin anomalies (`IR-09`).
18. **Improve env-file hygiene** and secret rotation discipline (`IR-10`).

### Verification checklist after fixes

- [ ] Two concurrent reset redemptions: exactly one succeeds.
- [ ] Reused TOTP code: second use is rejected.
- [ ] Support/finance login: TOTP is required.
- [ ] Unknown login: response time is statistically indistinguishable from a known-email wrong-password login.
- [ ] Registration with an existing email: response is uniform and no account existence is disclosed.
- [ ] Webhook body above limit: 413 before database access.
- [ ] GA4 enabled test: no request contains `token=` or other private query parameters.
- [ ] Checkout replay with a different cart/user: rejected, no new access token.
- [ ] Anonymous contact form with a known email: ticket has `userId = null`.
- [ ] Invalid `SESSION_TTL_DAYS`/`ADMIN_SESSION_TTL_MINUTES`: deployment fails closed.
- [ ] Sensitive routes emit `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
- [ ] Blog/JSON-LD payload containing `</script>` is neutralized.
- [ ] `npm audit` remains clean and an SBOM is generated.

### Limitations

- **Live application testing was blocked.** Netlify Edge Access returned `401 Login Redirect` before the application. Live header, login, 2FA, admin, and DB-connectivity checks could not be completed without credentials or a prohibited access change.
- **No authenticated admin/2FA session was available.** Admin UI behavior, permission edge cases, and 2FA flows were reviewed statically, not exercised live.
- **No production build was run.** Header and build-output conclusions are based on source and existing artifacts.
- **No DAST, fuzzing, or load testing.** The audit is a static/configuration review with read-only DB checks, not a penetration test.
- **No dependency source review.** `npm audit` and lockfile metadata were checked; package source code was not audited for malicious behavior.
- **Netlify platform controls were not assessed.** Edge Access, WAF, DDoS protection, and function isolation are treated as deployment controls outside the application scope.
- **Token scope/exposure audience was not verified.** `OPS-01` remains an operational unknown until rotation and audit-log review.

### Final verdict

**MODERATE RISK**

Rationale:

- No critical or high-severity, directly exploitable application vulnerability was confirmed.
- Authentication, authorization, payment, webhook, SQL, secret-handling, header, and dependency baselines are materially stronger than typical for this stage.
- Two Medium code weaknesses exist in sensitive flows: non-atomic reset-token consumption and the staff-role 2FA gap. Both are currently constrained by production data/configuration but are real defects that will become exploitable as the deployment matures.
- One Medium conditional issue (GA4 token leakage) is currently inert because GA4 is unconfigured.
- Several Low findings (TOTP replay, webhook body bound, contact linkage, idempotency scoping, enumeration/timing) are worth fixing but do not justify a HIGH application rating.
- The unresolved Netlify token exposure is an operational risk that could independently warrant HIGH if its scope or exposure audience is uncertain. Rotate it first.

### Mandatory confirmations

- **NO DEPLOYMENT WAS TRIGGERED.**
- **NO PRODUCTION SETTINGS OR DATA WERE MODIFIED.**
- **NO APPLICATION SOURCE CODE OR DEPENDENCIES WERE CHANGED.**

The only files created by this audit are:

- `docs/ESIMPROVE_SECURITY_AUDIT_REPORT.md`
- `docs/ESIMPROVE_SECURITY_FINDINGS.json`

No fixes have been implemented. Implementation requires separate approval after review of this report.

---

*End of report.*
