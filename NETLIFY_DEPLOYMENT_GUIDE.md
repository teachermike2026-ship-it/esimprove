# Netlify Deployment Guide — Esimprove

**Status:** Local deployment configuration and documentation only. No Netlify site, deploy,
database, domain, DNS record, or provider credential exists. Nothing in this guide has been
executed against Netlify or a production database.

**Applies to:** Next.js 16.4.2, React 19.3.1, App Router, npm with `package-lock.json`.

---

## 1. Confirmed build and runtime settings

Netlify supports Next.js 16 through its automatically installed OpenNext adapter. Do **not** add
`@netlify/plugin-nextjs` or another Next.js plugin; it would pin an outdated adapter and conflict
with the supported zero-config integration.

| Setting | Value | Notes |
| --- | --- | --- |
| Framework preset | Next.js | Auto-detected by Netlify |
| Base directory | Repository root (blank) | `netlify.toml` is at the root |
| Build command | `npm run netlify:preflight && npm run build` | Set in `netlify.toml` |
| Publish directory | `.next` | Next.js output; Netlify's adapter handles functions/assets |
| Node.js version | 22 | `NODE_VERSION = "22"` in `netlify.toml` |
| Package manager | npm | `package-lock.json` is committed; Netlify runs `npm ci` |
| Next.js plugin | None | OpenNext adapter is automatic |

`npm run netlify:preflight` validates deployment configuration before the Next.js build. It does
**not** connect to the database or call any provider. It fails the build with a list of missing or
unsafe variable names when the deploy context is incomplete.

The application uses server-side rendering for every page because the root layout declares
`dynamic = "force-dynamic"`. The build output includes the proxy (middleware), route handlers,
and Server Actions. There are no static pages that need build-time database access.

---

## 2. Prerequisites

Before the first deploy, the owner must provide or approve:

1. A Git repository containing the reviewed, committed tree. The current working tree contains
   uncommitted changes; commit and push only after review and explicit authorization.
2. A Netlify account and permission to create a site.
3. A PostgreSQL provider and two isolated databases:
   - a preview/staging database for deploy previews;
   - a production database.
4. Provider connection strings:
   - a pooled/session-mode URL for the application runtime (`DATABASE_URL`);
   - a direct or session-mode URL for migrations (`DATABASE_MIGRATION_URL`).
5. New secrets for each context: `AUTH_SECRET`, `ACTIVATION_KEK_V1`,
   `SUPPLIER_CREDENTIAL_KEK` (production), `INTERNAL_JOB_SECRET`,
   `RATE_LIMIT_HASH_SECRET`, and `MOCK_PAYMENT_WEBHOOK_SECRET` for preview/staging only.
6. A verified HTTPS origin (`SITE_URL`) for each context. A custom domain is optional for a
   deploy preview but required for a real production launch.

Do not reuse local demo secrets, the preview database, or preview secrets in production.

---

## 3. Environment model

`APP_ENV` identifies the deploy context explicitly. `NETLIFY=true` is a platform signal and does
**not** select production.

| Context | `APP_ENV` | `DATABASE_ENV` | Demo mode | Database | Public origin |
| --- | --- | --- | --- | --- | --- |
| Local | `local` | `local` | `true` | PGlite | `http://localhost:3000` |
| Deploy preview | `preview` | `preview` | `true` | Isolated preview DB | Preview/branch URL |
| Staging branch | `staging` | `staging` | `true` recommended | Isolated staging DB | Staging URL |
| Production | `production` | `production` | `false` | Production DB | Verified HTTPS domain |

Rules enforced by the code:

- `DATABASE_ENV` must equal `APP_ENV` in every deployed context.
- Preview and staging are `noindex`, and all live integration flags must remain `false`.
- Production requires demo mode and demo seeding to be off.
- Production disables mock payments, mock supplier fulfillment, and mock email. Checkout is
  unavailable until a real payment provider is approved and implemented.
- Deployed contexts refuse to start on PGlite; `DATABASE_URL` is mandatory.
- Deployed PostgreSQL is never auto-migrated. Run migrations explicitly.

See `NETLIFY_ENVIRONMENT_VARIABLES.md` for the complete variable inventory.

### Preview origin caveat

Netlify exposes `URL`, `SITE_NAME`, and `SITE_ID` to functions at runtime. `CONTEXT`,
`DEPLOY_PRIME_URL`, and `DEPLOY_URL` are build-time only. Because each deploy preview has a
unique URL, `SITE_URL` cannot be discovered automatically at function runtime.

