# ESIMPROVE — Neon PostgreSQL + Netlify Setup Report

**Prepared:** 2026-11-23
**Scope:** Safe, reversible preparation only.
**Status:** No Neon connection, production migration, Netlify site, Netlify deploy, DNS change,
GitHub remote change, commit, push, or live integration operation has occurred.
**Secrets:** No connection string, password, token, key, or credential value appears in this
report. Neon credentials were validated with true/false checks only.

> **Addendum (2026-11-23, later same day) — this report is superseded as a status document.**
> It remains accurate as the historical record of the initial audit, but several statements in
> §§1, 9, and 11 below are now outdated. Since it was written:
>
> - Read-only Neon checks were performed on the pooled and direct endpoints: both connect as
>   `neondb` / `neondb_owner` and TLS is enforced (plaintext rejected). At the time of the audit
>   the database was empty (0 public tables, no `schema_migrations`). On 2026-11-23 the approved
>   initial migration was applied once (9/9 migrations, 65 tables, no seed), and the first
>   production administrator was created separately with verified 2FA.
> - The Netlify site `esimprove-4eiz` was created under the new account. Deployment is paused
>   because the free plan cannot store the required secret variables; no variables were uploaded
>   and no deploy ran.
> - The six required production secrets plus an optional health token were generated locally and
>   placed only in `.env.netlify.production`, which is ignored by `.gitignore` and untracked.
> - The real production preflight passed with that file, and typecheck, lint, tests
>   (64 files / 546 tests), production build, `npm audit --omit=dev`, and the secret scan all passed.
> - `new-origin` `main` already holds the published commit
>   `6580a03f7c79a6936baa3ad2c35005452c2ab839`; the old `origin` is unchanged. Nothing was pushed
>   in this phase.
>
> Current status, evidence, and the remaining approval gates live in:
>
> - `docs/PRODUCTION_READINESS_REPORT.md`
> - `docs/NETLIFY_FIRST_DEPLOY_CHECKLIST.md`
> - `docs/PRODUCTION_MIGRATION_RUNBOOK.md`
>
> Use those three documents, not this one, for deployment decisions.

---

## 1. Summary

| Question | Answer |
| --- | --- |
| Does local development still use PGlite? | **Yes.** `.env.local` is unchanged and has no database URL; the local target still resolves to PGlite. |
| Is the Neon configuration prepared? | **Yes, at the code/documentation level.** Pooled URL is reserved for runtime; direct URL is reserved for migrations. Nothing has connected to Neon. |
| Is the production migration ready to run? | **Ready, but not authorized or executed.** Nine additive migrations were verified against an empty-PostgreSQL target on paper; backups/PITR and the migration window still need owner approval. |
| Did the Next.js security upgrade succeed? | **Yes.** The verified `next@16.4.6` package/lockfile change is applied to the main checkout, and typecheck, lint, focused tests, and the production build all pass there. It is not yet committed or pushed. |
| Does a Netlify build succeed? | **The local production build on 16.4.6 succeeds in the main checkout.** No actual Netlify build has run. |
| Which environment variables are missing? | **All Netlify-scoped variables**, including all production secrets. They exist only as documented placeholders. See §9. |
| What requires approval? | Remaining gates: generating production secrets; changing the GitHub remote; committing/pushing; creating the Netlify site; running the first Neon migration; changing DNS. See §11. |

---

## 2. What I inspected

### Repository state

- Branch `fix/master-remediation`, **9 commits ahead of `origin/main`**, no upstream.
- Working tree: pre-existing changes preserved. At initial inspection there were **179 status
  entries**; the current tree has **184** after the approved dependency upgrade, documentation
  updates, and this new report. No files were reset, cleaned, or deleted.
- Remote: `https://github.com/teachermike2026-ship-it/esimprove.git` — this is **not** the intended
  `mohamedouaarab-dotcom` account. The intended repository previously returned 404, and `gh` is not
  authenticated. No remote change was made.
- Repo-local Git identity: `mohamedouaarab-dotcom` / `mohamed.ouaarab17@gmail.com`.

