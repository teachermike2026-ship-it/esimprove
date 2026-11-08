# Netlify Production Checklist — Esimprove

**Status:** Checklist only. No box below is evidence that a Netlify deploy, production database,
domain, or provider operation has occurred. Check a box only after recording dated evidence.

Use this list before a **deploy preview** and again before **production**. A deploy preview is
allowed to use labelled mock commerce; production is not.

---

## A. Repository and build gate

- [ ] Working tree reviewed; no unintended files, secrets, or local databases are staged.
- [ ] `.env.local`, `.pglite/`, build output, and credentials are untracked (`.gitignore` verified).
- [ ] The reviewed changes are committed and pushed only with owner authorization.
- [ ] `package-lock.json` matches `package.json`; Netlify can run `npm ci` reproducibly.
- [ ] `npm.cmd run typecheck` passes.
- [ ] `npm.cmd run lint` passes with zero errors; any remaining warnings are reviewed and
      documented (Phase 4 has six intentional `<img>` warnings for remote CMS images).
- [ ] `npm.cmd test` passes; migration, auth, security, and integration tests included.
- [ ] `npm.cmd run build` passes from the lockfile.
- [ ] `smoke-test.mjs` passes against the built local app.
- [ ] `netlify.toml` uses Node 22, `npm run netlify:preflight && npm run build`, publish `.next`.
- [ ] No `@netlify/plugin-nextjs` or other Next.js adapter plugin is added.
- [ ] Netlify's detected framework is Next.js; no conflicting output/export setting.

## B. Netlify site configuration

- [ ] Netlify site created by the owner; deploy previews enabled (if previews are required).
- [ ] Production branch selected deliberately (normally `main`).
- [ ] Build settings match `NETLIFY_DEPLOYMENT_GUIDE.md` Section 1.
- [ ] Function/runtime region and plan reviewed for expected traffic.
- [ ] No environment variable is set only in `netlify.toml`; secrets are in Netlify's env store.
- [ ] Deploy notifications/log access are configured for the owner.

## C. Environment and secret gate

- [ ] `APP_ENV` is set explicitly for each context (`preview`, `staging`, `production`).
- [ ] `DATABASE_ENV` equals `APP_ENV` in every deployed context.
- [ ] `SITE_URL` is the correct HTTPS origin for that context, with no trailing slash.
- [ ] `DEMO_MODE=false` and `SEED_DEMO_DATA=false` for production.
- [ ] `DEMO_MODE=true` for preview; staging decision documented.
- [ ] All live integration flags are `false`: payments, supplier, email, catalogue sync,
      `ANALYTICS_ENABLED`, staging access. First-party analytics is separate from this legacy flag.
- [ ] `AUTH_SECRET`, `ACTIVATION_KEK_V1`, `INTERNAL_JOB_SECRET`, and
      `RATE_LIMIT_HASH_SECRET` are unique per context and marked secret.
- [ ] `ANALYTICS_HASH_SECRET` is a dedicated per-context secret (or an explicitly accepted
      documented fallback); preview, staging, and production values differ.
- [ ] `data_retention_settings` matches the approved policy: 395 days for raw
      events and 730 days for aggregated sessions/visitors, with automation
      enabled only for those two categories. There is no retention environment
      variable.
- [ ] `NEXT_PUBLIC_ANALYTICS_DISABLED` is unset/`false` in production unless tracking is
      intentionally disabled.
- [ ] `SUPPLIER_CREDENTIAL_KEK` is present in production and differs from the activation KEK.
- [ ] `SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK=false` in production.
- [ ] `ADMIN_2FA_REQUIRED=true` in every deployed context.
- [ ] `MOCK_PAYMENT_WEBHOOK_SECRET` is present in preview/staging and absent or unused in
      production.
- [ ] `HEALTH_CHECK_TOKEN` set if detailed health diagnostics are required (optional).
- [ ] `DATABASE_MIGRATION_URL` is available only to the migration operator, not the runtime.
- [ ] No secret appears in Git, build logs, screenshots, tickets, or client bundles.
- [ ] Preview and production secret values are different.

## D. Database gate

- [ ] PostgreSQL provider selected; no fabricated hostname or credential.
- [ ] Preview/staging and production databases are physically separate.
- [ ] Database is reachable from Netlify Functions over TLS.
- [ ] Runtime uses a pooled/session-mode `DATABASE_URL`; migrations use a direct/session
      `DATABASE_MIGRATION_URL`.