Set `SITE_URL` to the stable preview/branch URL for the preview context, or update it for a
specific preview when absolute links and metadata matter. Relative navigation and cookies work
regardless. Never point preview `SITE_URL` at the production domain.

---

## 4. Database preparation

### Provider requirements

- PostgreSQL reachable from Netlify Functions over TLS.
- A pooled connection string for runtime, and a direct/session connection for migrations.
  Transaction-mode poolers are not suitable for session advisory locks; use a direct or
  session-mode connection for `DATABASE_MIGRATION_URL`.
- Backups and point-in-time recovery enabled before the first production migration.
- A connection limit compatible with serverless concurrency. The app defaults to
  `DATABASE_POOL_MAX=3` in deployed contexts; each function instance owns a pool.
- Prefer a provider region close to the Netlify Functions region.

No provider is selected or assumed by this repository. Do not invent a hostname or credentials.

### Fresh database initialization

Run migrations once against the empty database using the direct/session URL:

PowerShell:

```powershell
$env:APP_ENV = "preview"
$env:DATABASE_ENV = "preview"
$env:DATABASE_MIGRATION_URL = "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
npm.cmd run db:migrate
```

Bash:

```bash
APP_ENV=preview \
DATABASE_ENV=preview \
DATABASE_MIGRATION_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require' \
npm run db:migrate
```

For production, use `APP_ENV=production` and `DATABASE_ENV=production` with the production
direct/session URL. The script prints the database hostname and confirms the dialect; it never
prints the password.

Migrations are applied in filename order in one transaction per file. PostgreSQL uses a
dedicated connection and a session advisory lock so concurrent deploys cannot interleave.
Applied migrations store a SHA-256 checksum; editing an applied file aborts the run. Create a new
migration instead.

### Existing database upgrades

Phase 4 adds `db/migrations/0005_seo_blog_analytics.sql` (SEO settings, blog/CMS tables, and
first-party analytics tables). Apply it with the normal migration command **before** deploying the
application version that reads those tables. The migration is forward-only and is safe to run once;
the migration runner records its checksum.

1. Take a provider backup or confirm point-in-time recovery.
2. Review every new SQL file in `db/migrations/`.
3. Run `npm run db:migrate` with the production direct/session URL.
4. Publish the app deploy that requires the new schema.
5. Verify `/api/health` and the affected flows.

Migrations are forward-only. Do not delete rows or rewrite applied migration files to force a
rollback.

### Preview database

Create a separate database for preview/staging. Do not copy production data into it. Set
`DATABASE_URL`, `DATABASE_MIGRATION_URL`, and `DATABASE_ENV=preview` only in the preview context.
If you seed demo content, run:

```powershell
$env:APP_ENV = "preview"
$env:DATABASE_ENV = "preview"
$env:SEED_DEMO_DATA = "true"
$env:DATABASE_MIGRATION_URL = "postgresql://USER:PASSWORD@PREVIEW_HOST:5432/PREVIEW_DB?sslmode=require"
npm.cmd run db:seed
```

`db:seed` refuses to run when `APP_ENV=production`.

### Connection and TLS behaviour

- `DATABASE_SSL=require` verifies the provider certificate. It no longer disables certificate
  verification.
- Use `DATABASE_SSL_CA` only when the provider requires a private CA. Never commit a private key.
- `DATABASE_SSL=disable` and `sslmode=disable` are rejected in deployed contexts.
- Runtime errors return generic responses; detailed diagnostics are available only from
  `/api/health` with `HEALTH_CHECK_TOKEN`.

---

## 5. Import the repository into Netlify

1. Sign in to Netlify and choose **Add new site → Import an existing project**.
2. Connect the Git provider and select the Esimprove repository.
3. Select the branch to deploy. Use `main` for production, or a dedicated branch for staging.
4. Confirm the detected settings match Section 1. `netlify.toml` supplies the build command,
   publish directory, and Node version. Do not add a Next.js plugin.
5. Before the first deploy, add the environment variables for the selected context. At minimum,
   a deployed build needs `APP_ENV`, `DATABASE_ENV`, `DATABASE_URL`, `SITE_URL`,
   `DEMO_MODE`, `SEED_DEMO_DATA`, `AUTH_SECRET`, `ACTIVATION_KEK_V1`,
   `INTERNAL_JOB_SECRET`, `RATE_LIMIT_HASH_SECRET`, and context-appropriate mock/payment values.
6. Deploy. The preflight runs before the build.

If the build fails in the preflight, read the listed variable names, fix the values for that
deploy context, and redeploy. The preflight does not require database connectivity.

---

## 6. Deploy preview setup

