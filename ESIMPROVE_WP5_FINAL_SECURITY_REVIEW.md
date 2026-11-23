# ESIMPROVE WP5 — Final Security Review

**Review type:** Read-only post-implementation security audit  
**Date:** 2026-11-09  
**Scope:** WP5 — Netlify client IP extraction, Content Security Policy, retention policy, and rate-limit failure behavior  
**Reviewer:** OpenCode security review  
**Out of scope:** WP6/WP7, code changes, commits, branch switches, deployments, pushes, DNS/Netlify/secret changes

## Checkpoint verification

| Check | Result |
| --- | --- |
| Current branch | `wp5/retention-rate-limit-csp` |
| HEAD commit | `7ecc6bd4dc25234a1ccf6cb2cf816ca49ae1aa7d` (`7ecc6bd`) |
| Recent history | `7ecc6bd` WP5 → `e3349ea` WP4 report → `5edc46c` WP4 implementation |
| Working tree | Clean except untracked `.audit/`; this report is the only file created by this review |
| Tracked modifications | None |
| Deployment/push/DNS/secret changes | None performed |
| `.env.local` / original `.pglite` | Not read or modified |
| WP6/WP7 | Not started |

Verification commands used:

```text
git rev-parse --abbrev-ref HEAD  -> wp5/retention-rate-limit-csp
git rev-parse HEAD               -> 7ecc6bd4dc25234a1ccf6cb2cf816ca49ae1aa7d
git status --short --branch      -> ## wp5/retention-rate-limit-csp
                                    ?? .audit/
git diff --stat                  -> (empty)
```

After creating this report, `git status` additionally shows `?? ESIMPROVE_WP5_FINAL_SECURITY_REVIEW.md`; no tracked file is modified.

This review is based on static inspection of the committed code and tests, plus Netlify's published guidance. No live Netlify deployment, production database, or browser CSP enforcement was available.

## Findings at a glance

| # | Area | Verdict | Severity | Confidence |
| --- | --- | --- | --- | --- |
| 1 | Netlify client IP extraction | Trusts `x-forwarded-for` before Netlify's guaranteed header; spoofing/bypass cannot be excluded; tests only exercise XFF | **High** | Medium-High |
| 2 | Content Security Policy | `script-src 'unsafe-inline'` is required by Next.js App Router inline scripts; nonce rollout is feasible but must cover manual inline scripts | **Medium** | High |
| 3 | Retention policy | Database-authoritative and honored, but 395/730 are implementation defaults, not owner-approved; `automated` flag is not enforced; catch-all DB fallback | **Medium-High** (compliance) | High |
| 4 | Rate-limit failure behavior | Fails closed (`503`) on DB/query failure; `429` headers are correct; `503` lacks `Retry-After`; narrow result-parsing fail-open | **Low-Medium** | High |

Overall: no critical authentication bypass or remote-code-execution path was found. The highest-risk item is the client-IP header precedence in `lib/rate-limit.ts`, which can undermine the per-IP limits and create unbounded counter rows if `x-forwarded-for` is client-influenced.

---

## 1. Netlify client IP extraction

### 1.1 Code path and exact behavior

**Files:**

- `lib/rate-limit.ts:57-70` — `requestIpHash`
- `lib/rate-limit.ts:72-77` — `requestRateLimitKey`
- `lib/rate-limit.ts:79-91` — `checkRequestRateLimit`
- `lib/rate-limit.ts:50-53` — endpoint limits
- `lib/crypto.ts:128-130` — `hashIdentifier` uses HMAC-SHA256 with `rateLimitHashSecret()`
- `lib/config.ts:284-291` — `RATE_LIMIT_HASH_SECRET` (throws in deployed contexts if absent)
- `app/api/track/route.ts:85-95` — rate-limit call before body parsing
- `app/api/consent/route.ts:73-86` — rate-limit call before JSON parsing and consent writes
- `lib/db/schema.ts:438-442` — `rate_limit_counters` table (`key`, `window_start`, `count`)

The effective precedence in `requestIpHash` is:

1. First comma-separated token of `x-forwarded-for`
2. `x-nf-client-connection-ip`
3. `x-real-ip`
4. Literal string `"unknown"`

The selected address is HMAC-SHA256 hashed with `RATE_LIMIT_HASH_SECRET`; the counter key is:

```text
analytics:track:<hmac>   or   consent:record:<hmac>
```

Only the hash is stored in `rate_limit_counters`; the raw IP is not persisted. The SQL uses parameterized values, so there is no SQL-injection concern in the key or window handling.

Limits:

- `/api/track`: 120 requests / 60 seconds (`lib/rate-limit.ts:51`)
- `/api/consent`: 30 requests / 60 seconds (`lib/rate-limit.ts:52`)

### 1.2 Netlify deployment behavior

Netlify's own support guidance is that only `X-Nf-Client-Connection-Ip` is guaranteed. Netlify does not support or guarantee `X-Forwarded-For`; support threads state that internal values such as `127.0.0.1` or `100.64.x.x` can appear, and that Netlify uses XFF internally. See:

