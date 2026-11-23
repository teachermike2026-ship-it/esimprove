# ESIMPROVE — GitHub and Netlify Deployment Preparation Report

**Prepared:** 2026-11-23
**Scope:** Preparation only. No commit, push, GitHub repository change, Netlify site, deploy, DNS
change, database migration, data transfer, or live integration activation has occurred.
**Secrets:** No API key, account ID, connection string, token, or secret value appears in this
report.

> **Update (2026-11-23):** A Neon PostgreSQL project named `esimprove` now exists, with its
> connection strings stored outside this repository. Next.js 16.4.6 is applied to the main working
> tree and verified but not yet committed or pushed. See
> `ESIMPROVE_NEON_NETLIFY_SETUP_REPORT.md` for the current database and deployment status. The
> database and build rows below are superseded by that report.

---

## 1. Current status

| Area | Status |
| --- | --- |
| Git identity | Repository-local identity configured |
| GitHub remote | **Blocked** — points at a different account; intended repository returns 404 |
| Branch | `fix/master-remediation`, 9 commits ahead of `origin/main`, no upstream |
| Local changes | Present and intentionally preserved; nothing committed |
| Netlify configuration | Present and compatible with Netlify's zero-config Next.js adapter |
| Production build | 16.4.6 is applied in the main working tree; typecheck, lint, focused tests, build, and production audit pass. Not yet committed/pushed |
| Netlify site | **Not created** — requires owner approval/access |
| Production database | Neon project `esimprove` created; credentials outside the repo; not configured in Netlify or migrated |
| Domain | `esimprove.com` registered, still parked on Hostinger; DNS not pointed at Netlify |
| Whop | Adapter prepared and fail-closed; permissions verified; catalogue empty; checkout disabled |
| Payments / supplier / email | Disabled; no live operations |

---

## 2. Git identity and repository

### 2.1 Identity

Repository-local configuration:

```text
user.name  = mohamedouaarab-dotcom
user.email = mohamed.ouaarab17@gmail.com
```

The global Git identity was not changed (it remains unset). No token or credential was printed or
stored.

### 2.2 Remote mismatch — blocker

```text
origin  https://github.com/teachermike2026-ship-it/esimprove.git
branch  fix/master-remediation
```

- The remote repository is public and reachable read-only.
- The intended repository `https://github.com/mohamedouaarab-dotcom/esimprove` returns **HTTP 404**.
- The intended GitHub account page exists, but no repository with that name exists.
- `gh` (GitHub CLI) is not installed and no authenticated GitHub session is available.
- `origin/main` is the initial commit; local `HEAD` is 9 commits ahead.
- No upstream tracking branch is configured.

**Do not push until the owner confirms the target repository.** Pushing now would publish to the
wrong account or fail. Creating a GitHub repository, changing the remote, committing, and pushing
all require explicit approval.

### 2.3 Working tree

As of this preparation:

- 179 changed entries: 128 modified, 4 deleted, 47 untracked (the untracked count groups
  directories).
- The working tree contains substantial pre-existing work. It was not reset, cleaned, or
  overwritten.
- Four files are deleted in the working tree:
  - `app/checkout/pay/[paymentId]/actions.ts`
  - `components/badges.tsx`
  - `components/demo-banner.tsx`
  - `components/home/qr-demo.tsx`
- Review every change before staging. Do not use `git add -A` without reviewing the diff.

### 2.4 Tracked artifacts that should be removed before publishing

These log/backup files are already tracked and are not source code:

```text
proxy.err
proxy.out
proxy2.err
proxy2.out
server_proxy.err
server_proxy.out
server_smoke.err
server_smoke.out
server_smoke2.err
server_smoke2.out
whop.ts.BAK
```

They contain no detected secrets, but they should not be part of a deployment-ready source tree.
After review and approval, remove them from the index without deleting the local copies:

```powershell
git rm --cached proxy.err proxy.out proxy2.err proxy2.out `
  server_proxy.err server_proxy.out server_smoke.err server_smoke.out `
  server_smoke2.err server_smoke2.out whop.ts.BAK
```