1. Enable deploy previews for the site.
2. Add preview-scoped values:
   - `APP_ENV=preview`
   - `DATABASE_ENV=preview`
   - `DEMO_MODE=true`
   - `SEED_DEMO_DATA=true` (only if you want demo catalogue seeding)
   - preview-only `DATABASE_URL` and `DATABASE_MIGRATION_URL`
   - preview-only secrets
   - `SITE_URL` set to the stable preview/branch origin
   - all live flags `false`
3. Run the preview migrations once with the preview direct/session URL.
4. Open the deploy preview and confirm:
   - `/api/health` returns 200 and the public status is `ok`;
   - `robots.txt` disallows indexing;
   - the demo banner is present;
   - login works with preview demo credentials, if seeded;
   - adding to cart and mock checkout work;
   - the mock webhook rejects an unsigned request with 400;
   - preview pages never show production order or customer data.
5. Review function logs for configuration or database errors.

A deploy preview is not a production rehearsal for live money, email, or supplier provisioning.

---

## 7. Production deployment

Only proceed when the production blockers in `NETLIFY_DEPLOYMENT_BLOCKERS.md` are resolved or
explicitly accepted by the owner.

1. Confirm the production PostgreSQL database exists, is backed up, and has migrations applied.
2. Set production-scoped variables:
   - `APP_ENV=production`, `DATABASE_ENV=production`
   - `DEMO_MODE=false`, `SEED_DEMO_DATA=false`
   - `SITE_URL=https://<verified-domain>`
   - production `DATABASE_URL` (pooled) and `DATABASE_MIGRATION_URL` (direct/session)
   - new production secrets and KEKs
   - all live flags `false` for this build
   - `ADMIN_2FA_REQUIRED=true`
3. Create the first production administrator after migrations with the guarded bootstrap
   command. Do not seed demo users in production.

   PowerShell:

   ```powershell
   $env:APP_ENV = "production"
   $env:DATABASE_ENV = "production"
   $env:DATABASE_MIGRATION_URL = "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
   $env:ACTIVATION_KEK_V1 = "BASE64_32_BYTE_KEY"
   $env:ADMIN_EMAIL = "admin@example.com"
   $env:ADMIN_PASSWORD = "A-LONG-UNIQUE-PASSWORD"
   $env:ADMIN_TOTP_SECRET = "BASE32_AUTHENTICATOR_SECRET"
   $env:ADMIN_CREATE_CONFIRM = "CREATE"
   npm.cmd run admin:create
   ```

   Remove those variables from the shell afterwards. The command prints neither the password
   nor the TOTP secret. Enrol the TOTP secret in the administrator's authenticator immediately.
   The script refuses to overwrite an existing email and refuses production without
   `ADMIN_CREATE_CONFIRM=CREATE`.

4. Run migrations with the production direct/session URL.
5. Trigger the production deploy.
6. Verify `/api/health`, HTTPS, headers, login/logout, catalogue availability, account pages,
   and the expected checkout-disabled state (no live payment provider is implemented).
7. Confirm `/api/webhooks/payments/mock` returns 404 and that no mock payment page is reachable.
8. Confirm no real email is claimed as delivered. Password reset email remains unavailable until
   a live provider is configured.
9. Review logs for secrets, stack traces, or unexpected provider calls.

Do not enable `PAYMENTS_LIVE_ENABLED`, `SUPPLIER_LIVE_ENABLED`, `EMAIL_LIVE_ENABLED`,
`CATALOGUE_SYNC_ENABLED`, `ANALYTICS_ENABLED`, or `STAGING_ACCESS_ENABLED` for this build. The
configuration check rejects them because the adapters are not implemented.

---

## 8. Domain and HTTPS

1. Add the custom domain in Netlify and follow the displayed DNS instructions at the owner's DNS
   provider. This guide does not create or change DNS records.
2. Wait for Netlify's managed certificate to become active.
3. Set `SITE_URL` to the final `https://` origin and redeploy.
4. Confirm HTTP redirects to HTTPS and that session/cart cookies are `Secure`.
5. Keep `SITE_URL` free of a trailing slash and do not use `localhost` in a deployed context.

The application adds HSTS only for a production build. Do not enable HSTS on a domain that is not
fully committed to HTTPS.

---

## 9. Post-deployment smoke tests

Unauthenticated route smoke test:

```powershell
$env:SMOKE_BASE_URL = "https://YOUR-DEPLOY-URL"
npm.cmd run smoke
```

The script checks public routes, protected redirects, API authorization, the health endpoint, and
a missing route. It does not perform browser, keyboard, or accessibility testing.

Health:

