# Netlify deployment plan

**Status:** Application and `netlify.toml` exist locally; **no Netlify site, deploy, environment variable, domain, or DNS record exists**. No deploy has run.
**Date:** 2026-10-23
**Scope:** How the platform will be built, configured, deployed, protected, and rolled back on Netlify once the owner authorises access and the Phase 1 prerequisites are met.

> Do not treat any command, hostname, or configuration below as executed. Values marked “confirm in Netlify” must be read from the actual site/domain panel, not guessed.

## 1. Principles

- **One deployable, three environments:** local, staging, production. Separate databases and secrets.
- **No production deploy without a green build, migrations reviewed, and smoke tests.**
- **No live money/provisioning** until `docs/LAUNCH-GATES.md` is satisfied and the owner signs off.
- **Secrets only in Netlify’s environment/secret store.** Never in Git, build logs, client bundles, or chat.
- **Staging is private and `noindex`.** Free-plan password protection is unavailable, so use an Edge Function gate plus a non-public hostname.
- **Domain changes only after ownership is proven** (ADR-0009).
- **Rollback is a first-class step**, including database migration compatibility.

## 2. Prerequisites before the first deploy

| Prerequisite | Owner action | Status |
|---|---|---|
| Netlify account/team access | Invite the implementing account with least privilege, or provide a scoped deploy token through a secure channel. Do not paste tokens into chat. | **Not met** |
| Repository hosting/CI | Decide GitHub/GitLab and authorise a private repo; or deploy from a local Git remote. | **Not met** |
| Node/toolchain | Pin Node 22 LTS or the version supported by the chosen Next.js/Netlify adapter; record it in `.nvmrc`/`package.json` when scaffolding. | Not started |
| Database | Create a managed Postgres project/branch and provide a pooled `DATABASE_URL` through the secret store. | **Not met** |
| Domain | Prove registrar control and public DNS, or use a Netlify staging hostname only. | **Not met** |
| Build configuration | Add `netlify.toml` and the Next.js adapter only when application scaffolding begins. | `netlify.toml` exists locally; no site/deploy configuration verified |
| Legal/brand | Not required for a private staging deploy; required for public launch. | **Not met** |

## 3. Environments

| Environment | Hostname | Data | Integrations | Indexing | Access |
|---|---|---|---|---|---|
| Local | `http://localhost:3000` | PGlite or a local dev database | Fixtures/test mode only; live flags off | N/A | Developer |
| Deploy preview | Netlify preview URL | Never production data; prefer a branch database or fixtures | Live flags off | `noindex` | Anyone with the URL unless protected |
| Staging | `staging.esimprove.com` (after domain gate) or Netlify subdomain | Anonymised/test data only | Test mode only; live flags off | `noindex`, robots disallow | Basic Auth Edge Function + allowlist where possible |
| Production | `https://esimprove.com` | Production Postgres | Live only after gates | Indexable | Public |

**Rules**

- Production secrets must never be available to deploy previews. Use Netlify’s deploy-context scoping.
- Staging must not share a database with production.
- Do not restore production backups into staging without anonymisation and owner approval.
- Preview builds must not send email or call live supplier/payment APIs.

## 4. Proposed build and runtime configuration

The exact adapter version and build command will be pinned when the application is scaffolded. The intended shape:

```toml
# PROPOSED — do not add until Phase 1 scaffolding. Values must match the
# installed Next.js/Netlify adapter, not copied blindly.
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "22"

[functions]
  node_bundler = "esbuild"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    X-Frame-Options = "DENY"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

[[redirects]]
  from = "https://www.esimprove.com/*"
  to = "https://esimprove.com/:splat"
  status = 301
  force = true
```

**Notes**

- The `publish` directory and adapter configuration depend on the current Netlify Next.js integration. Confirm against the generated site settings.
- Do not set a blanket `Content-Security-Policy` here until nonces/hashes and third-party origins are known; a broken CSP is worse than a documented gap. CSP is a launch gate.
- HSTS is enabled only after HTTPS and the apex/`www` redirect are verified. Start with a short max-age and increase deliberately.
- Do not add a catch-all `/*` 200 rewrite that breaks static assets or the Next.js image endpoint.

## 5. First-time site creation (after authorisation)

1. Confirm the owner’s Netlify team and the correct account. Enable 2FA on the owner account.
2. Create a **private staging site** from the repository, not a production site.
3. Set the build command, publish directory, Node version, and base directory.
4. Add environment variables from `.env.example` with **empty/disabled** integrations first.
5. Deploy. Capture the deploy log and URL. Do not attach a custom domain yet.
6. Verify the staging gate, `noindex`, security headers, and a health endpoint.
7. Only then create/attach the production site and domain, after ADR-0009 evidence.

**Access rules**

- Prefer a scoped deploy token or a team invitation over sharing a personal password.
- A deploy token must be revocable, stored in CI secrets, and never used as an application runtime secret.
- Record who has access and review it before launch.

## 6. Environment variables and secrets