`.gitignore` now excludes future `*.out`, `*.err`, `*.bak`, `*.BAK`, `*.orig`, and `*.rej` files.

---

## 3. Netlify compatibility

### 3.1 Confirmed configuration

| Setting | Value | Assessment |
| --- | --- | --- |
| Next.js | `16.4.6` (applied in the working tree, not committed) | Supported by Netlify's automatic OpenNext adapter; outside the security advisory range |
| React | `19.3.1` | Compatible |
| Node.js | `22` via `netlify.toml` | Compatible with Next.js 16 (`>=20.9`) |
| Package manager | npm `11.19.1`, `package-lock.json` present | Compatible; version exists |
| Build command | `npm run netlify:preflight && npm run build` | Valid; preflight does not connect to the DB |
| Publish directory | `.next` | Correct for the zero-config adapter |
| Netlify plugin | None | Correct; do not add `@netlify/plugin-nextjs` |
| Output | SSR, route handlers, Server Actions, `proxy.ts` | Supported by the adapter |

Netlify's official documentation confirms:

- Next.js 13.5 through the latest stable release is supported with zero configuration.
- Netlify installs devDependencies by default because it does not set `NODE_ENV`; the `tsx`
  preflight and build tooling therefore remain available.
- Middleware/Proxy is supported. Next.js 16's `proxy.ts` runs on the Node.js runtime; this project's
  proxy uses only Web Crypto and Fetch APIs, not filesystem or C++ addons.
- `next/image` uses Netlify Image CDN automatically.
- Server Actions, SSR, route handlers, redirects, rewrites, and headers are supported.

### 3.2 Evidence run locally

- `npm run typecheck` — passed.
- `npm run lint` — passed with no reported warnings.
- `npm run netlify:preflight` with `APP_ENV=local` — correctly skipped as a local context.
- `npm run netlify:preflight` with a complete set of **throwaway validation values** for
  `APP_ENV=production` — passed the configuration checks with no database connection attempted.
- `npm run build` with `PGLITE_DATA_DIR=memory://` — **see Section 3.3**.

These checks did not connect to a production database, create a checkout, send email, call a
supplier, or run a migration.

### 3.3 Build result

**Green on `next@16.4.6` in the main working tree (approved 2026-11-23).**

The earlier `next@16.4.2` build compiled all routes, including `ƒ Proxy (Middleware)`, then stopped
with the framework security gate:

```text
Error [SecurityFatalError]: Your version of Next.js is affected by a known security vulnerability.
```

`npm audit` had confirmed that `next@16.4.2` was in the affected range (`16.0.0 - 16.4.4`). The
non-major fix, `next@16.4.6` plus matching `eslint-config-next@16.4.6`, was verified in an isolated
worktree and then applied to the main checkout after owner approval. `react@19.3.1` satisfies the
peer dependency.

After `npm ci`, the main checkout passes typecheck, lint, 20 focused tests, the full production
build, and `npm audit --omit=dev` (0 vulnerabilities). The package/lockfile change is **not yet
committed or pushed**.

Recommended command:

```powershell
next upgrade --agent=security --internal-nudge-id=5deb40ae-9641-4d41-8e90-986015c55c0a
```

### 3.4 Compatibility notes and caveats

- The root layout is `force-dynamic`; `sitemap.ts` and `robots.ts` are also dynamic. No page requires
  build-time database access.
- `next.config.ts` traces `db/migrations/**/*` into the server output.
- PGlite and `pg` are external server packages.
- There are no local filesystem uploads; blog media uses external HTTPS URLs.
- `proxy.ts` emits a per-request CSP nonce and fails closed on missing deployment configuration.
- No Netlify scheduler or queue is defined. `/api/jobs/run` requires an external caller and
  `INTERNAL_JOB_SECRET`.
- The local checks ran on Node.js 24.22.0. Netlify is pinned to Node.js 22 in `netlify.toml`;
  Next.js 16 supports both (`>=20.9.0`), but no actual Netlify build has run.
