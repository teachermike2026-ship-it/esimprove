# ESIMPROVE — Netlify First Deploy Checklist

**Date:** 2026-11-23
**Target:** Netlify site `esimprove-4eiz` → `https://esimprove-4eiz.netlify.app`
**Repository:** `mohamedouaarab-dotcom/esimprove` · branch `main`
**Rule:** Deployment is paused. This checklist is the exact resume procedure; it does not authorize migrations or deployments by itself.

---

## Current execution status (2026-11-23)

| Item | Status |
|---|---|
| Neon schema migration | **COMPLETE** — 9/9 migrations, 65 public tables, applied once from an empty database; no seed |
| Production administrator | **COMPLETE** — one verified admin, 2FA enabled; credentials only in the ignored local file |
| Netlify site | **CREATED** — `esimprove-4eiz`, site ID `8b8db4ad-6c9d-478d-90fc-9b6be07afa23`, account `mohamed-ouaarab` |
| GitHub link | **NOT LINKED** — requires owner OAuth approval |
| Netlify variables | **NOT UPLOADED** — free `nf_team_dev` plan rejects secret variables |
| Deployment | **NOT PERFORMED** — paused by owner |
| Local quality gates | **PASS** — typecheck, lint, 546 tests, production build, audit 0, secret scan clean |

**Critical resume prerequisite:** the new Netlify team must be on a plan that supports scoped/shared environment variables (Pro or a Pro trial). The free plan cannot store the 8 required secrets.

---

## 0. Preconditions

| Gate | Status required |
|---|---|
| The new Netlify team supports scoped/shared secret variables (Pro or Pro trial) | **Blocking** — the free plan cannot store the 8 secrets |
| Production migration approved and applied (see `docs/PRODUCTION_MIGRATION_RUNBOOK.md`) | **Complete (2026-11-23)** — 9/9 migrations, 65 tables |
| Initial administrator approved and created | **Complete (2026-11-23)** — 2FA verified |
| Neon backup/PITR window confirmed by owner | Recommended before any future migration; the initial migration targeted an empty database |
| `.env.netlify.production` present locally and ignored by Git | Verified |
| Netlify account owns site `esimprove-4eiz` | Verified — site created under `mohamed-ouaarab` |

Recommended resume order: **upgrade/start trial → upload variables (secrets scoped + secret) → link GitHub repo → first deploy → verify**. The build preflight does not connect to the database.

---

## 1. Netlify site configuration

The site exists under the new account but has **no Git link**. Open the site, then **Site configuration → Build & deploy → Continuous deployment → Link repository** and connect `mohamedouaarab-dotcom/esimprove`, branch `main`. This step requires your GitHub OAuth approval.

If you ever recreate the site, use these settings:

1. **Add new site → Import an existing project → GitHub.**
2. Choose `mohamedouaarab-dotcom/esimprove`.
3. Branch to deploy: **`main`**.
4. Base directory: leave empty.
5. Framework preset: **Next.js** (auto-detected).
6. Build command: `npm run netlify:preflight && npm run build` (from `netlify.toml`).
7. Publish directory: `.next` (from `netlify.toml`).
8. Node version: **22** (from `netlify.toml`).
9. **Do not add** `@netlify/plugin-nextjs` or any Next.js adapter/plugin. Netlify auto-installs and updates the OpenNext adapter.

If Netlify shows a manually pinned adapter/plugin, remove the pin so security updates apply automatically. Current verified Next.js `16.4.6` includes the November 2026 security patches (fixed in 16.4.5); the adapter fix ships in auto-installed 5.16.6+.

---

## 2. Environment variables to add in Netlify

> **Blocked on the free plan (verified 2026-11-23):** Netlify rejects secret variables because the default scope set includes `post_processing`, and specifying scopes or shared variables returns 403 “Upgrade your account”. Upgrade the team or start a Pro trial before uploading. No variables were uploaded during the paused run.

After the plan supports scoped secrets, open **Site configuration → Environment variables**. Add each variable with:

- **Deploy context:** Production
- **Scopes:** Builds **and** Functions (Netlify defaults to all scopes; if it offers separate choices, enable both)
- **Secret:** mark as secret where indicated

Copy each value directly from the local `.env.netlify.production` file into the Netlify UI. Do not paste values into chat, tickets, screenshots, or build logs.

| Variable | Kind | Secret? | Expected value |
|---|---|---|---|
| `APP_ENV` | config | No | `production` |
| `DATABASE_ENV` | config | No | `production` |
| `SITE_URL` | config | No | `https://esimprove-4eiz.netlify.app` |
| `DATABASE_URL` | config | **Yes** | Neon pooled runtime URL |
| `DATABASE_SSL` | config | No | `require` |
| `DATABASE_POOL_MAX` | config | No | `3` |
| `DEMO_MODE` | config | No | `false` |
| `SEED_DEMO_DATA` | config | No | `false` |
| `AUTH_SECRET` | secret | **Yes** | locally generated |
| `ACTIVATION_KEK_V1` | secret | **Yes** | locally generated base64 32-byte key |
| `ACTIVATION_KEK_ACTIVE_VERSION` | config | No | `1` |
| `SUPPLIER_CREDENTIAL_KEK` | secret | **Yes** | locally generated, distinct base64 32-byte key |
| `SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK` | config | No | `false` |
| `INTERNAL_JOB_SECRET` | secret | **Yes** | locally generated |
| `RATE_LIMIT_HASH_SECRET` | secret | **Yes** | locally generated |
| `ANALYTICS_HASH_SECRET` | secret | **Yes** | locally generated; distinct |
| `ADMIN_2FA_REQUIRED` | config | No | `true` |
| `PAYMENTS_LIVE_ENABLED` | config | No | `false` |
| `SUPPLIER_LIVE_ENABLED` | config | No | `false` |
| `EMAIL_LIVE_ENABLED` | config | No | `false` |
| `CATALOGUE_SYNC_ENABLED` | config | No | `false` |
| `ANALYTICS_ENABLED` | config | No | `false` |
| `STAGING_ACCESS_ENABLED` | config | No | `false` |
| `NEXT_PUBLIC_ANALYTICS_DISABLED` | config | No | `true` |
| `HEALTH_CHECK_TOKEN` | secret (optional) | **Yes** | locally generated; enables detailed health checks |