Use `.env.example` as the canonical list. In Netlify:

- Mark database URLs, auth secrets, encryption keys, supplier keys, payment keys, email keys, and internal job secrets as **secret**.
- Scope production values to the production context only.
- Keep live flags `false` in staging and previews.
- Rotate any value that was ever exposed in a log or screenshot.
- Do not rely on `NEXT_PUBLIC_*` for secrets; those values are shipped to the browser.

Production boot checks must refuse to start when:

- `APP_ENV=production` and a required secret is missing.
- A live flag is true without its provider credentials and approval record.
- `BETTER_AUTH_URL`/canonical origin does not match the request host.
- `ADMIN_2FA_REQUIRED` is false in production.

## 7. Database provisioning and migrations

1. Create a managed Postgres project in the approved region (provider not selected; Neon recommended).
2. Use a pooled connection string for serverless runtime; use a direct connection for migrations if the provider requires it.
3. Store both in the secret store; never in `netlify.toml`.
4. Run migrations as an explicit release step **before** deploying code that requires them, or use an expand/contract pattern:
   - Deploy backward-compatible schema first.
   - Deploy code.
   - Remove old columns/tables in a later release.
5. Take a backup/snapshot before destructive migrations.
6. Never run migrations automatically on every cold start or in multiple concurrent function instances.
7. Record the applied migration version in the health endpoint and deploy notes.

**Rollback rule:** a code rollback must not require a destructive schema rollback. If it does, the release is not safe to deploy.

## 8. Domain and DNS (only after ownership is proven)

Planned hostnames:

| Hostname | Purpose | Record type (confirm in Netlify) |
|---|---|---|
| `esimprove.com` | Canonical production | ALIAS/ANAME to Netlify apex target, or A fallback if the registrar lacks ALIAS |
| `www.esimprove.com` | 301 to apex | CNAME to the Netlify site |
| `staging.esimprove.com` | Protected staging | CNAME to the staging site |
| `mail.esimprove.com` | Transactional sending | Provider-issued SPF/DKIM; DMARC at `_dmarc` |
| `status.esimprove.com` | Optional later | Not planned for MVP |

**Do not copy DNS target values from this document.** Netlify’s domain panel is authoritative and can differ by edge/plan. Do not change nameservers until the owner confirms registrar access and approves the change.

Sequence:

1. Prove registrar control.
2. Add the domain in Netlify and read the exact target values.
3. Create records; wait for propagation.
4. Verify TLS issuance for apex and `www`.
5. Verify `www` 301 to apex, canonical tags, cookies on the exact host, and `noindex` on staging.
6. Only then configure email authentication and webhooks.

## 9. Headers, redirects, and indexing

- `www` → apex: permanent 301, path/query preserved.
- Staging/preview: `X-Robots-Tag: noindex, nofollow` and `robots.txt` disallow; never rely on robots alone.
- Production `robots.txt`: disallow `/admin`, `/account`, `/api`, `/checkout`; allow public catalogue/content.
- Canonical URLs always use the verified production origin.
- Security headers: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame ancestors `'none'`, and CSP after nonce/hash design.
- HSTS only after HTTPS verification; include subdomains only when every subdomain is HTTPS-ready.
- Do not set long-lived immutable caching on authenticated or personalised responses.
- Cache catalogue pages with revalidation on publish; bypass cache for cart/checkout/account/admin.

## 10. Staging protection on the free plan

Netlify’s credit-based Free plan does not provide built-in password protection. The proposed substitute:

- An Edge Function (or middleware at the edge) checks every request for HTTP Basic Auth.
- Credentials come from `STAGING_BASIC_AUTH_USER` and `STAGING_BASIC_AUTH_PASSWORD_HASH`; compare a hash in constant time.
- Return `401` with `WWW-Authenticate: Basic realm="Staging"` when absent/invalid.
- Add `X-Robots-Tag: noindex, nofollow` to every response.
- Use a non-guessable staging hostname in addition to auth.
- Do not put production data or live keys in staging.
- Document that Basic Auth over HTTPS is weaker than SSO: no per-user audit, shared credentials, no MFA. It is a pre-launch control, not a production security model.

**Verification:** unauthenticated request → 401; wrong password → 401; correct → 200 with `noindex`; static assets also protected; no credentials in logs.

## 11. Functions and scheduled work

| Function type | Use | Limits / controls |
|---|---|---|
| Route Handler / Server Action | Checkout, webhooks, admin mutations | Normal request timeout; validate, authorize, idempotency |
| Background Function | Supplier order, LPA retrieval, email, reconciliation | Up to 15 minutes per Netlify docs; job ID only; signed internal request; idempotent |
| Scheduled Function | Sweep due jobs, stuck orders, health checks | 30 seconds per Netlify docs; enqueue work, do not run long supplier calls; published deploys only |