- A deploy preview's URL is not known to functions at runtime; set a stable preview `SITE_URL` or
  update it per preview.
- Netlify Functions have a 60-second synchronous limit and no persistent filesystem.

---

## 4. Changes applied during preparation

| File | Change |
| --- | --- |
| `.gitignore` | Added `*.out`, `*.err`, `*.bak`, `*.BAK`, `*.orig`, `*.rej` |
| `.env.example` | Set the template `PAYMENT_PROVIDER` to empty; removed duplicate Whop assignments; documented the empty catalogue, required discovery account ID, and no invented mapping |
| `NETLIFY_ENVIRONMENT_VARIABLES.md` | Fixed `ANALYTICS_HASH_SECRET` fallback claim; marked `PAYMENT_PROVIDER` as read; updated Whop status; added `APP_URL`; updated domain status |
| `NETLIFY_DEPLOYMENT_GUIDE.md` | Updated status; documented `proxy.ts` support and devDependency behavior; added `ANALYTICS_HASH_SECRET`; corrected package install wording; updated Whop/checkout status; added concrete domain/DNS procedure; linked the migration plan |
| `NETLIFY_DEPLOYMENT_BLOCKERS.md` | Updated B-03/B-04; added B-16 for the GitHub remote mismatch; updated summary |
| `NETLIFY_PRODUCTION_CHECKLIST.md` | Updated the checkout gate to reflect the prepared but inactive Whop adapter |
| `README.md` | Updated stale status, domain, integration, and owner-action claims |
| `ESIMPROVE_NETLIFY_DEPLOYMENT_READINESS_REPORT.md` | Marked as a historical snapshot and corrected the Whop credential line |
| `docs/project/POSTGRES_MIGRATION_PLAN.md` | Added the external PostgreSQL migration and data-preservation plan |

No application logic, payment behavior, supplier behavior, email behavior, database file, or
`.env.local` was modified.

---

## 5. Database production readiness

### 5.1 Current state

- Local databases: `.pglite/` (original) and `.audit/impl-db/` (recovered). Both remain untouched
  and gitignored.
- Nine forward-only migrations in `db/migrations/`.
- 64 tables in the Drizzle schema.
- No external PostgreSQL provider, credentials, backups, or migration approval exists.
- Deployed contexts reject PGlite and require a PostgreSQL `DATABASE_URL`.

### 5.2 Required production topology

- One isolated preview/staging database.
- One production database.
- Separate roles, passwords, secrets, and KEKs per context.
- A pooled runtime URL (`DATABASE_URL`) and a direct/session migration URL
  (`DATABASE_MIGRATION_URL`).
- TLS required; `sslmode=disable` is rejected.
- Backups/PITR enabled before the first production migration.
- `DATABASE_POOL_MAX=3` recommended for serverless concurrency.

### 5.3 Data preservation decision

Production should start from an **empty migrated database**, not from the local demo database:

- The local catalogue is 99 demo plans across 33 destinations, all `isDemo`.
- Local orders, payments, users, and activation records are simulated.
- Copying them into production would present demo data as real inventory or real customer history.

The local databases remain in place as recovery/evidence sources. If specific non-demo records
must be preserved later, export only reviewed rows after stopping every process that can access
the database, import them after migrations, and validate references and counts. That transfer
requires separate approval.

Never copy an actively used PGlite directory, open the same directory from two processes, or move
database files into Git.

### 5.4 Migration procedure

See `docs/project/POSTGRES_MIGRATION_PLAN.md` for providers, exact commands, verification,
rollback, and approval gates. Do not provision or migrate anything until approved.

---

## 6. Environment variables for Netlify

### 6.1 Production — required

