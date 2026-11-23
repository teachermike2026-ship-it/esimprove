# Netlify Environment Variables — Esimprove

**Status (2026-11-23):** Inventory and instructions only. A Neon PostgreSQL project named
`esimprove` has been created by the owner, and its pooled/direct connection strings are stored
outside this repository. `esimprove.com` is still parked on Hostinger; no Netlify site, deploy,
database migration, or Netlify-scoped environment variable exists. The Whop adapter remains
fail-closed; its catalogue is empty and live payments remain disabled. No secret value is
reproduced in this document.

Legend for **Required**:

- **Prod** — required for a production deploy.
- **Preview** — required for a deploy preview or staging deploy.
- **Local** — local development only.
- **Optional** — has a safe default or is diagnostic.
- **Reserved** — present in the template but not read by the current build.

Legend for **Scope**: **B** = needed at build time (the preflight reads it), **R** = needed by
Netlify Functions at runtime, **M** = migration/test tooling only.

---

## 1. Values to set per deploy context

### Production

| Variable | Required | B | R | Secret | Safe/expected value |
| --- | --- | --- | --- | --- | --- |
| `APP_ENV` | Prod | ✓ | ✓ | No | `production` |
| `DATABASE_ENV` | Prod | ✓ | ✓ | No | `production` |
| `DATABASE_URL` | Prod | ✓ | ✓ | **Yes** | Provider pooled/session URL with TLS |
| `DATABASE_MIGRATION_URL` | Migration | — | — | **Yes** | Direct/session URL; not set in runtime functions |
| `SITE_URL` | Prod | ✓ | ✓ | No | Verified `https://` origin, no trailing slash |
| `APP_URL` | Optional | ✓ | ✓ | No | `https://esimprove.com` after DNS/HTTPS; functionally required only when Whop checkout is enabled |
| `PAYMENT_PROVIDER` | Optional | ✓ | ✓ | No | Leave unset for this deployment; `whop` fails closed until the full Whop configuration and approval exist |
| `DEMO_MODE` | Prod | ✓ | ✓ | No | `false` |
| `SEED_DEMO_DATA` | Prod | ✓ | ✓ | No | `false` |
| `AUTH_SECRET` | Prod | ✓ | ✓ | **Yes** | At least 32 random characters |
| `ACTIVATION_KEK_V1` | Prod | ✓ | ✓ | **Yes** | Base64-encoded 32-byte key |
| `ACTIVATION_KEK_ACTIVE_VERSION` | Optional | ✓ | ✓ | No | `1` (positive integer) |
| `SUPPLIER_CREDENTIAL_KEK` | Prod | ✓ | ✓ | **Yes** | Separate base64 32-byte key |
| `SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK` | Prod | ✓ | ✓ | No | `false` |
| `INTERNAL_JOB_SECRET` | Prod | ✓ | ✓ | **Yes** | Random high-entropy string |
| `RATE_LIMIT_HASH_SECRET` | Prod | ✓ | ✓ | **Yes** | Random high-entropy string |
| `ANALYTICS_HASH_SECRET` | Prod | ✓ | ✓ | **Yes** | Dedicated random HMAC secret for analytics identifiers |
| `NEXT_PUBLIC_ANALYTICS_DISABLED` | Optional | — | ✓ | No | Leave unset or `false`; `true` makes `/api/track` return 204 before storage |
| `ADMIN_2FA_REQUIRED` | Prod | ✓ | ✓ | No | `true` |
| `PAYMENTS_LIVE_ENABLED` | Prod | ✓ | ✓ | No | `false` |
| `SUPPLIER_LIVE_ENABLED` | Prod | ✓ | ✓ | No | `false` |
| `EMAIL_LIVE_ENABLED` | Prod | ✓ | ✓ | No | `false` |
| `CATALOGUE_SYNC_ENABLED` | Prod | ✓ | ✓ | No | `false` |
| `ANALYTICS_ENABLED` | Optional | ✓ | ✓ | No | Must be `false`; legacy flag rejected by preflight. First-party analytics uses consent + `NEXT_PUBLIC_ANALYTICS_DISABLED` |
| `STAGING_ACCESS_ENABLED` | Prod | ✓ | ✓ | No | `false` |
| `DATABASE_SSL` | Optional | ✓ | ✓ | No | `require` (recommended) |
| `DATABASE_POOL_MAX` | Optional | ✓ | ✓ | No | `3` (1–10) |
| `HEALTH_CHECK_TOKEN` | Optional | — | ✓ | **Yes** | Random token for detailed health diagnostics |