### Database architecture

- Existing stack: **Drizzle ORM + `pg`** for PostgreSQL, **`@electric-sql/pglite`** for local.
- `lib/db/client.ts` selects PostgreSQL when `DATABASE_URL` is set; otherwise it uses PGlite.
- Deployed contexts (`preview`, `staging`, `production`) **reject PGlite** and require a
  `postgres://` or `postgresql://` URL with TLS.
- The PostgreSQL `pg` pool defaults to **max 3** per function instance in deployed contexts, with
  idle/connection/statement timeouts. This is appropriate for Netlify Functions with Neon pooling.
- `DATABASE_ENV` must equal `APP_ENV`, preventing a production app from silently using a
  non-production database declaration.

### Migrations

- **9 forward-only migrations** in `db/migrations/` (`0001`–`0009`).
- **64 tables** created, matching the **64 `pgTable(...)`** declarations in `lib/db/schema.ts`.
- **105 indexes** created.
- **No** `CREATE EXTENSION`, `CREATE TYPE`, `ALTER TYPE`, `CREATE DOMAIN`, or `CREATE COLLATION`.
  The schema needs no Neon-specific extensions.
- **No** `DROP TABLE`, `DROP COLUMN`, `DROP INDEX`, `TRUNCATE`, `DELETE FROM`, or
  `ALTER TABLE ... DROP` statements. The only `ON DELETE` occurrences are foreign-key actions.
- `0006_legal_compliance.sql` inserts only legal/compliance defaults and uses
  `ON CONFLICT ... DO NOTHING`. It inserts **no catalogue, users, orders, payments, or inventory**.
- The migration runner records files in `schema_migrations`, validates **SHA-256 checksums**,
  applies files in filename order, runs **one transaction per file**, and takes a session advisory
  lock (`1481193201`).
- Empty-PostgreSQL compatibility: all migrations are create/additive and use
  `IF NOT EXISTS` where appropriate; foreign-key targets are created before referencing tables.

### Netlify configuration

- `netlify.toml`: Node **22**, command `npm run netlify:preflight && npm run build`,
  publish `.next`, telemetry disabled, **no** `@netlify/plugin-nextjs` (Netlify’s zero-config
  OpenNext adapter is used).
- `next.config.ts`: `pg` and PGlite are external server packages; migration SQL files are included
  in output tracing; HSTS is emitted only for `APP_ENV=production`.
- Preflight validates non-secret deployment configuration **without connecting to a database**.

### Local environment and databases

- `.env.local` SHA-256 before and after: `6E2134D9338D4FC57AFC71527DD7762B3EB52F660B568FBD607B574EEF73EB37`
  — **unchanged**.
- `.env.local` contains **no** `DATABASE_URL` or `DATABASE_MIGRATION_URL`. It selects local PGlite.
- `.pglite`: **1,343 files / 60,817,548 bytes** — unchanged.
- `.audit/impl-db`: **1,349 files / 60,907,770 bytes** — unchanged.
- `npm run db:target` with `PGLITE_DATA_DIR=.audit/impl-db` reported `pglite-directory`, with
  **no connection made**.
- At inspection time, port 3000 had **no listener**. I did not start or stop any local server.
- Local databases were not migrated, opened for writes, copied, moved, or deleted.

### Neon credentials file

- Found at `C:\Users\hp\Desktop\neon-credentials.txt` (329 bytes).
- Both required keys are present. Validation results, **without revealing values**:
  - both are `postgresql://` URIs;
  - both include `sslmode`;
  - the pooled endpoint contains `pooler`;
  - the direct endpoint does not contain `pooler`;
  - both resolve to the **same database path**;
  - the endpoints and full strings are different.
- The file was **not** copied into the repository and was added to `.gitignore`.

---

## 3. What I changed

### Code