| Variable | Value / rule |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_ENV` | `production` |
| `DATABASE_URL` | Pooled PostgreSQL URL with TLS |
| `SITE_URL` | `https://esimprove.com` only after DNS and HTTPS are active |
| `DEMO_MODE` | `false` |
| `SEED_DEMO_DATA` | `false` |
| `AUTH_SECRET` | Random, at least 32 characters |
| `ACTIVATION_KEK_V1` | Base64-encoded 32-byte key |
| `ACTIVATION_KEK_ACTIVE_VERSION` | `1` (or the active positive integer) |
| `SUPPLIER_CREDENTIAL_KEK` | Separate base64-encoded 32-byte key |
| `SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK` | `false` |
| `INTERNAL_JOB_SECRET` | Random high-entropy string |
| `RATE_LIMIT_HASH_SECRET` | Random high-entropy string |
| `ANALYTICS_HASH_SECRET` | At least 32 characters, distinct from `AUTH_SECRET` and `RATE_LIMIT_HASH_SECRET` |
| `ADMIN_2FA_REQUIRED` | `true` |
| `PAYMENTS_LIVE_ENABLED` | `false` |
| `SUPPLIER_LIVE_ENABLED` | `false` |
| `EMAIL_LIVE_ENABLED` | `false` |
| `CATALOGUE_SYNC_ENABLED` | `false` |
| `STAGING_ACCESS_ENABLED` | `false` |
| `ANALYTICS_ENABLED` | `false` (legacy flag) |

### 6.2 Production — optional / deliberately unset

| Variable | Rule |
| --- | --- |
| `PAYMENT_PROVIDER` | **Leave unset** for this deployment. `whop` would require the complete Whop configuration and approval. |
| `APP_URL` | Set `https://esimprove.com` after DNS/HTTPS; not required to enable checkout |
| `DATABASE_MIGRATION_URL` | Migration tooling only; do not add to the Functions runtime scope |
| `DATABASE_SSL` | `require` recommended |
| `DATABASE_SSL_CA` | Only for a provider with a private CA |
| `DATABASE_POOL_MAX` | `3` recommended (1–10) |
| `HEALTH_CHECK_TOKEN` | Optional; enables detailed `/api/health` diagnostics |
| `NEXT_PUBLIC_SITE_NAME` | Optional public branding |
| `NEXT_PUBLIC_ANALYTICS_DISABLED` | Optional; `true` disables tracking before storage |
| `CSP_IMAGE_HOSTS`, `CSP_MEDIA_HOSTS` | Add exact HTTPS origins before using external media |

### 6.3 Preview / staging additions

- `APP_ENV=preview` or `staging`
- `DATABASE_ENV` equal to `APP_ENV`
- `DEMO_MODE=true` (required for preview)
- `SEED_DEMO_DATA=true` only for an isolated demo database
- `MOCK_PAYMENT_WEBHOOK_SECRET` set
- `SITE_URL` set to the stable preview/branch URL
- all live flags `false`
- separate database and secrets from production

### 6.4 Whop variables — prepared but inactive

| Variable | Current state |
| --- | --- |
| `WHOP_COMPANY_API_KEY` | Present only in `.env.local`; not in Netlify |
| `WHOP_ACCOUNT_ID` | Present only in `.env.local`; required by discovery |
| `WHOP_SANDBOX` | `false` locally; explicit when used |
| `WHOP_WEBHOOK_SECRET` | Not configured |
| `WHOP_PLAN_VARIANT_MAP` | Absent / empty; catalogue has 0 products and 0 variants |
| `PAYMENT_PROVIDER` | Unset |
| `PAYMENTS_LIVE_ENABLED` | `false` |

Do not create products, checkouts, payments, webhook test events, or simulated purchases without
approval.

---

## 7. Security and repository hygiene

### 7.1 `.gitignore` review

Covered:

- `.env`, `.env.*` (except `.env.example` and `.env.test.example`)
- `.pglite/`, `.pgdata/`, `*.sqlite`, `*.db`, dumps, backups, exports
- `.audit/` recovery artifacts
- `.next/`, `node_modules/`, build output, coverage, test reports
- logs, temporary files, caches
- certificates/private keys
- new local run artifacts (`*.out`, `*.err`, `*.bak`, `*.BAK`, `*.orig`, `*.rej`)

