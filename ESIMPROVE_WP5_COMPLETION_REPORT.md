# ESIMPROVE WP5 Completion Report

## Scope and checkpoint

- **Task:** WP5 — establish one authoritative data-retention policy, make analytics cleanup honor approved database settings, add DB-backed rate limiting to `/api/track` and `/api/consent`, strengthen the Content Security Policy, require a dedicated `ANALYTICS_HASH_SECRET` in production, and add regression tests.
- **Branch:** `wp5/retention-rate-limit-csp`
- **Approved base checkpoint:** `e3349ea` — WP4 completion report (`5edc46c` — WP4 implementation; `14fc7d1` — WP3).
- **WP5 commits:** the implementation and this report commit (made on top of the approved WP4 checkpoint).
- **Historical work preserved:** WP1–WP4 commits are untouched. No destructive Git commands were used.
- **No deployment, push, DNS change, Netlify change, secret change, or live-service activation was performed.**

## What was implemented

### 1. One authoritative retention source

- `lib/retention.ts` remains the single source of truth for automated analytics retention: `data_retention_settings` is authoritative, with fallback-only TypeScript defaults (`395` days raw events, `730` days aggregates) that must never disagree with migration seeds.
- Added `MIN_RETENTION_DAYS` (`1`) and `MAX_RETENTION_DAYS` (`36500`) plus `isRetentionDaysInRange`, and tightened `normalizeRetentionDays` so out-of-range values fall back to the reviewed default instead of being used.
- `app/admin/legal/actions.ts` now validates retention through the shared `isRetentionDaysInRange` helper; the accepted range remains a whole number between 1 and 36500.
- `app/api/jobs/run/route.ts` now imports `cleanupAnalytics` from `@/lib/retention` directly, making the retention module unambiguous for the cleanup job.

### 2. Analytics cleanup honors approved database settings

- Cleanup loads `data_retention_settings` per category and applies independent event/aggregate cutoffs; production passes no override, so the database policy is authoritative.
- Consent validity (`CONSENT_VALIDITY_DAYS = 180` in `lib/legal.ts`) is a separate policy and is not treated as a retention period; the tests assert the two are never confused.

### 3. Rate limiting added for `/api/track` and `/api/consent`

- `lib/rate-limit.ts` gained `REQUEST_RATE_LIMITS` (`analyticsTrack`: 120 requests / 60 seconds; `consent`: 30 requests / 60 seconds), `requestIpHash`, `requestRateLimitKey`, and `checkRequestRateLimit`.
- Counter writes use the existing atomic PostgreSQL upsert in `rate_limit_counters`; only an HMAC of the client address is used as the key, never a raw IP.
- `/api/track` and `/api/consent` now run the DB-backed check before body parsing / consent handling and return `429` with `Retry-After` and `no-store` headers when the limit is exceeded.

### 4. Content Security Policy strengthened

- New `lib/security-headers.ts` builds the CSP with `default-src 'self'`, an explicit `script-src` (`'self' 'unsafe-inline' https://www.googletagmanager.com`, plus `'unsafe-eval'` in development), `connect-src` limited to first-party plus GA4 collection endpoints, explicit `style-src`, `img-src`, `font-src`, `media-src`, and `worker-src`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `frame-src 'none'`, and `upgrade-insecure-requests` in production builds.
- `next.config.ts` wires the builder into the `Content-Security-Policy` header. Google Tag Manager scripts remain consent-gated by `Ga4Loader` in the client, and the CSP only permits the GA4 script/collector sources.

### 5. Dedicated analytics hash secret required

- `lib/config.ts` adds `analyticsHashSecret()`, which returns `ANALYTICS_HASH_SECRET` only when it is at least 32 characters and fails closed in deployed contexts otherwise; local/demo fallbacks are non-secret local values only.
- Deployment validation now requires `ANALYTICS_HASH_SECRET`, at least 32 characters, and distinct from `RATE_LIMIT_HASH_SECRET` and `AUTH_SECRET`.
- `lib/consent.ts` and `lib/analytics-web.ts` now use the dedicated analytics hash secret for consent-subject and analytics-identifier HMACs.

### 6. Documentation, setup, and env references

- `scripts/setup.ts` generates a dedicated local `ANALYTICS_HASH_SECRET`.
- `.env.example` documents the dedicated secret requirement and clarifies that retention and consent validity are separate policies.
- `docs/DATA-MODEL.md` retention table now reflects the approved analytics retention values (395/730 days) instead of the stale proposal range.

## Files changed