- [ ] `DATABASE_SSL` is `require` (or stronger); certificate verification is not disabled.
- [ ] Provider CA configured via `DATABASE_SSL_CA` only if required.
- [ ] `DATABASE_POOL_MAX` sized against the provider connection limit and expected concurrency.
- [ ] Backups and point-in-time recovery are enabled before the first production migration.
- [ ] Fresh database migrations applied and verified.
- [ ] Existing database upgrade process reviewed; new migrations are additive or compatible.
- [ ] `db/migrations/0005_seo_blog_analytics.sql` reviewed and applied before deploying the app
      version that reads `seo_settings`, blog tables, and analytics tables.
- [ ] Migration ran with the deployed context values and a dedicated connection.
- [ ] `schema_migrations` checksums are present; no applied migration file was edited.
- [ ] Demo seed ran only against an isolated preview/staging database, never production.
- [ ] Production has a real administrator account created with `npm run admin:create` (or a
      reviewed equivalent); no demo administrator is seeded.
- [ ] The production admin password and TOTP secret were transferred out-of-band and not logged.

## E. Deploy preview gate

- [ ] Preview preflight passes in the Netlify build log.
- [ ] Preview build succeeds with the production build command.
- [ ] `/api/health` returns 200 with `status: ok`.
- [ ] Detailed health (with token) reports the preview context and preview database dialect.
- [ ] `robots.txt` disallows indexing; metadata is `noindex`.
- [ ] Demo banner/labels are visible; mock payment and mock email are clearly labelled.
- [ ] Homepage, catalogue, search, cart, mock checkout, order details, and portal work.
- [ ] Login, logout, and admin 2FA work with preview-only demo credentials.
- [ ] Unsigned mock webhook returns 400; no real payment is presented as successful.
- [ ] Preview cannot read or write production orders, customers, or credentials.
- [ ] No PGlite path is used in the preview runtime.
- [ ] Function logs contain no secrets, stack traces, or unexpected outbound calls.
- [ ] Browser, responsive (375/768/1280), console, hydration, and accessibility checks
      separately executed and recorded (not claimed from route smoke alone).

## F. Security gate

- [ ] HTTPS active for the deployed origin; HTTP redirects to HTTPS.
- [ ] Session and cart cookies are `Secure`, `HttpOnly`, and `SameSite=Lax`.
- [ ] HSTS present only on the production domain after HTTPS is permanent.
- [ ] Security headers present: CSP, `X-Frame-Options`, `X-Content-Type-Options`,
      `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control`.
- [ ] Admin routes require authentication and 2FA; authorization checked server-side.
- [ ] Server Actions and forms reject invalid input and unsafe redirect targets.
- [ ] Rate limiting works against the deployed database.
- [ ] Webhook signature verification is enforced; mock webhook disabled in production.
- [ ] Database queries are parameterized through Drizzle; no SQL injection path introduced.
- [ ] Error responses do not expose stack traces, connection strings, or secret names/values.
- [ ] Logs redact credentials, tokens, activation data, and personal data.
- [ ] Encryption KEKs are not stored in the database or client bundle.
- [ ] N-07 remains a blocker for live supplier traffic until the outbound transport enforces
      DNS/destination validation, resolved-address binding, redirect restrictions, timeouts,
      response-size limits, and safe logging.
- [ ] No fake supplier transport, mock payment, or mock email is presented as live in production.

## G. SEO, blog, and analytics gate (Phase 4)

- [ ] `/admin/seo` loads only for an administrator; saving settings persists to `seo_settings`.
- [ ] Canonical base, default OG image, organization details, and title template are correct for
      the production domain.
- [ ] `robots.txt` in production allows public pages and disallows `/admin`, `/api`, `/portal`,
      `/checkout`, `/orders`, `/cart`, and `/login`; preview/staging still disallow everything.
- [ ] `/sitemap.xml` contains only published, due blog articles and real public pages; it contains
      no drafts, scheduled/future articles, admin routes, or cross-context URLs.
- [ ] Google Search Console verification token is saved in SEO settings; the meta tag renders on
      the deployed site; ownership is actually verified in GSC (external action).
- [ ] `/sitemap.xml` is submitted in GSC; indexing is not claimed until Google reports it
      (external action).
- [ ] Optional GA4 ID is either blank or a verified `G-…` property; no GA4 data is used for the
      first-party dashboard.
- [ ] `/blog`, `/blog/[slug]`, category, and tag pages show only published, due articles; drafts and
      future-scheduled articles return 404 publicly.