**Do not add:**

- `DATABASE_MIGRATION_URL` — migration-only; add it only temporarily in a secure local shell during an approved migration, never to Netlify runtime.
- `PAYMENT_PROVIDER`, Stripe, Whop, supplier, email, or analytics-provider credentials.
- Legal entity, tax, support, or other invented business values.

After saving, redeploy if Netlify does not apply variables to the next build automatically.

---

## 3. First deploy

1. Confirm the migration and admin steps are **complete and verified**.
2. Trigger **Deploys → Trigger deploy → Deploy project** (or push the already-approved `main` commit — no new push is required by this checklist).
3. Watch the deploy log for:

   ```text
   Netlify preflight: APP_ENV=production
   Deployment configuration checks passed (no database connection attempted).
   ✓ Compiled successfully
   ```

   A preflight failure means a required variable is missing/misformatted. The log prints variable names and safe context only, never values.

4. Do not attach the custom domain yet.

Expected build outcome: Next.js 16.4.6, TypeScript passes, all application routes compiled as dynamic.

---

## 4. Post-deploy verification

Run from any trusted terminal. Replace the token through an environment variable; never paste it into shared logs.

```powershell
$base = "https://esimprove-4eiz.netlify.app"

# Public health: should be 200 with status "ok"
curl.exe -sS "$base/api/health"

# Detailed health: migration state and flags (token required)
curl.exe -sS -H "Authorization: Bearer $env:HEALTH_CHECK_TOKEN" "$base/api/health"

# Mock webhook must be hidden in production
curl.exe -sS -o NUL -w "%{http_code}`n" -X POST "$base/api/webhooks/payments/mock"

# Jobs endpoint must reject unauthenticated calls
curl.exe -sS -o NUL -w "%{http_code}`n" -X POST "$base/api/jobs/run"
```

Expected results:

| Check | Expected |
|---|---|
| `GET /api/health` (public) | `200`, `status: "ok"`, no secrets |
| `GET /api/health` (detailed, with token) | `200`, `checks.configuration: "ok"`, `checks.database: "ok"`, `migrations.pending: []`, `upToDate: true` |
| Mock payment webhook | `404` |
| Unauthenticated jobs call | `401` |
| `/admin` unauthenticated | `307` redirect to `/login` |
| `/checkout` | Checkout unavailable message; no mock purchase path |
| Home page | `200`, no demo/placeholder catalogue presented as real stock |
| Security headers | `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; `Strict-Transport-Security` in production |
| Build log | Preflight passed; no secret values printed |

**Do not claim success from the build alone.** Confirm the health response and the 404/401 checks above.

---

## 5. Rollback

| Scenario | Action |
|---|---|
| Build or preflight failure | Fix the variable/build; do not bypass the preflight |
| Bad application deploy | Netlify → Deploys → select the previous good deploy → **Publish deploy** |
| Bad migration | Stop deploys; restore the Neon backup/PITR snapshot; fix forward with a new migration file; never edit an applied migration |
| Security incident | Rotate affected secrets in Netlify and Redeploy; revoke sessions if auth is involved |

The schema has no down-migrations by design. Application rollback is safe because migrations are additive; database rollback means provider restore.

---

## 6. Later: custom domain and DNS (not part of this checklist)

1. Obtain explicit approval for the DNS change.
2. Add `esimprove.com` in **Netlify → Domain management** and use the exact records Netlify displays.
3. Wait for TLS issuance.
4. Update Netlify `SITE_URL` to `https://esimprove.com`, then redeploy.
5. Verify canonical URLs, cookies on the exact host, and `www` redirect behavior.
6. Do not change nameservers or DNS without separate approval.

---

## 7. Manual actions summary

| Action | Owner | Status |
|---|---|---|
| Approve and run migration | Owner + operator | **DONE (2026-11-23)** — 9/9, 65 tables, no seed |
| Approve and create administrator | Owner + operator | **DONE (2026-11-23)** — 2FA verified |
| Upgrade team or start Pro trial (scoped secrets) | Owner | **BLOCKING** — free plan cannot store secrets |
| Upload 25 Netlify variables (Production; Builds + Functions; 8 secret) | Operator after upgrade | Pending |
| Link GitHub repository via dashboard OAuth | Owner | Pending |
| Trigger first deploy | Owner/operator | Pending — deployment paused |
| Run post-deploy checks | Operator | Pending — health, pending empty, 404/401 |
| Custom domain/DNS | Later approval | Pending — do not change yet |