### Deploy preview / staging

Same as production except:

| Variable | Required | B | R | Secret | Expected value |
| --- | --- | --- | --- | --- | --- |
| `APP_ENV` | Preview | ✓ | ✓ | No | `preview` or `staging` |
| `DATABASE_ENV` | Preview | ✓ | ✓ | No | Must equal `APP_ENV` |
| `DATABASE_URL` | Preview | ✓ | ✓ | **Yes** | Isolated preview/staging pooled URL |
| `DEMO_MODE` | Preview | ✓ | ✓ | No | `true` for preview; `true` recommended for staging |
| `SEED_DEMO_DATA` | Optional | ✓ | ✓ | No | `true` only for isolated demo data |
| `MOCK_PAYMENT_WEBHOOK_SECRET` | Preview | ✓ | ✓ | **Yes** | Preview-only random secret |
| `ANALYTICS_HASH_SECRET` | Preview | ✓ | ✓ | **Yes** | Dedicated ≥32-character value, distinct from `AUTH_SECRET` and `RATE_LIMIT_HASH_SECRET`; no fallback in deployed contexts |
| `SUPPLIER_CREDENTIAL_KEK` | Optional | ✓ | ✓ | **Yes** | Recommended; local demo may use fallback |
| `SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK` | Optional | ✓ | ✓ | No | `false` unless a demo explicitly needs fallback |
| All live flags | Preview | ✓ | ✓ | No | `false` |

Preview and staging must never receive production `DATABASE_URL`, production secrets, or
production KEKs.

---

## 2. Complete variable inventory

### Deployment and site identity

| Variable | Purpose | Required | Scope | Secret | Notes |
| --- | --- | --- | --- | --- | --- |
| `APP_ENV` | Selects local/test/preview/staging/production behaviour | All deployed | B/R | No | Required explicitly on Netlify; `NETLIFY=true` is not production |
| `DATABASE_ENV` | Declares the database target context | All deployed | B/R | No | Must equal `APP_ENV`; prevents cross-context data access |
| `SITE_URL` | Public origin for metadata, links, cookies, canonical URLs | All deployed | B/R | No | HTTPS in deployed contexts; no `localhost` |
| `NEXT_PUBLIC_SITE_NAME` | Public site name | Optional | B | No | Inlined into the client bundle; never put secrets here |
| `NETLIFY` | Netlify platform signal | Platform | B/R | No | Do not set manually |
| `URL`, `SITE_NAME`, `SITE_ID` | Netlify read-only values available to functions | Platform | R | No | Do not set manually; `CONTEXT` and `DEPLOY_*` are build-time only |

### Database

| Variable | Purpose | Required | Scope | Secret | Notes |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | Runtime PostgreSQL connection | All deployed | B/R | **Yes** | Neon pooled URL with TLS; never PGlite in a deployed context |
| `DATABASE_MIGRATION_URL` | Direct/session connection for migrations/seeding | Migration | M | **Yes** | Neon direct/session URL; read only by `db:migrate` and `db:seed`; keep out of runtime scope |
| `DATABASE_SSL` | TLS mode | Optional | B/R | No | `require`, `verify-ca`, `verify-full`, or `disable`; `disable` rejected when deployed |
| `DATABASE_SSL_CA` | Optional provider CA bundle | Optional | B/R | No | PEM text; never commit a private key |
| `DATABASE_POOL_MAX` | Maximum pool size per function instance | Optional | B/R | No | Default 3 deployed, 5 local; 1–10 |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | Idle connection timeout | Optional | R | No | Default 10,000 |
| `DATABASE_CONNECTION_TIMEOUT_MS` | Connection acquisition timeout | Optional | R | No | Default 10,000 |
| `DATABASE_STATEMENT_TIMEOUT_MS` | Per-statement timeout | Optional | R | No | Default 15,000 |
| `PGLITE_DATA_DIR` | Local PGlite directory | Local | Local | No | Default `.pglite`; deployed contexts refuse PGlite |