Only `.env.example` is tracked among sensitive-pattern files. `.env.local` is ignored.

### 7.2 Secret scan

A repository scan for API-key prefixes, webhook secrets, credentialed PostgreSQL URLs, private
keys, and high-entropy assignments found only:

- placeholder PostgreSQL URLs in `NETLIFY_DEPLOYMENT_GUIDE.md`
  (`USER:PASSWORD@HOST`);
- a test fixture URL in `tests/config.test.ts` (`demo:demo@db.example.test`).

No real secret was found in tracked files. The local Whop credential and account ID were not
printed.

### 7.3 Application security posture

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- Restrictive `Permissions-Policy`
- HSTS only in production builds
- Per-request CSP with a fresh nonce; no `script-src 'unsafe-inline'`
- Database-backed sessions, scrypt password hashes, admin TOTP, server-side guards, rate limiting
- Deployed configuration fails closed; PGlite is rejected
- Payment, supplier, and email adapters fail closed; no mock commerce in production

Residual security work remains: legal review, production secret generation/rotation, backup and
restore rehearsal, monitoring/alerting, browser/accessibility testing, and a full production
penetration/security review.

---

## 8. Domain and DNS

### 8.1 Current DNS

| Name | Type | Value |
| --- | --- | --- |
| `esimprove.com` | A | `2.57.91.91` (Hostinger parking) |
| `www.esimprove.com` | CNAME | `esimprove.com` |
| HTTPS | — | Serves a Hostinger parked page, not the application |

Do not change these records yet.

### 8.2 Canonical domain decision

Use **`https://esimprove.com`** as the canonical origin and redirect `www.esimprove.com` to the
apex. This keeps cookies, canonical URLs, and the future Whop webhook on one origin.

### 8.3 Exact DNS procedure after the Netlify site exists

Netlify generates site-specific targets. Do not invent them.

1. Create the Netlify site and add `esimprove.com` as the primary domain.
2. Add `www.esimprove.com` as an alias.
3. Choose one DNS method shown by Netlify:
   - **Netlify DNS (recommended):** replace the Hostinger nameservers with the four Netlify
     nameservers displayed for the site. Netlify manages the apex, `www`, and certificate records.
   - **Hostinger DNS:** create the apex `A`/`ALIAS` record and the `www` `CNAME` exactly as Netlify
     displays. Remove the parking `A` record (`2.57.91.91`) and the existing `www` CNAME first.
4. Wait for the managed certificate, then enable **Force HTTPS**.
5. Set `SITE_URL=https://esimprove.com` in the production scope and redeploy.
6. Confirm HTTP → HTTPS and `www` → apex redirects.
7. Set `APP_URL=https://esimprove.com` after HTTPS; it does not enable checkout by itself.

The future Whop webhook URL is `https://esimprove.com/api/webhooks/whop`. It returns 503 until
`WHOP_WEBHOOK_SECRET` is set.

---

## 9. Remaining production blockers

1. **GitHub target** — remote points at a different account; intended repository does not exist.
2. **Netlify site** — not created; no site access or environment variables.
3. **Production PostgreSQL** — not provisioned; no credentials, backups, or migration approval.
4. **DNS/HTTPS** — domain parked on Hostinger; no Netlify certificate.
5. **Whop catalogue** — 0 products, 0 variants; no exact mapping; no webhook secret; checkout
   disabled.
6. **Legal/business content** — legal entity, terms, privacy, refunds, cookies, tax, and support
   contacts are placeholders.
7. **Supplier fulfillment** — no live adapter; N-07 transport controls remain open.
8. **Email** — no live provider; password reset and delivery email unavailable.
9. **Scheduler/queue** — no scheduler is defined for `/api/jobs/run`.
10. **Verification** — no actual Netlify build/function/deploy; no browser, responsive, or
    accessibility suite; no production analytics evidence.
11. **Next.js security patch** — resolved in the working tree: `next@16.4.6` and
    `eslint-config-next@16.4.6` are applied and verified; the change still needs commit/push approval.