| File | Change |
| --- | --- |
| `package.json`, `package-lock.json` | Applied the verified `next@16.4.6` / `eslint-config-next@16.4.6` upgrade to the main checkout after gate A approval. |
| `scripts/migrate.ts` | Deployed contexts now **require `DATABASE_MIGRATION_URL`** and refuse to fall back to the pooled `DATABASE_URL`. Migration target logging is redacted (no hostname or credentials). |
| `scripts/seed.ts` | Target logging is redacted (no hostname or credentials). Demo seeding remains blocked in production and by `SEED_DEMO_DATA=false`. |
| `.gitignore` | Added `neon-credentials.txt`. |

### Documentation

Updated to match the actual state: Neon project selected, pooled/direct URL roles, preview
isolation, moved migration gate, and 16.4.6 worktree verification.

- `NETLIFY_ENVIRONMENT_VARIABLES.md`
- `NETLIFY_DEPLOYMENT_GUIDE.md`
- `NETLIFY_DEPLOYMENT_BLOCKERS.md`
- `NETLIFY_PRODUCTION_CHECKLIST.md`
- `ESIMPROVE_GITHUB_NETLIFY_DEPLOYMENT_PREPARATION.md`
- `README.md`
- `docs/project/POSTGRES_MIGRATION_PLAN.md`
- `docs/DEPLOY-MIGRATIONS.md`

### Verification

- Main tree `npm run typecheck`: **passed**.
- Main tree `npm run lint`: **passed**.
- Synthetic deployed migration guard: with `APP_ENV=production`, a dummy `DATABASE_URL`, and no
  `DATABASE_MIGRATION_URL`, `npm run db:migrate` **refused and exited 1** with the expected message.
  No database was contacted.

### Isolated Next.js worktree

- Worktree: `C:\Users\hp\esimprove-next-security` (detached at `5afb6ec`).
- Mirrors the current working tree overlay (179 entries) **without** `.env.local`, `.pglite`,
  `.audit`, build output, or credentials.
- Only `next` and `eslint-config-next` were upgraded, both to **16.4.6**.
- Lockfile package-version diff contains only Next.js-related packages:
  `next`, `@next/env`, `@next/eslint-plugin-next`, `@next/swc-*`, `eslint-config-next`.
- `react@19.3.1` is unchanged and satisfies the peer range.

**Worktree results:**

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| Focused tests (`config`, `migrations`, `migration-upgrade`, `database-target-description`) | 4 files / 20 tests passed |
| `npm run build` (Next 16.4.6, in-memory PGlite) | Passed; all routes compiled and generated |
| `npm run netlify:preflight` (synthetic production env) | Passed; no database connection attempted |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| Full `npm audit` | 7 moderate **dev-only** advisories (`@typescript-eslint/*`, `minimatch`, `typescript-eslint`) |

`16.4.6` is the current `latest` 16.x release. The upgrade is a patch-level security fix, not a
major-version change.

### Applied to the main checkout (gate A, approved 2026-11-23)

After owner approval, the identical verified `package.json` and `package-lock.json` were copied
from the worktree to `C:\Users\hp\esimprove`, and `npm ci` reinstalled from the lockfile.

| Check | Main-checkout result |
| --- | --- |
| Installed versions | `next@16.4.6`, `eslint-config-next@16.4.6`, `react@19.3.1` |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| Focused tests (excluding the `.audit` mirror) | 4 files / 20 tests passed |
| `npm run build` (in-memory PGlite) | Passed; all routes compiled and generated |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| `.env.local` SHA-256 | Unchanged |
| `.pglite` / `.audit/impl-db` | Unchanged (same file counts and bytes) |

The package and lockfile changes are **not committed or pushed**. The worktree remains available at
`C:\Users\hp\esimprove-next-security` as a rollback/comparison point.

---

## 4. What I deliberately did not change

- `.env.local` — byte-for-byte unchanged; no values displayed.
- `.pglite` and `.audit/impl-db` — unchanged; no migration, write, copy, move, or deletion.
- No dependencies other than `next` and `eslint-config-next` were intentionally changed; the
  lockfile diff contains only Next.js-related packages.