### Authentication and demo administration

| Variable | Purpose | Required | Scope | Secret | Notes |
| --- | --- | --- | --- | --- | --- |
| `AUTH_SECRET` | Session/token HMAC secret | All deployed | B/R | **Yes** | At least 32 characters |
| `SESSION_COOKIE_PREFIX` | Session cookie prefix | Optional | R | No | Default `esimprove` |
| `SESSION_TTL_DAYS` | Customer session lifetime | Optional | R | No | Default 30 |
| `ADMIN_SESSION_TTL_MINUTES` | Admin session lifetime | Optional | R | No | Default 60 |
| `ADMIN_2FA_REQUIRED` | Enforce admin 2FA | All deployed | B/R | No | Must be `true` in deployed contexts |
| `DEMO_ADMIN_EMAIL` | Seeded demo admin email | Preview/local | R | No | Never seed a demo admin in production |
| `DEMO_ADMIN_PASSWORD` | Seeded demo admin password | Preview/local | R | **Yes** | Preview-only; never reuse production credentials |
| `DEMO_ADMIN_TOTP_SECRET` | Seeded demo admin TOTP secret | Preview/local | R | **Yes** | Preview-only |

### Encryption keys

| Variable | Purpose | Required | Scope | Secret | Notes |
| --- | --- | --- | --- | --- | --- |
| `ACTIVATION_KEK_V1` | Wraps activation-data encryption keys | All deployed | B/R | **Yes** | Base64 32 bytes; keep old versions for decryption |
| `ACTIVATION_KEK_ACTIVE_VERSION` | Active KEK version | Optional | B/R | No | Default 1; positive integer |
| `SUPPLIER_CREDENTIAL_KEK` | Dedicated supplier credential KEK | Prod | B/R | **Yes** | Do not reuse the activation KEK |
| `SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK` | Allows local demo fallback | Optional | B/R | No | Must be `false` in production |

### Jobs and rate limiting

| Variable | Purpose | Required | Scope | Secret | Notes |
| --- | --- | --- | --- | --- | --- |
| `INTERNAL_JOB_SECRET` | Authenticates `POST /api/jobs/run` | All deployed | B/R | **Yes** | No scheduler is configured in this build |
| `RATE_LIMIT_HASH_SECRET` | Hashes IP/email identifiers for limits | All deployed | B/R | **Yes** | Random high-entropy string |
| `JOB_MAX_ATTEMPTS` | Fulfillment retry limit | Optional | R | No | Default 8 |
| `JOB_BACKOFF_BASE_SECONDS` | Retry backoff base | Optional | R | No | Default 30 |
| `CRON_SECRET` | Reserved | Reserved | — | **Yes** | Not read by the current build |

### First-party analytics

| Variable | Purpose | Required | Scope | Secret | Notes |
| --- | --- | --- | --- | --- | --- |
| `ANALYTICS_HASH_SECRET` | HMAC key for anonymous visitor/session hashes | All deployed | B/R | **Yes** | At least 32 characters and distinct from `AUTH_SECRET` and `RATE_LIMIT_HASH_SECRET`. Deployed contexts never fall back; local demo/test uses a non-secret fallback |
| `NEXT_PUBLIC_ANALYTICS_DISABLED` | Global tracking kill switch | Optional | R | No | `true` makes `/api/track` return 204 before storage. The client may still attempt a request; nothing is stored. Public, not a secret |
| `ANALYTICS_ENABLED` | Legacy/reserved analytics flag | Optional | B/R | No | Must stay `false`; preflight rejects `true` because no third-party analytics adapter exists. This does **not** disable first-party analytics |

Google Search Console verification and the optional GA4 measurement ID are **not** environment
variables. They are stored in the `seo_settings` table and edited at **Admin → SEO & CMS**.