- [ ] Blog CMS create/edit/delete, publish/unpublish, scheduling, categories, tags, search/filter,
      featured image + alt text, author attribution, and per-article SEO were exercised.
- [ ] Blog HTML is sanitized server-side; scripts, event handlers, iframes, and unsafe URLs are
      stripped on save and on render.
- [ ] Blog featured images use HTTPS-hosted URLs; no local filesystem upload path is used.
- [ ] Scheduled publishing is driven by an external scheduler calling `POST /api/jobs/run` with
      `INTERNAL_JOB_SECRET`; no automatic publishing is claimed without it.
- [ ] Consent banner blocks analytics until affirmative consent; DNT/GPC requests store nothing.
- [ ] Admin, portal, checkout, and internal/test traffic is excluded from analytics reports.
- [ ] The analytics dashboard is checked against real database rows after consented traffic; empty
      states remain honest (no fabricated visitors, geography, games, or conversions).
- [ ] Country reports display only platform-supplied country headers; missing headers remain
      `Unknown`.
- [ ] `POST /api/track` rejects cross-origin, malformed, oversized, and excessive payloads; GET
      returns 405.
- [ ] Retention cleanup runs from `/api/jobs/run`; deleting old rows was verified in the target
      database before claiming retention compliance.
- [ ] Privacy/cookie policy explicitly covers first-party analytics and the optional GA4 tag.

## H. Production launch gate

- [ ] Every item in Sections A–G is complete or explicitly waived by the owner in writing.
- [ ] Production domain added in Netlify; DNS configured by the owner; certificate active.
- [ ] `SITE_URL` updated to the final HTTPS domain and redeployed.
- [ ] Production environment variables are scoped to production only.
- [ ] Production migration completed and health is green.
- [ ] Production checkout is disabled (no live payment provider in this build), or a reviewed
      live provider has been implemented and separately approved.
- [ ] Password reset email is disclosed as unavailable until a live email provider exists.
- [ ] Live supplier, payment, refund, email, and catalogue operations remain disabled.
- [ ] Legal entity, terms, privacy, refunds, cookies, support, and tax review completed.
- [ ] Operator has a named on-call owner and a rollback rehearsal.
- [ ] Owner has explicitly authorized the public production deploy.

## I. Post-deploy verification

- [ ] `/api/health` public check returns 200 and `status: ok`.
- [ ] Detailed health check (with token) matches the expected context.
- [ ] `npm run smoke` with `SMOKE_BASE_URL` passes against the deployed URL.
- [ ] Homepage, plans, destinations, regions, search, guides, FAQ, legal, sitemap, robots load.
- [ ] Registration, login, logout, password-reset limitation, portal, and order lookup verified.
- [ ] Cart, mock checkout (preview only), order details, fulfillment status, license/activation
      verified.
- [ ] Admin dashboard, orders, finance, refunds, suppliers, capabilities, payments, settings
      verified with an authorized admin.
- [ ] Production mock webhook returns 404; no mock payment page is reachable.
- [ ] Public `/blog`, a published article, and its category/tag pages return 200; draft and
      future-scheduled slugs return 404.
- [ ] `/sitemap.xml` and `/robots.txt` match the deployed context; GSC verification meta tag is
      present when configured.
- [ ] Consent banner appears; declining consent, DNT, and GPC produce no stored analytics rows.
- [ ] A consented test visit reaches `/api/track`; the admin dashboard reflects it, and an
      admin-internal visit does not.
- [ ] No real email is claimed as delivered; no real supplier order is claimed as fulfilled.
- [ ] Browser console, hydration, responsive layouts, and accessibility separately verified.
- [ ] Function durations and payload sizes are within Netlify limits.
- [ ] Logs and alerts reviewed after the first traffic.

## J. Rollback readiness

- [ ] Last known-good Netlify deploy identified and publishable.
- [ ] Database backup/PITR confirmed and restore procedure documented by the provider.
- [ ] Migration rollback decision documented: compensating migration or provider restore.
- [ ] Secrets rotation procedure documented; old deploy does not restore old secrets.
- [ ] Domain/DNS rollback ownership and contacts confirmed.
- [ ] Owner knows that preview and production use separate databases and secrets.

---

## Sign-off

| Role | Name | Date | Decision |
| --- | --- | --- | --- |
| Owner |  |  |  |
| Deployment operator |  |  |  |
| Security/legal reviewer (if required) |  |  |  |

**Do not deploy to production while any live integration flag is true, any required secret is
missing, preview and production share a database, or N-07 is unresolved for live supplier
traffic.**