- No Neon connection, migration, schema creation, or data transfer.
- No production secrets or KEKs generated.
- No Netlify site, deploy, environment variables, or adapter plugin.
- No DNS, nameserver, or domain change.
- No GitHub remote change, commit, push, branch deletion, reset, clean, or force-push.
- No Whop, payment, checkout, webhook, email, supplier, or catalogue-sync operation.
- No local server started, stopped, or killed.

---

## 5. Local development remains on PGlite

Evidence:

1. `.env.local` hash is unchanged.
2. It contains no `DATABASE_URL` or `DATABASE_MIGRATION_URL`.
3. The target-description command selected `pglite-directory` with
   `PGLITE_DATA_DIR=.audit/impl-db`, and explicitly connected to nothing.
4. Both local database directories retain their original file counts and byte totals.
5. The workflow remains: run `scripts/dev-local.ps1` → `PGLITE_DATA_DIR=.audit/impl-db` wins over
   `.env.local` → PGlite starts locally. Neon is never required locally.

The local demo catalogue is still local only. No local data was copied to Neon.

---

## 6. Neon readiness

**Prepared:**

- Neon project: `esimprove`.
- Runtime `DATABASE_URL` → **pooled** endpoint.
- `DATABASE_MIGRATION_URL` → **direct** endpoint, for migration/seed tooling only.
- The migration runner now refuses the pooled fallback in deployed contexts.
- TLS is required; the connection strings already include `sslmode`.
- Pool size defaults to 3 per function instance, suitable for serverless.

**Still required before production:**

1. Confirm Neon backups/PITR and the restore procedure.
2. Add both URLs as **Netlify-scoped secrets** (pooled for runtime, direct for migration runs only).
3. Keep the direct URL out of the Functions runtime scope.
4. Create an **isolated Neon branch/database for deploy previews** if previews will be enabled —
   never point previews at the production branch.
5. After the first migration, verify `GET /api/health` reports the expected migration state.

**Not done:** no connection to Neon has been attempted; no migration has run; no Netlify variable
exists.

---

## 7. Production migration readiness

| Check | Result |
| --- | --- |
| Migration order | `0001` → `0009`, filename order enforced |
| Checksums | SHA-256 recorded and verified by the runner |
| Empty-PostgreSQL safe | Yes — create/additive statements, ordered foreign keys, idempotent guards |
| Destructive operations | None (`DROP`, `TRUNCATE`, `DELETE FROM` absent) |
| Data inserts | Only legal/compliance defaults in `0006`, with `ON CONFLICT DO NOTHING` |
| Demo data | Not included; seeding is blocked in production |
| Concurrency protection | Session advisory lock `1481193201` |
| Transactionality | One transaction per migration file |
| Correct connection | Deployed runs require the **direct** `DATABASE_MIGRATION_URL` |
| Target identity | Not yet connected or confirmed against Neon |
| Backup before migration | Not yet confirmed |
| Execution | **Not authorized, not run** |

The migration creates **schema plus legal/compliance defaults only**. It does not create products,
inventory, users, orders, payments, or supplier data.

---

## 8. Netlify build status

- Configuration is compatible with Netlify’s zero-config Next.js adapter: Node 22, preflight +
  build, `.next` publish directory, no conflicting plugin.
- On 16.4.6, the full local production build succeeds in the main checkout with in-memory PGlite
  and synthetic local configuration.
- The production preflight passes with a synthetic production environment and does not connect to a
  database.
- **No Netlify build has run.** The main checkout is now on 16.4.6, outside the affected range, so
  the local security gate is cleared. Netlify still needs a site, repository access, and
  Netlify-scoped environment variables.

---

## 9. Environment variables still missing

No Netlify site or Netlify-scoped variable exists. All of the following still need to be set in
Netlify for the production context:

**Non-secret configuration**