### Feature flags

| Variable | Purpose | Required | Scope | Secret | Notes |
| --- | --- | --- | --- | --- | --- |
| `PAYMENTS_LIVE_ENABLED` | Live payment kill switch | All deployed | B/R | No | Must be `false`; live adapter is not implemented |
| `SUPPLIER_LIVE_ENABLED` | Live supplier kill switch | All deployed | B/R | No | Must be `false`; N-07 remains open |
| `EMAIL_LIVE_ENABLED` | Live email kill switch | All deployed | B/R | No | Must be `false`; live adapter is not implemented |
| `CATALOGUE_SYNC_ENABLED` | Supplier catalogue sync | All deployed | B/R | No | Must be `false`; not implemented |
| `ANALYTICS_ENABLED` | Analytics | All deployed | B/R | No | Must be `false`; legacy flag rejected by preflight. First-party analytics is always available with consent |
| `STAGING_ACCESS_ENABLED` | Staging access gate | All deployed | B/R | No | Must be `false`; not implemented |
| `MAINTENANCE_BANNER_ENABLED` | Maintenance banner | Optional | R | No | Safe boolean |

### Mock commerce and integrations

| Variable | Purpose | Required | Scope | Secret | Notes |
| --- | --- | --- | --- | --- | --- |
| `MOCK_PAYMENT_WEBHOOK_SECRET` | Signs mock payment webhooks | Preview/staging | B/R | **Yes** | Not required in production; mock webhook returns 404 there |
| `MOCK_SUPPLIER_FAIL_ONCE` | Simulates one supplier failure | Optional | R | No | Mock only; never production |
| `PAYMENT_PROVIDER` | Selects the payment adapter | Optional | B/R | No | Defaults to `mock`; production mock checkout is disabled by code. Leave unset for this deployment. `whop` requires the complete Whop configuration and approval |
| `EMAIL_PROVIDER` | Reserved provider label | Reserved | — | No | Not read by the current build |
| `SUPPLIER_DEFAULT` | Reserved supplier label | Reserved | — | No | Not read by the current build |
| `WHOP_COMPANY_API_KEY` | Whop Account API key | Optional | R | **Yes** | Adapter is implemented and fail-closed. A credential exists only in the local environment; never copy it into a commit or report |
| `WHOP_WEBHOOK_SECRET` | Whop webhook signing secret | Optional | R | **Yes** | Required before Whop checkout can be enabled; not configured locally |
| `WHOP_SANDBOX` | Whop sandbox toggle | Optional | R | No | Must be explicit `true`/`false` when `PAYMENT_PROVIDER=whop`; currently `false` locally and inactive |
| `WHOP_ACCOUNT_ID` | Whop business account ID | Optional | R | No | `biz_...`; required by the discovery script, optional for checkout when the Account API key is scoped to one business |
| `WHOP_PLAN_VARIANT_MAP` | ESIMPROVE plan → Whop variant map | Optional | R | No | Currently `{}`; the Whop catalogue has 0 products and 0 variants, so no mapping exists |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_API_VERSION`, `STRIPE_LIVE_MODE` | Reserved Stripe placeholders | Reserved | — | **Some** | Not read by the current build |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_WEBHOOK_SECRET`, `EMAIL_TEST_RECIPIENT` | Reserved email placeholders | Reserved | — | **Some** | Not read by the current build |
| `ESIM_ACCESS_*`, `ESIM_GO_*`, `SUPPLIER_BALANCE_RESERVE_MINOR` | Reserved supplier placeholders | Reserved | — | **Some** | No live supplier transport exists; see N-07 |

### Observability, legal, and local tooling