12. **Demo catalogue** — 99 demo plans must not be presented as real inventory.
13. **Tracked artifacts** — log/backup files remain tracked until the approved commit removes them.

---

## 10. Exact publishing sequence (approval-gated)

Do not execute until the owner approves each step.

### Step 1 — Confirm the GitHub repository

- Confirm the intended owner/name: `mohamedouaarab-dotcom/esimprove`.
- Create it if it does not exist, or provide the correct existing URL.
- Do not change the remote until confirmed.

### Step 2 — Change the remote and publish

```powershell
git remote set-url origin https://github.com/mohamedouaarab-dotcom/esimprove.git
git remote -v
git status
git diff --stat
```

Review the full diff, remove the tracked artifacts from the index, then commit and push the branch:

```powershell
git add <reviewed files>
git commit -m "Prepare ESIMPROVE for Netlify deployment"
git push -u origin fix/master-remediation
```

If production should deploy from `main`, open a pull request and merge after review. Do not
force-push or rewrite history.

### Step 3 — Create the Netlify site

- Import the correct GitHub repository.
- Use the root directory.
- Confirm the detected build command, publish directory, and Node 22 from `netlify.toml`.
- Do not add a Next.js plugin.

### Step 4 — Provision the database

- Select a provider; create isolated preview and production databases.
- Enable TLS, backups/PITR, and a suitable connection limit.
- Store credentials in Netlify's environment/secret store.
- Run migrations with the direct/session URL.
- Create the first production administrator; do not seed demo data.

### Step 5 — Deploy a preview

- Set preview-scoped variables and an isolated preview database.
- Deploy and verify `/api/health`, login, catalogue, mock checkout (preview only), headers,
  `robots.txt`, and the demo banner.
- Review function logs for secrets or unexpected provider calls.

### Step 6 — Connect the domain

- Add `esimprove.com` and `www.esimprove.com` in Netlify.
- Apply the exact DNS records/nameservers Netlify displays.
- Wait for the certificate; enable Force HTTPS.
- Set `SITE_URL=https://esimprove.com`; redeploy production.

### Step 7 — Production verification

- `/api/health` returns 200 and the expected context.
- Run `npm run smoke` with `SMOKE_BASE_URL=https://esimprove.com`.
- Verify HTTPS, HSTS, CSP, `www` redirect, sitemap, robots, login/logout, portal, and admin TOTP.
- Confirm checkout is unavailable, `/api/webhooks/payments/mock` returns 404, and
  `/api/webhooks/whop` returns 503.
- Confirm no real email is claimed as delivered.
- Confirm no supplier, payment, or catalogue-sync operation is active.

### Step 8 — Keep integrations disabled

Leave `PAYMENTS_LIVE_ENABLED=false`, `PAYMENT_PROVIDER` unset, `SUPPLIER_LIVE_ENABLED=false`,
`EMAIL_LIVE_ENABLED=false`, and `CATALOGUE_SYNC_ENABLED=false` until separate written approval and
the launch gates are satisfied.

---

## 11. Verification claims and non-claims

**Verified locally:**

- Repository-local Git identity is correct.
- TypeScript typecheck passed.
- ESLint passed.
- The Netlify preflight skipped correctly in the local context.
- The Netlify preflight passed with a complete synthetic production environment (no DB connection).
- `npm run build` on `next@16.4.6` with an in-memory PGlite directory: compilation, type checking,
  and route generation all passed. `next@16.4.6` is applied in the working tree but not committed or
  pushed.
- The Whop discovery script is read-only and found 0 products / 0 variants.
- The domain currently serves a Hostinger parking page, not Netlify.

**Not verified:**

- No actual Netlify build, deploy, function execution, or edge behavior.
- No production PostgreSQL connection, migration, backup, or restore.
- No DNS change, certificate, or custom-domain routing.
- No browser, responsive, accessibility, or load testing.
- No live payment, supplier, email, or webhook operation.
- No production analytics, monitoring, or alerting.

Nothing in this report should be read as evidence that ESIMPROVE is live or ready to accept real
orders.