- `APP_ENV=production`
- `DATABASE_ENV=production`
- `SITE_URL=https://esimprove.com` (only after HTTPS is active)
- `DEMO_MODE=false`
- `SEED_DEMO_DATA=false`
- `ADMIN_2FA_REQUIRED=true`
- `DATABASE_SSL=require`
- `DATABASE_POOL_MAX=3`
- `ACTIVATION_KEK_ACTIVE_VERSION=1`
- `SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK=false`
- `PAYMENTS_LIVE_ENABLED=false`
- `SUPPLIER_LIVE_ENABLED=false`
- `EMAIL_LIVE_ENABLED=false`
- `CATALOGUE_SYNC_ENABLED=false`
- `ANALYTICS_ENABLED=false`
- `STAGING_ACCESS_ENABLED=false`

**Secrets that must be generated (not reused from local/demo)**

- `DATABASE_URL` — Neon pooled URL
- `DATABASE_MIGRATION_URL` — Neon direct URL (migration tooling only)
- `AUTH_SECRET` — at least 32 random characters
- `ACTIVATION_KEK_V1` — base64-encoded 32 bytes
- `SUPPLIER_CREDENTIAL_KEK` — a **different** base64-encoded 32-byte key
- `INTERNAL_JOB_SECRET` — high-entropy random string
- `RATE_LIMIT_HASH_SECRET` — high-entropy random string
- `ANALYTICS_HASH_SECRET` — dedicated high-entropy HMAC key, distinct from the other secrets
- `HEALTH_CHECK_TOKEN` — optional, but recommended for detailed health diagnostics

**After HTTPS only**

- `APP_URL=https://esimprove.com` — leave unset until HTTPS and the canonical domain are active.

**Preview/staging only**

- `MOCK_PAYMENT_WEBHOOK_SECRET` — preview-only random secret
- Separate preview `DATABASE_URL`, secrets, and KEKs; never reuse production values.

**How to generate the secrets safely (recommended):** run a local Node command that writes the
values directly to an ignored file such as `.env.production.local` (covered by `.env.*`), with
restricted permissions, and then enter them into Netlify’s secret UI. Do not print them into a
terminal, report, ticket, or chat. Example shape (not executed):

```powershell
node -e "const c=require('crypto'),fs=require('fs');fs.writeFileSync('.env.production.local',['AUTH_SECRET='+c.randomBytes(48).toString('base64url'),'ACTIVATION_KEK_V1='+c.randomBytes(32).toString('base64'),'SUPPLIER_CREDENTIAL_KEK='+c.randomBytes(32).toString('base64'),'INTERNAL_JOB_SECRET='+c.randomBytes(48).toString('base64url'),'RATE_LIMIT_HASH_SECRET='+c.randomBytes(48).toString('base64url'),'ANALYTICS_HASH_SECRET='+c.randomBytes(48).toString('base64url'),'HEALTH_CHECK_TOKEN='+c.randomBytes(32).toString('base64url')].join('\n')+'\n',{mode:0o600});"
```

I have **not** run this and have **not** generated any production secret.

---

## 10. Remaining production blockers

| Area | Status |
| --- | --- |
| GitHub remote | Points at `teachermike2026-ship-it/esimprove`; intended `mohamedouaarab-dotcom` repository not confirmed; no `gh` auth |
| Netlify site/access | Not created; no deploy access or Netlify-scoped variables |
| Neon connection/migration | Not connected or migrated; backups/PITR not confirmed |
| Production secrets/KEKs | Not generated |
| Production administrator | Not created |
| Preview database | Not provisioned; must be isolated from production |
| Email | No live provider; `EMAIL_LIVE_ENABLED=false` |
| Supplier | No live eSIM supplier adapter; `SUPPLIER_LIVE_ENABLED=false`; N-07 open |
| Whop | Catalogue empty (0 products/variants); no plan mapping or webhook secret; checkout fail-closed; `PAYMENT_PROVIDER` unset |
| Legal content | Placeholder/needs-review content; owner business details and legal review outstanding |
| Scheduler | No verified production scheduler; `POST /api/jobs/run` has no configured caller |
| Backups | No backup/restore rehearsal |
| Inventory | Local catalogue is demo data (previous reports describe 99 demo plans); not real purchasable inventory; not copied to Neon |
| Browser/accessibility QA | No completed responsive/accessibility verification |
| Deployment verification | No actual Netlify deploy or production smoke test |
| Domain/DNS | `esimprove.com` parked on Hostinger (`2.57.91.91`); `www` CNAMEs to apex; no Netlify DNS/HTTPS |