- Internal invocations use `INTERNAL_JOB_SECRET` (HMAC or bearer with constant-time compare) and are not reachable from the browser.
- Scheduled invocations use `CRON_SECRET` or Netlify’s scheduled-function authentication; verify before doing work.
- Every handler logs a correlation/job ID, never activation data or secrets.
- A function must be safe to invoke twice; uniqueness is enforced in Postgres, not in memory.
- Cold starts and connection pooling are tested before launch.

## 12. Webhooks (planned, inactive)

| Provider | Planned path | Security |
|---|---|---|
| Stripe | `https://esimprove.com/api/webhooks/stripe` | Stripe signature verification against raw body; replay protection by event ID |
| Supplier | `https://esimprove.com/api/webhooks/supplier/<random-token>` | Random path token, optional IP allowlist, `notifyId` dedupe, reconcile with supplier API; **no documented HMAC** for eSIM Access |
| Email | `https://esimprove.com/api/webhooks/email` | Provider signature/verification; bounce/complaint handling |

Webhook routes must:

1. Read the raw body before parsing.
2. Verify the signature/token.
3. Insert the event with a unique external ID; duplicates return 2xx without reprocessing.
4. Apply state changes in a transaction and enqueue outbox work.
5. Return 2xx only after durable recording; otherwise let the provider retry.
6. Never trust a webhook as the sole proof of payment or fulfillment; reconcile with the provider API.

## 13. Deploy workflow

```text
Pull request
  → lint + typecheck + unit tests + build
  → dependency/secret scan
  → deploy preview (noindex, live flags off)
  → review + approval
  → merge to main
  → staging deploy
  → migrations (staging) + smoke tests
  → manual approval
  → production migrations (expand/contract) + production deploy
  → post-deploy smoke tests + monitoring window
```

- Production deploys are triggered from a reviewed commit, not an arbitrary local directory.
- Record the commit SHA, deploy ID, migration version, and approver in the release notes.
- Do not deploy on Fridays or before a period without support coverage unless the owner accepts the risk in writing.
- A failed smoke test triggers rollback, not “fix forward” by default.

## 14. Rollback and disablement

| Scenario | Action |
|---|---|
| Bad application deploy | Roll back to the previous Netlify deploy; verify health and checkout read-only. |
| Bad migration | Stop deploys; restore from snapshot if data is affected; follow the migration runbook. Never assume down-migrations are safe. |
| Payment incident | Set `PAYMENTS_LIVE_ENABLED=false`; stop new checkout; preserve webhooks for reconciliation; alert owner. |
| Supplier incident | Set `SUPPLIER_LIVE_ENABLED=false`; stop new provisioning; reconcile in-flight orders; communicate delays. |
| Email incident | Set `EMAIL_LIVE_ENABLED=false`; keep portal access; investigate suppression/keys. |
| Security incident | Rotate affected secrets, revoke sessions, preserve logs, follow the incident runbook, notify as legally required. |

Kill switches must be tested in staging before launch. Disabling an integration must not corrupt existing orders or hide already-purchased eSIMs.

## 15. Post-deploy verification (not yet run)

| Check | Expected | Status |
|---|---|---|
| Build and deploy | Successful, pinned commit | Not run |
| Home/catalogue SSR | 200, correct canonical | Not run |
| Server Action/Route Handler | Works with CSRF/origin checks | Not run |
| Database connectivity | Pooled connection, migration version correct | Not run |
| Background Function | Completes a >30s simulated job | Not run |
| Scheduled Function | Runs on published deploy, enqueues work | Not run |
| Staging auth | 401 without credentials, 200 with | Not run |
| `noindex` | Header present on staging/preview | Not run |
| Security headers | Present, CSP not blocking first-party assets | Not run |
| `www` redirect | 301 to apex, path preserved | Not run |
| TLS | Valid for apex and `www` | Not run |
| Webhook rejection | Invalid signature/token rejected | Not run |
| Live flags | All false; checkout/provisioning blocked | Not run |
| Rollback | Previous deploy restored | Not run |

## 16. Monitoring, cost, and ownership

- Enable Netlify deploy notifications to a monitored address.
- Track function invocations, bandwidth, build minutes, and credit usage; set a budget alert.
- Uptime checks for apex, staging health, payment webhook, supplier API, and email provider.
- Error tracking with PII scrubbing (Sentry proposed, not connected).
- Name an owner for alerts and a backup. No “24/7 support” claim until staffed.
- Review the Netlify plan before launch; free-tier limits are not a production SLA.

## 17. Known limitations

- No Netlify account/site access exists; nothing here is verified against the owner’s plan.
- Free-plan staging protection is weaker than SSO and has no per-user audit.
- Serverless cold starts and function limits may affect checkout/admin latency.
- Scheduled Functions run only on published deploys and have a 30-second limit.
- The OpenNext adapter may lag Next.js releases; upgrades require staging tests.
- Domain, TLS, email, and webhooks cannot be tested until ownership and provider accounts exist.
- No load, penetration, backup-restore, or accessibility test has been run.

## 18. Change log

| Date | Change |
|---|---|
| 2026-10-23 | Initial deployment plan from Phase 0 discovery. No deploy performed. |