```powershell
curl.exe -i https://YOUR-DEPLOY-URL/api/health
curl.exe -i -H "x-health-token: YOUR-HEALTH-TOKEN" https://YOUR-DEPLOY-URL/api/health
```

The public response reports only status and check names. The detailed response adds the app
context, database dialect, integration modes, and flag values; it never includes secret values.

Manual checks:

- Homepage, plans, destinations, regions, search, guides, FAQ, legal pages, sitemap, robots.
- Register, login, logout, customer portal, order lookup.
- Cart, preview mock checkout, mock payment success/failure, order details, license/activation.
- Admin login with 2FA, dashboard, orders, finance, refunds, suppliers, capabilities, settings.
- Admin → SEO & CMS: settings save, health cards render, sitemap link returns the expected policy.
- Admin → Blog & articles: create a draft, publish it, verify `/blog` and `/blog/<slug>`; unpublish
  and verify the article and its sitemap URL disappear.
- Admin → Analytics: the dashboard renders an honest empty state (or real data); internal/admin
  traffic is excluded; date range and tabs load without invented numbers.
- `/api/track`: GET returns 405, malformed JSON returns 400, and a valid consented event batch
  returns 202. DNT/GPC requests return 204 without storage.
- Preview: demo labels and noindex are present.
- Production: mock payment routes return 404 and checkout is unavailable; demo/noindex hard rails
  are off only when `APP_ENV=production` and `DEMO_MODE=false`.
- Browser console, hydration, responsive layouts, and accessibility are not covered by the
  route smoke script. Run those checks separately with a real browser suite before claiming them.
- Analytics accuracy is not provable from a smoke test. Confirm consent, real traffic, and report
  values against database rows before making any claim about visitors or conversions.

---

## 10. Rollback

### Application rollback

1. Open **Deploys** in Netlify.
2. Select the last known-good deploy and choose **Publish deploy**.
3. Verify `/api/health`, login, and the affected flows.

### Database rollback

There is no automatic schema rollback. Migrations are forward-only. If a migration must be
undone, restore from the provider backup/PITR according to the provider's procedure, or write a
reviewed compensating migration. Never edit an applied migration file.

### Secrets rollback

Restoring an old deploy does not restore rotated environment variables. If a secret leaked,
rotate it in the provider and Netlify, then redeploy. Preview and production secrets are
separate; rotating one must not break the other.

---

## 11. Netlify Functions constraints

- Synchronous function execution: 60 seconds.
- Scheduled functions: 30 seconds, but no Netlify scheduled function is defined in this project.
- Background functions: up to 15 minutes, but none are defined.
- Buffered request payload: 6 MB; streamed response: 20 MB.
- No persistent local filesystem and no long-lived background process.

The current routes are short database-backed requests. Payment webhooks run outbox/job processing
inline; keep orders small and monitor duration. `/api/jobs/run` is authenticated with
`INTERNAL_JOB_SECRET` but has no scheduler in this repository. Phase 4 scheduled blog publication
and analytics retention cleanup run from that endpoint. If automatic retries, scheduled
fulfillment, or scheduled publishing are required, configure a scheduler or queue and document it;
do not claim that Netlify runs it automatically. A Netlify scheduled function must be created and
configured explicitly (it is not defined here), or an external scheduler must call
`POST /api/jobs/run` with the secret.

There are no outbound supplier, payment, or email HTTP calls in this build. Live supplier
transport remains blocked by N-07 (see the blockers document).

---

## 12. Phase 4 — SEO, blog, and first-party analytics

### What works without extra services

- Global SEO settings are stored in PostgreSQL (`seo_settings`), editable at `/admin/seo`.
- Per-page metadata, canonical URLs, Open Graph/Twitter tags, and WebSite/WebPage/Organization
  JSON-LD are rendered dynamically. Blog articles add Article and BreadcrumbList JSON-LD.
- `/sitemap.xml` is generated from the database and includes only published, due blog articles and
  categories with published articles. `/robots.txt` blocks admin, portal, checkout, orders, and
  API routes in production.
- The blog CMS at `/admin/blog` supports drafts, publish/unpublish, future scheduling, categories,
  tags, search/filter, author attribution, featured images (hosted URLs only), per-article SEO, and
  server-side HTML sanitization.
- Public `/blog`, `/blog/[slug]`, `/blog/category/[slug]`, and `/blog/tag/[slug]` pages show only
  published articles whose `published_at` is due.
- First-party analytics collects anonymous events at `POST /api/track` into PostgreSQL. Reports at
  `/admin/analytics` cover overview, geography, pages, games, activities, and traffic
  sources/devices. Internal/admin/bot traffic is stored as internal and excluded from reports.