- https://answers.netlify.com/t/is-the-client-ip-header-going-to-be-supported-long-term/11203
- https://answers.netlify.com/t/x-forwarded-host/7104
- https://answers.netlify.com/t/seeing-inconsistency-with-client-ip-headers-in-http-request-proxied-from-netlify/41052
- https://docs.netlify.com/build/functions/api/ (`Context` object; Netlify functions expose client metadata)

Because the code checks `x-forwarded-for` **first**, the platform-guaranteed `x-nf-client-connection-ip` is ignored whenever XFF is present.

**Can a client spoof XFF to bypass the limit?** It cannot be ruled out, and the code should not assume it is safe:

- Netlify does not document that it overwrites or strips a client-supplied XFF prefix on every routing path.
- Netlify support threads are inconsistent about what XFF contains (client address vs. internal proxy address).
- If a client-supplied XFF prefix survives, rotating it produces a new HMAC key for every request, so the 120/30-per-minute limits never accumulate.
- If Netlify supplies an internal address in XFF, legitimate traffic can collapse into one bucket, producing global `429`s.
- `x-real-ip` is also client-controllable and is trusted when `x-nf-client-connection-ip` is absent.

The only trustworthy source in a Netlify deployment is `x-nf-client-connection-ip` (or the platform's `context.ip` if exposed by the adapter). The current precedence is therefore backwards relative to Netlify's guidance.

### 1.3 Local development behavior

- There is no Netlify edge, so `x-nf-client-connection-ip` is normally absent.
- Next.js may supply a loopback `x-forwarded-for` (`::1`/`127.0.0.1`) or no XFF at all.
- If no trusted header is present, every request hashes the literal `"unknown"` and shares one per-scope bucket. In a multi-user local/staging environment this can produce unexpected `429`s.
- A local client can freely set `x-forwarded-for` or `x-real-ip`, so local rate-limit testing is trivially spoofable. Local development is not a security boundary, but tests should still model the production header path.

### 1.4 Existing test coverage

- `tests/wp5-security.test.ts:138-160` — same `x-forwarded-for` increments the same counter; a different XFF gets a separate count; the DB row is stored under the expected HMAC key.
- `tests/wp5-security.test.ts:162-195` — `/api/track` returns `429` when a seeded XFF-keyed counter is exhausted; checks `Retry-After` and `no-store`; confirms no analytics events were written.
- `tests/wp5-security.test.ts:197-223` — `/api/consent` returns `429` for an exhausted XFF key; a fresh XFF is allowed and a consent row is stored.

All three tests inject `x-forwarded-for` directly. They never exercise the Netlify header, multi-hop XFF, header precedence, or missing-header behavior.

### 1.5 Missing tests

1. XFF absent, only `x-nf-client-connection-ip` present → stable bucket across repeated requests.
2. Both XFF and `x-nf-client-connection-ip` present with different values → documented precedence (after the fix, the Netlify header must win).
3. XFF `"spoofed, real"` vs. `"real"` → same bucket (after the fix); currently they differ.
4. `x-real-ip` alone; no headers at all → `"unknown"` bucket behavior.
5. Counter key does not contain the raw IP (assert the key is a hex HMAC, not the address).
6. Counter-row cleanup/TTL behavior, if implemented.

### 1.6 Concrete risks

- **Rate-limit bypass:** rotating XFF can create unlimited counters and allow analytics-event flooding, consent-record spam, and repeated DB writes.
- **Unbounded counter growth:** `rate_limit_counters` has no TTL or cleanup job. Every new spoofed address inserts a row that persists indefinitely, enabling storage/index growth even if each request is otherwise cheap.
- **Global false positives:** if Netlify's XFF is an internal address, all users may share a bucket and receive `429`s.
- **NAT collateral:** after fixing the header, all users behind one NAT share 120/30 requests per minute; a large office or carrier-grade NAT may exceed the consent limit.
- **Trust-boundary inconsistency:** the code documents Netlify's header in a comment (`lib/rate-limit.ts:58-60`) but does not prefer it.

### 1.7 Recommended fixes (not implemented)

1. Prefer `x-nf-client-connection-ip` first; use `context.ip` if the Netlify/OpenNext adapter exposes it.
2. Treat `x-forwarded-for` as untrusted unless a trusted-proxy count is configured; parse from the right for that count, never the leftmost value behind an untrusted edge.
3. Use `x-real-ip` only as a local/development fallback, not as a production authority.
4. Add the tests listed in §1.5, including a production-like smoke test that sends Netlify headers.
5. Add TTL cleanup for stale `rate_limit_counters` rows and monitor table growth; consider an edge/WAF rate limit as defense in depth.
6. Document the trust model and NAT behavior in the deployment guide.

---

## 2. Content Security Policy

### 2.1 Current policy and wiring

**Files:**

- `lib/security-headers.ts:29-59` — CSP builder
- `lib/security-headers.ts:33` — `script-src`
- `lib/security-headers.ts:35-36` — `connect-src` and development WebSocket sources
- `lib/security-headers.ts:38-53` — directive list
- `lib/security-headers.ts:54-56` — production-only `upgrade-insecure-requests`
- `next.config.ts:6-7, 16-47` — static header wiring; CSP at lines 28-34
- `proxy.ts:1-62` — existing Next 16 proxy (no nonce handling)

Production CSP emitted by the builder:

```text
default-src 'self';
script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self';
connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com;
media-src 'self';
worker-src 'self' blob:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
frame-src 'none';
manifest-src 'self';
upgrade-insecure-requests
```

`upgrade-insecure-requests` and HSTS are only emitted when `APP_ENV` is exactly `production` at build time (`next.config.ts:6, 30-33, 36-43`). `'unsafe-eval'` is added only in development (`lib/security-headers.ts:34`).

### 2.2 Why `script-src` requires `'unsafe-inline'`

The Next.js App Router emits inline bootstrap/hydration/RSC flight scripts. These are inline `<script>` elements without a nonce or hash, so a CSP without `'unsafe-inline'` would block them and prevent hydration. The code comment states this explicitly (`lib/security-headers.ts:7-10`).

Additional inline scripts exist in application code:

- `app/layout.tsx:111-113` — site JSON-LD
- `app/blog/[slug]/page.tsx:107-113` — article and breadcrumb JSON-LD
- `app/destinations/[slug]/page.tsx:68-70` — breadcrumb JSON-LD
- `app/plans/[slug]/page.tsx:67-69` — breadcrumb JSON-LD

These JSON-LD scripts are data, not executable JavaScript, but they are still `<script>` elements. A nonce-based policy must add `nonce={...}` to them (or verify browser treatment) to avoid CSP violations.

The GA4 loader injects an external script at runtime:

- `components/analytics-tracker.tsx:668-684` — `window.dataLayer`/`gtag` setup and `script.src = "https://www.googletagmanager.com/gtag/js?..."` at line 684.

It is allowed by the `https://www.googletagmanager.com` host source; there is no inline GTM snippet.

### 2.3 Can a nonce-based CSP be introduced safely?

Yes, but it is not a one-line change. The current CSP is static in `next.config.ts`, so it cannot contain a per-request nonce. A safe rollout requires:

1. Generate a per-request nonce in `proxy.ts` (Next 16's middleware equivalent) and emit a single `Content-Security-Policy` response header containing `'nonce-...'`. Do not leave the static `next.config.ts` CSP in place as a second policy; multiple CSP headers are intersected by the browser and make behavior hard to reason about.
2. Pass the nonce to server components via a request header (for example `x-nonce`) so manually authored inline scripts can use `nonce={nonce}`. The JSON-LD scripts listed in §2.2 must be updated.
3. Account for Next.js's inline framework scripts: when Next sees the CSP nonce, it applies it to its own scripts. Verify this against the exact Next 16 build output.
4. Decide how GA4 is trusted. Keeping `https://www.googletagmanager.com` in `script-src` is the simplest option. If `'strict-dynamic'` is used, host allowlists are ignored in CSP3 and dynamically loaded scripts must inherit trust from a nonced script; test this thoroughly.
5. Roll out as `Content-Security-Policy-Report-Only` first, with a reporting endpoint, then enforce after violations are understood. Do not remove `'unsafe-inline'` until all inline scripts are nonced.
6. Ensure HTML containing a nonce is not cached and reused across users. The current build output shows all routes as dynamic (`ƒ`), but CDN/Netlify caching still needs verification.
7. Keep `'unsafe-eval'` development-only; production should remain without it.

A hash-based CSP is less practical here because Next's inline flight/bootstrap content varies per response; nonces are the better fit. The existing `proxy.ts` matcher (`proxy.ts:58-62`) already covers application routes, so nonce generation has a place to live without adding a new middleware layer.

### 2.4 Existing protections and weaknesses

**Good:**

- `default-src 'self'`
- `object-src 'none'`
- `base-uri 'self'`
- `form-action 'self'`
- `frame-ancestors 'none'` and `frame-src 'none'`
- Explicit `connect-src` allowlist for GA4
- No `'unsafe-eval'` in production
- `upgrade-insecure-requests` and HSTS in production when `APP_ENV=production`

**Weak:**

- `script-src 'unsafe-inline'` negates CSP's inline-script XSS mitigation. If any HTML injection exists, injected inline JavaScript executes. The blog renders `article.bodyHtml` via `dangerouslySetInnerHTML` at `app/blog/[slug]/page.tsx:157`; that content is presumably admin-authored, but it is still a content trust boundary.
- `img-src 'self' data: blob: https:` allows image requests to any HTTPS host. If markup injection exists, this permits image-based exfiltration/tracking to an attacker-controlled host. It should be narrowed to the approved media host once selected.
- `style-src 'unsafe-inline'` remains enabled (needed for framework inline styles; a later hardening step).
- Google Tag Manager is a trusted third-party script with full page privileges. CSP host allowlisting cannot constrain what a compromised GTM container does; this is a supply-chain risk.
- No `report-uri`/`report-to`, so CSP violations are invisible.

### 2.5 Existing test coverage

- `tests/wp5-security.test.ts:225-248` — asserts the builder contains `default-src`, the exact `script-src` string including `'unsafe-inline'`, GA4 sources, `connect-src`, frame/object/base/form controls, and `upgrade-insecure-requests`; also asserts development adds `'unsafe-eval'` and omits `upgrade-insecure-requests`.
- `tests/wp5-security.test.ts:250-262` — imports `next.config.ts`, calls its `headers()` function, and asserts the CSP header is wired.

These are string/wiring tests. They do not verify the header on a real HTTP response, browser enforcement, nonce behavior, or the production `APP_ENV` path.

### 2.6 Missing tests

1. Runtime response header: start the app (or a production build) and assert the actual `Content-Security-Policy` header on an HTML response.
2. Production build path: set `APP_ENV=production` and assert `upgrade-insecure-requests`/HSTS are emitted; set a non-production value and assert they are absent.
3. Nonce rollout tests (when implemented): nonce present on framework scripts and manual JSON-LD scripts; no unnonced inline scripts; report-only deployment behavior.
4. CSP violation/reporting integration (when implemented).
5. Media-host allowlist test once `img-src` is narrowed.

### 2.7 Recommended fixes (not implemented)

1. Keep the existing protections; do not weaken or remove them.
2. Implement per-request nonce generation in `proxy.ts`, move CSP emission there, and remove the static CSP header to avoid dual policies.
3. Add `nonce={...}` to all manual inline `<script>` tags listed in §2.2.
4. Roll out report-only first; add a reporting endpoint; then enforce.
5. Narrow `img-src` to the approved media host when known; keep `media-src` aligned with it.
6. Add runtime header and production-config tests.
7. Consider Trusted Types (`require-trusted-types-for 'script'`) and server-side sanitisation of blog HTML as later hardening.

---

## 3. Retention policy

### 3.1 End-to-end flow

**Admin configuration:**

- `app/admin/legal/actions.ts:353-414` — `saveRetentionAction`
  - `dataKey` and `basis` validation: lines 355-369
  - `retentionDays` parse and range check: lines 357-367
  - automation only for analytics keys: lines 371-378
  - enabled rule requires a period: lines 379-381
  - database update: lines 391-401
  - audit record: lines 403-410
  - revalidation/notice: lines 412-413

**Schema:**

- `lib/db/schema.ts:1232-1246` — `data_retention_settings`
  - `retentionDays` is nullable (line 1238)
  - `basis` defaults to `owner_decision_required` (line 1239)
  - `automated` and `enabled` default to `false` (lines 1240-1241)

**Seed data:**

- `db/migrations/0006_legal_compliance.sql:339-366`
  - analytics events: `395`, `technical_default`, `automated=true`, `enabled=true`, note “Confirm the final period with the owner.” (lines 357-359)
  - analytics aggregates: `730`, `technical_default`, `automated=true`, `enabled=true`, note “Confirm the final period with the owner.” (lines 360-362)
  - other categories: proposed values 730/2555/730/1095/1095/30, all `automated=false`, `enabled=false` (lines 342-365)

**Cleanup job:**

- `app/api/jobs/run/route.ts:13-25` — authorization via `x-internal-job-secret` or Bearer
- `app/api/jobs/run/route.ts:27-63` — job execution
  - `cleanupAnalytics(db)` at line 33 with **no override**
  - audit metadata includes effective event/aggregate days at lines 48-51
  - any failure returns `500` at lines 60-63

**Policy load:**

- `lib/retention.ts:84-135` — `loadAnalyticsRetentionPolicy`
  - starts with defaults 395/730 and `enabled=true` (lines 87-94)
  - queries `data_retention_settings` for the two analytics keys (lines 102-110)
  - catches **all** query errors and returns defaults (lines 111-115)
  - per-row handling: `enabled` controls deletion; valid days replace defaults; invalid days leave defaults (lines 117-132)

**Cleanup execution:**

- `lib/retention.ts:157-219` — `cleanupAnalytics`
  - numeric/object overrides applied at lines 163-188
  - independent cutoffs at lines 190-192
  - events deleted by `createdAt` when enabled (lines 194-199)
  - sessions/visitors deleted by `lastSeen` when enabled (lines 200-211)
  - returns counts and effective policy (lines 213-218)

**Separate consent policy:**

- `lib/legal.ts:310-315` — `CONSENT_VALIDITY_DAYS = 180`
- `lib/consent.ts:121` — consent age check
- This is a consent validity window, not an analytics retention period.

### 3.2 Hardcoded defaults, overrides, and clamps

| Item | Location | Behavior |
| --- | --- | --- |
| TypeScript default: raw events 395 days | `lib/retention.ts:35-38` | Fallback only; used when DB rows are missing/invalid/disabled |
| TypeScript default: aggregates 730 days | `lib/retention.ts:35-38` | Fallback only |
| SQL seed: raw events 395 days | `db/migrations/0006_legal_compliance.sql:357-359` | `technical_default`, automated/enabled |
| SQL seed: aggregates 730 days | `db/migrations/0006_legal_compliance.sql:360-362` | `technical_default`, automated/enabled |
| Initial policy enabled | `lib/retention.ts:92-93` | Missing rows still leave cleanup enabled |
| Minimum retention | `lib/retention.ts:40` | 1 day |
| Maximum retention | `lib/retention.ts:43` | 36,500 days (~100 years) |
| Admin range check | `app/admin/legal/actions.ts:361-365` | Uses shared 1–36,500 range |
| Admin input length | `app/admin/legal/actions.ts:357` | `str(..., 6)` limits form field length |
| UI min/max | `components/admin-legal-dashboard.tsx:618-626` | Number input 1–36,500 |
| Normalization | `lib/retention.ts:70-82` | Floors fractional values; rejects non-number/non-finite/out-of-range; returns `null` |
| Catch-all DB fallback | `lib/retention.ts:111-115` | Any query error → defaults 395/730; cleanup proceeds |
| Per-row invalid/null fallback | `lib/retention.ts:117-132` | Invalid enabled row → default days; disabled row → skip category |
| Numeric override | `lib/retention.ts:137-142, 163-188` | Applies same window to both categories; tests/manual only |
| Object override | `lib/retention.ts:137-142, 171-188` | Independent days/enabled flags; tests/manual only |
| Production override | `app/api/jobs/run/route.ts:33` | **None** — database policy is authoritative |
| Test override | `tests/phase4-analytics.test.ts:643` | `cleanupAnalytics(main.db, 30)` |
| Environment override | `lib/retention.ts:19-21` | Removed; no `ANALYTICS_RETENTION_DAYS` |
| Consent validity | `lib/legal.ts:315` | 180 days; intentionally separate |
| Other category seeds | `db/migrations/0006_legal_compliance.sql:342-365` | Proposed values; automation disabled |

**Clamp semantics:** there is no clamp to the maximum. A database value of `36501` normalizes to `null` and therefore falls back to the category default (395 or 730), not to `36500`. Fractional database values are floored (for example, `12.9` → `12`); the admin action rejects fractions before storage, but direct DB edits do not.

### 3.3 Are 395/730 owner-approved?

**No, based on the repository evidence.**

- The migration seeds use `basis = 'technical_default'`, not an owner-decision basis (`db/migrations/0006_legal_compliance.sql:357-362`).
- Both seed notes say: “Confirm the final period with the owner.” (`0006_legal_compliance.sql:359, 362`).
- No retention entry was found in `docs/OWNER-DECISIONS.md`; the document records the Phase 0 direction, not these analytics periods.
- `tests/wp4-legal-admin.test.ts:443` uses the note “Owner-approved analytics window” only as test form data; it is not approval evidence.
- Some documentation asserts approval without a supporting record:
  - `lib/retention.ts:15` — “approved seeds in migration 0006”
  - `docs/DATA-MODEL.md:455-456` — “approved database setting; default”
  - `NETLIFY_PRODUCTION_CHECKLIST.md:49-50` — “matches the approved policy: 395/730”
  - `ESIMPROVE_WP5_COMPLETION_REPORT.md:47` — “approved analytics retention values”
  - `ESIMPROVE_WP5_COMPLETION_REPORT.md:16` describes the values as fallback-only defaults that must agree with the migration seeds; it does not flag that the seeds themselves still require owner confirmation.

These assertions conflict with the migration's `technical_default` basis and “confirm with the owner” notes. The tests at `tests/retention.test.ts:133-140` prove only that the TypeScript defaults equal the SQL seeds; they do not prove owner approval. Because the seeded rows are `enabled=true`, 395/730 are the effective analytics retention values in any database where migration 0006 has been applied, but they are **implementation defaults, not documented owner decisions**.

### 3.4 Other behavior worth noting

- **`automated` is not enforced.** The admin action writes `automated` (`app/admin/legal/actions.ts:372, 396`), but `loadAnalyticsRetentionPolicy` reads only `enabled` (`lib/retention.ts:120, 126`) and cleanup gates only on `enabled` (`lib/retention.ts:194, 200, 206`). A row with `automated=false` and `enabled=true` still deletes data. The admin form allows that combination, and the UI badge labels `enabled` as “Automated” (`components/admin-legal-dashboard.tsx:611`). This is a policy-integrity bug, not just a UI inconsistency.
- **Catch-all fallback can apply the wrong policy.** A transient DB/permission error during the settings query returns defaults and proceeds with cleanup. If the owner configured a stricter period (for example 30 days), the fallback retains data longer; if the owner configured a longer period (for example 1,000 days), the fallback deletes data earlier.
- **Missing rows re-enable cleanup.** Because the initial policy has `eventsEnabled=true`/`aggregatesEnabled=true` (`lib/retention.ts:92-93`), deleting the settings rows does not disable cleanup; it applies 395/730.
- **No transaction around setting update + audit.** `saveRetentionAction` updates the row (lines 391-401) and then writes the audit record (lines 403-410) without a transaction. A failure between the two can change retention without an audit trail.
- **No transaction around cleanup.** `cleanupAnalytics` performs sequential deletes (lines 194-211). A failure after deleting events can leave a partially cleaned dataset. `/api/jobs/run` returns `500` and does not write the audit record on failure (`app/api/jobs/run/route.ts:60-63`).
- **No scheduler in the repository.** Cleanup only runs when `/api/jobs/run` is invoked with the internal secret. If no external scheduler is configured, retention never executes.
- **No batching.** The first cleanup after a long period can delete a large number of rows in one request, risking Netlify function timeouts and database load.
- **Audit metadata lacks sources.** The jobs audit logs effective days (`app/api/jobs/run/route.ts:48-51`) but not `eventsSource`/`aggregatesSource` (database/default/override), which weakens compliance evidence.
- **`basis` is free text.** The admin action requires a non-empty basis but does not validate it against an allowed set, so it can record “owner_decision” without an actual approval reference.

### 3.5 Existing test coverage

- `tests/retention.test.ts:133-140` — migration-seeded 395/730 equal TypeScript defaults.
- `tests/retention.test.ts:177-185` — normalization: 395, 1, 0, -5, 12.9→12, NaN, string.
- `tests/retention.test.ts:187-196` — accepted defaults and 36,500; 36,501 rejected.
- `tests/retention.test.ts:198-205` — consent validity 180 is distinct from analytics defaults.
- `tests/retention.test.ts:207-241` — missing rows use defaults; 500-day events deleted while 500-day aggregates kept; 800-day aggregates deleted.
- `tests/retention.test.ts:243-271` — independent DB settings (10/20 days), then aggregates changed to 10.
- `tests/retention.test.ts:273-288` — `enabled=false` preserves all categories.
- `tests/retention.test.ts:290-307` — enabled row with `0` days falls back to the default.
- `tests/wp4-legal-admin.test.ts:430-488` — admin saves 400 days, rejects `0`, rejects automation for `accounts`, and verifies DB state.
- `tests/phase4-analytics.test.ts:643` — numeric override of 30 days deletes old rows.

### 3.6 Missing tests

1. Admin action → `cleanupAnalytics` end-to-end: save a new period through `saveRetentionAction`, run cleanup, assert the new period is honored.
2. `automated=false` + `enabled=true` behavior: currently cleanup still deletes; a test should either codify or reject this.
3. DB query failure vs. genuinely missing table: assert the catch-all fallback does not silently apply defaults on transient errors.
4. `enabled=true` with `null`, fractional, or `>36500` days; assert fallback and source.
5. `/api/jobs/run` calls cleanup with no override, returns counts/policy, and writes audit metadata.
6. Transaction/partial-failure behavior for settings update + audit and for multi-table cleanup.
7. Scheduler/auth integration: unauthorized call returns `401`; authorized call runs cleanup.
8. A policy check that fails if an automated analytics row still has `basis='technical_default'` (to prevent claiming approval prematurely).

### 3.7 Concrete risks

- **Compliance:** 395/730 are presented as approved in code comments, docs, and the completion report without an owner decision record. Retaining analytics longer than the owner/legal team approved is a privacy-compliance risk.
- **Data loss:** catch-all fallback on transient DB errors, a 100-year maximum, a typo in the admin form, `automated=false` with `enabled=true`, and non-transactional deletes can all delete more data than intended.
- **Silent no-op:** without a scheduler, retention does not run; without monitoring, failures are invisible.
- **Silent fallback:** invalid or missing settings do not alert; the effective source is returned in the API response but not consistently audited.
- **Audit gaps:** update/audit and cleanup/audit are not atomic.

### 3.8 Recommended fixes (not implemented)

1. Obtain and record owner approval (date, scope, basis, reference) for the analytics periods. Change `basis` away from `technical_default`; add an approval reference to `notes`; correct the code comment and docs that currently call the values “approved.”
2. Do not edit the already-applied `0006` migration; use a new migration or the admin action with audit.
3. Make `automated` authoritative or require `enabled => automated` for analytics in `saveRetentionAction`; read both flags in `loadAnalyticsRetentionPolicy`; add tests.
4. Distinguish “0006 not applied” from unexpected DB errors. On unexpected errors, log and skip deletion (fail safe) rather than applying defaults; or require an explicit fallback flag.
5. Default to `enabled=false` when settings rows are missing, or require explicit operator opt-in for fallback cleanup.
6. Wrap the settings update + audit and the cleanup + audit in transactions, or add compensating audit/error handling.
7. Add end-to-end and edge-case tests from §3.6.
8. Batch cleanup deletes and schedule `/api/jobs/run`; add alerting on cleanup failure and on fallback use.
9. Validate `basis` against an allowed set and require an approval reference for automated categories.
10. Log `eventsSource`/`aggregatesSource` in audit metadata.

---

## 4. Rate-limit failure behavior

### 4.1 Code path

**Limiter:**

- `lib/rate-limit.ts:17-44` — `checkRateLimit`
- `lib/rate-limit.ts:23-38` — single atomic PostgreSQL upsert with `RETURNING count`
- `lib/rate-limit.ts:39-43` — result parsing; `count` defaults to `1` if no row/count is found
- `lib/rate-limit.ts:50-53` — limits (120/60s, 30/60s)
- `lib/rate-limit.ts:79-91` — `checkRequestRateLimit`

**Routes:**

- `app/api/track/route.ts:85-95` — `getDb()` + `checkRequestRateLimit` in a `try`; any error → `503` `collection_failed`
- `app/api/track/route.ts:26-37` — `429` helper with `Retry-After`
- `app/api/track/route.ts:152-155` — post-consent failure → `503` `collection_failed`
- `app/api/consent/route.ts:73-86` — `getDb()` + `checkRequestRateLimit` in a `try`; any error → `503` `consent_record_failed`
- `app/api/consent/route.ts:22-33` — `429` helper with `Retry-After`
- `app/api/consent/route.ts:160-166` — post-write failure → `503` `consent_record_failed`
- `proxy.ts:9-32` — deployment configuration problems return `503` for `/api/*` before the route runs

### 4.2 Failure matrix

| Condition | `/api/track` | `/api/consent` | Security effect |
| --- | --- | --- | --- |
| `getDb()` fails at rate-limit stage | `503` `collection_failed` | `503` `consent_record_failed` | **Fail closed**; request rejected before body parse/write |
| Rate-limit SQL/query fails | `503` `collection_failed` | `503` `consent_record_failed` | **Fail closed** |
| `RATE_LIMIT_HASH_SECRET` missing in deployed context | `hashIdentifier` throws → `503` | Same | **Fail closed**; proxy may return `503` even earlier |
| Deployment config problem (missing secret, DB env mismatch) | `503` `{error:"Service configuration error"}` via proxy | Same | **Fail closed**; route not executed |
| Rate limit exceeded | `429` `rate_limited` | `429` `rate_limited` | **Fail closed** |
| DB query succeeds but returns empty/malformed row | `count` defaults to `1` | Same | **Narrow fail open** (low likelihood) |
| `count` is non-numeric (`NaN`) | `NaN <= limit` is false → blocked | Same | **Fail closed** |
| DB is slow/hanging | Request waits until platform timeout | Same | Availability risk; no explicit query timeout |
| Post-rate-limit consent lookup/write fails | `503` `collection_failed` | `503` `consent_record_failed` | **Fail closed**; quota already consumed |
| `NEXT_PUBLIC_ANALYTICS_DISABLED=true` | `204` before DB | N/A | Intentional short-circuit |
| DNT/GPC signal | `204` before DB | N/A | Intentional privacy short-circuit |
| Unsafe Origin | `403` before DB | `403` before DB | Intentional origin check |

**Answer:** the endpoints fail closed for PostgreSQL unavailability and rate-limit query failures. The only fail-open path is the `?? 1` fallback when a successful query returns no usable `count` row; this is unlikely with `RETURNING count`, but it should be made explicit.

### 4.3 `Retry-After` and response headers

**`429` responses (`app/api/track/route.ts:26-37`, `app/api/consent/route.ts:22-33`):**

- Status: `429`
- Body: `{ "ok": false, "error": "rate_limited" }`
- `Retry-After: 60` (the full `windowSeconds` for both scopes)
- `Cache-Control: no-store, max-age=0`
- `X-Robots-Tag: noindex, nofollow`

**`503` responses:**

- Status: `503`
- Track body: `{ "ok": false, "error": "collection_failed" }`
- Consent body: `{ "ok": false, "error": "consent_record_failed" }`
- `Cache-Control: no-store, max-age=0`
- `X-Robots-Tag: noindex, nofollow`
- **No `Retry-After`**

`Retry-After` is a valid integer-seconds value, but it always reports the full 60-second window rather than the remaining time until the window resets. A client that is blocked near the end of a window may wait longer than necessary. The `503` responses give clients no backoff guidance, which can encourage retry storms during a database outage.

### 4.4 Existing test coverage

- `tests/wp5-security.test.ts:138-160` — DB-backed counter increments per IP hash; separate IPs get separate counts; row stored.
- `tests/wp5-security.test.ts:162-195` — `/api/track` returns `429` when a seeded counter is exhausted; checks `Retry-After: 60`, `Cache-Control: no-store`, and that no analytics events were written.
- `tests/wp5-security.test.ts:197-223` — `/api/consent` returns `429` for an exhausted counter; checks `Retry-After`; a fresh IP is allowed and a consent row is stored.

There is **no test** for the `503` paths. A search of `tests/` for `collection_failed`, `consent_record_failed`, `x-nf-client-connection-ip`, `x-real-ip`, and `503` returned no matches.

### 4.5 Missing tests

1. `getDb()` throws or the rate-limit query throws → `503` on both endpoints, correct body/headers, and no analytics/consent writes.
2. `503` responses include (or deliberately omit) `Retry-After`; assert the chosen contract.
3. `RATE_LIMIT_HASH_SECRET` missing in a deployed context → `503`/proxy `503`.
4. Proxy configuration failure → `/api/*` `503` before route execution.
5. Concurrent requests: two parallel calls increment atomically and return consistent counts.
6. Malformed/empty query result: currently defaults to `1`; a test should codify or reject the fail-open behavior.
7. `Retry-After` calculation near the end of a window, if remaining-time behavior is implemented.
8. `429` body shape and `X-Robots-Tag`/`Cache-Control` headers on both endpoints.

### 4.6 Concrete risks

- **Hard DB dependency:** a database outage takes analytics and consent down. This is the correct fail-closed choice, but it requires monitoring/alerting and a documented availability tradeoff.
- **Write amplification:** every request performs a database upsert, including requests that will be blocked. The limiter bounds per-key processing but not total DB write load; spoofed keys (see §1) amplify this and create unbounded rows.
- **Unbounded counter table:** `rate_limit_counters` has no TTL/cleanup. Even legitimate unique IPs accumulate rows forever.
- **Narrow fail-open:** `count` defaults to `1` when the result row is missing/malformed, allowing a request that should arguably be rejected.
- **Missing `Retry-After` on `503`:** clients may retry aggressively during DB outages.
- **No query timeout:** a slow database can tie up Netlify functions until platform timeout.
- **Fixed-window burst:** up to 2× the limit can pass across two adjacent windows. This is a standard fixed-window tradeoff, not a defect.
- **NAT sharing:** legitimate users behind one NAT share the same bucket; 30 consent requests/minute may be low for large networks.

### 4.7 Recommended fixes (not implemented)

1. Add tests for all `503` paths, headers, and “no writes on failure.”
2. Replace `?? 1` with an explicit closed result (or throw) when `rows[0].count` is missing/non-numeric.
3. Add `Retry-After` to `503` (for example 30–60 seconds) and consider `X-RateLimit-*` headers on `429`.
4. Add a database query timeout and monitoring/alerting; consider a circuit breaker without silently failing open.
5. Add TTL cleanup for `rate_limit_counters` (for example, delete rows whose `window_start` is older than one day) and monitor table size.
6. Consider an edge/WAF rate limit as defense in depth, especially for spoofed-key and write-amplification scenarios.
7. Review NAT thresholds and make limits configurable server-side if needed.
8. Document the secret-rotation effect: changing `RATE_LIMIT_HASH_SECRET` resets all existing counter keys.

---

## 5. Cross-cutting observations

- The branch and commit are exactly as required: `wp5/retention-rate-limit-csp` at `7ecc6bd`. No tracked files were modified during this review.
- WP5's recorded gates (typecheck, lint, full tests, targeted tests, production build) were not rerun as part of this read-only audit; the review relies on the committed code, the committed tests, and the previously recorded gate evidence.
- The IP-hash key uses `RATE_LIMIT_HASH_SECRET` via `lib/crypto.ts:128-130`, while analytics/consent identifiers use `ANALYTICS_HASH_SECRET` (`lib/analytics-web.ts:128-136`, `lib/consent.ts:28-30`). This separation is correct.
- The rate-limit SQL is parameterized and uses a single atomic upsert; no SQL injection or read-modify-write race was found.
- The retention and consent policies are correctly separated in code (`CONSENT_VALIDITY_DAYS = 180` is not used as a retention period).
- The completion report and `docs/DATA-MODEL.md` overstate retention approval; this should be corrected before launch.

## 6. Recommended priority order

| Priority | Action |
| --- | --- |
| P1 | Change IP header precedence to trust `x-nf-client-connection-ip` before XFF; add anti-spoofing tests |
| P1 | Record owner approval for 395/730 (or change the values); correct “approved” wording in code/docs |
| P1 | Enforce the `automated` flag (or require `enabled => automated`) for analytics retention |
| P2 | Make retention fallback fail safe on transient DB errors; add admin→cleanup end-to-end tests |
| P2 | Add `503` failure tests and `Retry-After` on `503` |
| P2 | Plan a nonce-based CSP rollout with report-only validation and manual script nonces |
| P3 | Add counter-table TTL/cleanup; add runtime CSP header tests; tighten `img-src` to the media host |

## 7. Limitations

- No live Netlify deployment was available, so the XFF behavior is assessed from Netlify's published guidance and support statements, not from a captured production request.
- No production PostgreSQL or owner-approval record was available; retention approval is assessed from repository evidence only.
- No browser was used to verify CSP enforcement; the CSP analysis is based on the emitted policy string and Next.js/App Router behavior.
- No deployment, push, DNS, Netlify, secret, or database changes were made.

## 8. Conclusion

WP5's implementation is structurally sound and the database-backed limiter, CSP builder, retention authority, and failure handling are implemented as described. The review nevertheless found one high-priority trust-boundary issue (XFF precedence), one material compliance/documentation gap (395/730 presented as approved without an owner decision), one policy-integrity bug (`automated` not enforced), and several lower-priority hardening gaps (CSP nonce rollout, 503 headers, counter TTL, fallback behavior).

No fixes were implemented, no commits were created, no branch was switched, and no deployment occurred. WP6/WP7 were not started.