| File | Change |
| --- | --- |
| `lib/retention.ts` | Added `MIN_RETENTION_DAYS`, `MAX_RETENTION_DAYS`, `isRetentionDaysInRange`; safe normalization within the approved range. |
| `app/admin/legal/actions.ts` | Retention validation now uses the shared constants and range helper. |
| `app/api/jobs/run/route.ts` | Cleanup job imports `cleanupAnalytics` from `@/lib/retention`. |
| `lib/config.ts` | Added `analyticsHashSecret()` and production validation requiring a dedicated, sufficiently long, distinct analytics secret. |
| `lib/consent.ts` | Consent-subject hashing uses the dedicated analytics hash secret. |
| `lib/analytics-web.ts` | Analytics identifier hashing uses the dedicated analytics hash secret. |
| `lib/rate-limit.ts` | Added endpoint rate limits, IP-hash key derivation, and DB-backed `checkRequestRateLimit`. |
| `app/api/track/route.ts` | DB-backed rate limiting before processing; `429` responses with `Retry-After`. |
| `app/api/consent/route.ts` | DB-backed rate limiting before processing; `429` responses with `Retry-After`. |
| `lib/security-headers.ts` | New CSP builder. |
| `next.config.ts` | Wired the CSP builder into the security headers. |
| `scripts/setup.ts` | Generates `ANALYTICS_HASH_SECRET` for local setup. |
| `.env.example` | Documents the dedicated analytics secret and separation of retention and consent validity. |
| `tests/retention.test.ts` | Asserts migration-seeded retention values match defaults, safe normalization, and consent/retention separation. |
| `tests/config.test.ts` | Asserts production analytics secret requirement and distinctness. |
| `tests/wp5-security.test.ts` | New regression suite for DB-backed rate limits, 429 behavior, CSP, and analytics hashing. |
| `docs/DATA-MODEL.md` | Corrected analytics retention documentation. |

No `any`, `eslint-disable`, `@ts-ignore`, or `@ts-expect-error` was introduced in changed files.

## Regression coverage added

- **Retention:** migration-seeded values (`395`/`730`) equal the TypeScript fallback defaults; invalid and out-of-range retention values fall back safely; consent validity (`180`) is distinct from analytics retention.
- **Rate limiting:** counters are stored in PostgreSQL and incremented per IP hash; `/api/track` returns `429` with `Retry-After` when the shared counter is exhausted; `/api/consent` is rate limited and allows a fresh IP afterward.
- **CSP:** builder emits `default-src`, explicit `script-src`/`connect-src` allowlists, GA4 script source, frame/object/base/form controls, and production-only `upgrade-insecure-requests`; Next config wires the builder.
- **Analytics secret:** dedicated secret hashing is used for consent and analytics identifiers.

## Quality gates

| Gate | Command | Result | Evidence |
| --- | --- | --- | --- |
| TypeScript | `npm run typecheck` (`tsc --noEmit`) | **Exit 0**, zero errors | `.audit/wp5-typecheck.txt` |
| ESLint | `npm run lint` (`eslint .`) | **Exit 0**, zero errors | `.audit/wp5-lint.txt` |
| Full tests | `npm test` (`vitest run`) | **Exit 0**, 22 files passed, 219 tests passed | `.audit/wp5-full-test.txt` |
| Targeted WP5 tests | `npx vitest run tests/retention.test.ts tests/config.test.ts tests/wp5-security.test.ts tests/phase4-access.test.ts tests/phase4-analytics.test.ts tests/wp4-legal-admin.test.ts` | **Exit 0**, 6 files, 80 tests passed | `.audit/wp5-targeted-test.txt` |
| Production build | `npx next build` | **Exit 0** | terminal/log `C:\Users\hp\AppData\Local\Temp\opencode\wp5-build.txt` |

The full suite grew from the previous 21 files / 209 tests to 22 files / 219 tests. No existing test was weakened or skipped; only new assertions were added.

## Safety and data handling

- The original `.pglite` directory was not modified.
- `.env.local` and secrets were not read, printed, or modified. `.audit/` remains untracked command evidence and is not part of the WP5 commit.
- No deployment, push, or live-service activation was performed.
- Rate limiting state lives in PostgreSQL rather than process memory, so multiple Netlify serverless instances share the same window.

## Remaining limitations and owner-dependent actions

- Migration seed notes still ask the owner to confirm the final analytics retention periods; the build treats the seeded 395/730 values as the reviewed defaults and keeps the database authoritative.
- A nonce/hash-based CSP rollout remains a later hardening step because Next.js App Router inline bootstrap scripts require it.
- Production `ANALYTICS_HASH_SECRET` values have not been set; deploys still fail closed until they are provided through the platform environment.
- External launch prerequisites remain BLOCKED: Netlify, production PostgreSQL, domain/DNS/HTTPS, production secrets/KEKs, scheduler, backup/restore, monitoring, media host, live providers, GSC, legal/tax approval, and production analytics.

WP5 is complete. Work stops here; WP6 and WP7 have not been started.