The site must not present demo inventory as real purchasable eSIM plans. Keep demo labelling and all
live flags disabled.

---

## 11. Approval gates and exact next actions

Gate **A** is complete. Gates **B–F** have not been done and each needs explicit owner approval.

| Gate | Action | Why it needs approval | What I need from you |
| --- | --- | --- | --- |
| **A** | **DONE (2026-11-23).** Applied the verified `next@16.4.6` package/lockfile change to the main checkout; `npm ci`, typecheck, lint, 20 focused tests, build, and production audit passed | — | No further action |
| **B** | Generate strong production secrets into `.env.production.local` (ignored, not printed) for entry into Netlify | Creates real production credentials | “Approve gate B” and confirm the file path |
| **C** | Confirm/create `mohamedouaarab-dotcom/esimprove`, authenticate `gh`, change the remote, review the full diff, commit, and push | External GitHub change and commit/push | Repository confirmation + “Approve gate C” |
| **D** | Create the Netlify site, set production/preview variables, create an isolated preview Neon branch, run the first migration with the direct Neon URL, verify health | External production-impacting operations and the first schema write | Neon backup confirmation + “Approve gate D” |
| **E** | Connect `esimprove.com` / `www` to Netlify using the **exact records Netlify displays**, then set `SITE_URL` and `APP_URL` after HTTPS | DNS cutover affects the live domain | “Approve gate E” after the Netlify site exists |
| **F** | Enable any payment, supplier, email, or catalogue-sync flag | Live commerce and external integrations | Separate written approval; not requested here |

**Exact next action for you:** Gate A is complete. The next decision is **gate C** — confirm that
`mohamedouaarab-dotcom/esimprove` is the intended GitHub repository and approve the remote
change/commit/push — or **gate B** to generate production secrets into an ignored local file. You
can approve both in one reply. I will stop again before any GitHub, Netlify, Neon, DNS, or payment
operation.

---

## 12. Evidence log (no secrets)

- `git rev-list --left-right --count origin/main...HEAD` → `0  9`.
- `git status --porcelain` → 179 entries at initial inspection; 184 currently (136 modified,
  48 untracked, including this report).
- Migration file sizes: 0001 11,736 B; 0002 7,671 B; 0003 2,716 B; 0004 1,745 B; 0005 6,625 B;
  0006 23,540 B; 0007 449 B; 0008 225 B; 0009 1,431 B.
- Schema counts: 64 tables, 105 indexes, 0 extensions/custom types.
- Destructive-statement scan: no matches for `DROP TABLE`, `DROP COLUMN`, `DROP INDEX`,
  `TRUNCATE`, `DELETE FROM`, or `ALTER TABLE ... DROP`.
- `0006` insert scan: 6 inserts, each with `ON CONFLICT ... DO NOTHING`.
- `.env.local` SHA-256 unchanged.
- `.pglite`: 1,343 files / 60,817,548 bytes; `.audit/impl-db`: 1,349 files / 60,907,770 bytes.
- Port 3000: no listener at inspection.
- Worktree: Next 16.4.6, React 19.3.1; 4 test files / 20 tests passed; build passed;
  `npm audit --omit=dev` = 0; full audit = 7 moderate dev-only.
- Main checkout after gate A: Next 16.4.6; typecheck, lint, 4 focused test files / 20 tests, and the
  production build passed; `npm audit --omit=dev` = 0. `.env.local` hash and both local database
  totals remained unchanged.
- Synthetic deployed migration refusal exited 1 without contacting a database.
- Synthetic production preflight passed without contacting a database.
- No Neon, Netlify, GitHub, DNS, or payment request was made.

---

**Report generated from the actual repository state on 2026-11-23. No claim in this report is
based on a configuration, migration, deployment, or verification that did not occur.**