- The optional GA4 tag renders only when a measurement ID is saved in SEO settings and the deploy
  is not demo/preview/staging.

### External configuration required

| Item | Where it is configured | Notes |
| --- | --- | --- |
| PostgreSQL schema | Run `npm run db:migrate` | Applies `0005_seo_blog_analytics.sql`; required before Phase 4 routes work |
| Public origin | `SITE_URL` | Used for canonical URLs, sitemap, robots, and absolute links |
| Canonical base | Admin → SEO & CMS | Stored in DB; takes precedence over `SITE_URL` for sitemap/canonical output |
| Google Search Console | Admin → SEO & CMS | Paste the verification token, deploy, verify ownership in GSC, then submit `/sitemap.xml`. GSC ownership and indexing are external and are **not** automated. |
| GA4 (optional) | Admin → SEO & CMS | Only renders when a valid `G-…` ID is saved and the deploy is indexable; third-party data is not used for the first-party dashboard |
| Analytics hash secret | `ANALYTICS_HASH_SECRET` | Recommended per-context secret. Falls back to `RATE_LIMIT_HASH_SECRET`/`AUTH_SECRET`; set a dedicated value in preview and production |
| Analytics retention | `data_retention_settings` | No environment variable. Reviewed defaults: 395 days for raw events and 730 days for aggregated sessions/visitors. Configured in Admin → Legal & compliance; cleanup runs from `/api/jobs/run` |
| Tracking kill switch | `NEXT_PUBLIC_ANALYTICS_DISABLED=true` | Optional. Makes `/api/track` return 204 before any storage |
| Scheduled publishing | External scheduler or a Netlify scheduled function | Must call `POST /api/jobs/run` with `INTERNAL_JOB_SECRET`. No scheduler is defined in this repository |
| Blog media | Any HTTPS-hosted image URL | Local filesystem uploads are not persisted on Netlify; the CMS deliberately accepts hosted URLs only |

### Limitations and non-claims

- Saving a verification token does not verify Search Console ownership, and publishing an article
  does not guarantee Google indexing. Both require external action and time.
- Country reports are populated only when the hosting platform supplies a country header
  (`x-country`, `x-nf-country`, `cf-ipcountry`, or `x-vercel-ip-country`). Missing headers produce
  an honest `Unknown` bucket; countries are never inferred or fabricated.
- The current site has no games section. The Games tab therefore shows an honest empty state until
  game pages emit `game_opened`/`game_started`/`game_completed`/`game_exited` events with a stable
  `gameId`.
- Analytics requires affirmative consent. DNT/GPC requests and unconsented visitors are not stored.
  The dashboard is empty until real consented traffic arrives; no demo analytics are generated.
- First-party analytics is not a substitute for legal/privacy review. The privacy and cookie
  policies must be reviewed before production.
- No third-party analytics provider is required. GA4 is optional; if enabled, its own consent and
  data-processing obligations apply.

---

## 13. Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Build stops at `netlify:preflight` | Missing/unsafe env var for the deploy context | Read the listed names; set context-scoped values; redeploy |
| `APP_ENV must be set explicitly` | Netlify build without `APP_ENV` | Set `APP_ENV=preview`, `staging`, or `production` |
| `DATABASE_ENV ... must match APP_ENV` | Preview using production DB context or vice versa | Fix context scoping; verify the connection string |
| 503 `Service configuration error` | Runtime config failed the same checks | Use `/api/health` with `HEALTH_CHECK_TOKEN`; inspect function logs |
| `DATABASE_URL is required ... refusing PGlite` | Deployed context has no database URL | Set `DATABASE_URL`; PGlite is local-only |
| Database check fails | TLS, pool exhaustion, allowlist, wrong URL | Verify `DATABASE_SSL=require`, pooled/direct URLs, provider status |
| Migration checksum mismatch | An applied SQL file was edited | Restore the original file; create a new migration |
| Mock webhook returns 404 | Production has mock commerce disabled | Expected; use preview for mock checkout |
| Password reset sends no email | No live email provider | Expected; configure and approve a provider before claiming delivery |
| Preview shows production data | Preview and production share `DATABASE_URL` | Stop the deploy, rotate preview secrets, fix per-context scoping |

---

## 14. Explicit non-goals

This guide does not authorize or perform:

- connecting to or modifying the owner's Netlify account;
- creating a site, deploy, DNS record, or certificate;
- running migrations against production or an unknown database;
- enabling live payments, supplier fulfillment, email, refunds, third-party analytics beyond the
  optional GA4 tag, or catalogue sync;
- committing or pushing the working tree.

Those actions require owner credentials, infrastructure, and explicit approval.