| Variable | Purpose | Required | Scope | Secret | Notes |
| --- | --- | --- | --- | --- | --- |
| `HEALTH_CHECK_TOKEN` | Enables detailed `/api/health` diagnostics | Optional | R | **Yes** | Public health response never includes secrets |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`, `ADMIN_TOTP_SECRET`, `ADMIN_CREATE_CONFIRM` | One-off production admin bootstrap | Admin tooling | M | **Yes** (password/TOTP) | Read only by `npm run admin:create`; never set in the Functions runtime; keep out of logs |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, `LOG_LEVEL` | Reserved observability placeholders | Reserved | — | **Some** | Not read by the current build |
| `LEGAL_ENTITY_*`, `SUPPORT_EMAIL`, `SECURITY_EMAIL`, `ABUSE_EMAIL` | Legal/content placeholders | Reserved | — | No | Not read by the current build; legal review outstanding |
| `STAGING_BASIC_AUTH_USER`, `STAGING_BASIC_AUTH_PASSWORD_HASH`, `STAGING_ALLOWED_HOSTS` | Reserved staging protection | Reserved | — | **Some** | Not implemented |
| `TAX_MODE`, `TAX_RATE_TABLE_VERSION` | Reserved tax configuration | Reserved | — | No | Tax remains disabled |
| `DEFAULT_LOCALE`, `DEFAULT_CURRENCY` | Reserved branding values | Reserved | — | No | Not read by the current build |
| `SMOKE_BASE_URL`, `SMOKE_AUTH_COOKIE` | Local smoke-test inputs | Local | Local | **Cookie** | Not application configuration |

---

## 3. Build-time versus runtime

The Netlify preflight runs before `next build` and reads the deployed configuration. Therefore
the variables marked **B** must be available to the **Builds** scope, not only to Functions.
They are also needed by Functions at runtime. If the Netlify plan allows separate scopes, enable
both. Variables default to all scopes.

`DATABASE_MIGRATION_URL` should **not** be added to the runtime Functions scope. It is used only
by the migration/seed commands. Keeping it out of runtime reduces the chance of a pooled app
connection being replaced by a direct one.

`NEXT_PUBLIC_SITE_NAME` is public and embedded in client output. Never prefix a secret with
`NEXT_PUBLIC_`.

---

## 4. Secret handling

- Mark database URLs, auth/KEK/job/rate-limit/mock webhook secrets, demo passwords, TOTP seeds,
  `HEALTH_CHECK_TOKEN`, Whop credentials, and any reserved provider keys as secrets in Netlify.
- Use different values for local, preview, staging, and production. Never copy production secrets
  into a preview.
- Do not print secrets in build logs, screenshots, tickets, or chat. The preflight prints only
  variable names and safe context identifiers.
- Rotate a secret in the provider and Netlify, then redeploy. Rotating `ACTIVATION_KEK_V1`
  requires keeping the previous version available for decryption during migration.
- If a preview ever used production credentials, treat the production secret as compromised,
  rotate it, and investigate access logs.
- `.env.local` is local-only and gitignored. It must never be committed or uploaded.

---

## 5. Current configuration status

| Item | Status |
| --- | --- |
| Netlify site/environment variables | Not created — owner action |
| Preview PostgreSQL database | Not provisioned; create an isolated Neon branch/database before enabling previews |
| Production PostgreSQL database | Neon project `esimprove` created; not configured in Netlify, connected, or migrated |
| Neon credentials file | Present on the owner's Desktop, outside this repository; excluded by `.gitignore` |
| Production domain/DNS/HTTPS | `esimprove.com` registered but parked on Hostinger (`2.57.91.91`); not connected to Netlify — owner action |
| Whop integration | Prepared and fail-closed; permissions verified, catalogue empty, live checkout disabled |
| Live payment credentials | Local Whop key only; no Netlify scope, no webhook secret, no plan mapping |
| Live supplier credentials/approval | None — externally blocked; N-07 open |
| Live email domain/provider | None — externally blocked |
| Production secrets/KEKs | Not generated or stored in this repository |
| First-party analytics HMAC secret | Not generated — use a dedicated `ANALYTICS_HASH_SECRET` per context |
| Google Search Console verification | Not configured — requires a real domain and external GSC action |
| Optional GA4 measurement ID | Not configured — stored in SEO settings, not env vars |
| Local `.env.local` | Present for local demo only; values not disclosed |

The application fails closed when a deployed context is missing required configuration. It does
not silently fall back to local demo secrets, PGlite, or mock production commerce.
