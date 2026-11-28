# ESIMPROVE — Moving from Neon to Netlify Database: compatibility report and plan

Date: 2026-11-28 · Status: **proposal for review, nothing executed**

**What was done:** read-only checks of the code, the Netlify account, the CLI and Netlify's official docs.

**What was not done:**
- No database was created and no data was copied.
- Neon was not touched.
- No environment variable was changed.
- Nothing was pushed or deployed.

---

## 1. Verdict

**Netlify Database suits ESIMPROVE technically, with one condition: the every-minute background job must change first.** Without that change, the database never sleeps and costs about **$60–65 a month** in extra credits.

| Question | Answer |
|---|---|
| Does your plan support it? | **Yes.** The account is *Personal, credit-based* (`credit-personal`, 1,000 credits/month, auto top-up 500 credits for $5). Netlify Database requires a credit-based plan. |
| Is the code compatible? | **Yes.** It uses the standard `pg` driver and Drizzle through `DATABASE_URL`. There are no Neon APIs, SDKs or Neon-specific SQL. |
| Is it already provisioned? | **No.** `netlify database status --branch main` reports no database branch yet. |
| Does it solve today's deploy blocker? | **Yes.** Once it exists, `netlify database status --show-credentials` gives the connection string through your Netlify login. You won't need a separate Neon account to reach the database. |
| Backups without paying more? | **Yes.** Personal includes **7-day scheduled backups** plus a backup at each of the last 3 published deploys. |
| Card data (PCI)? | **No problem.** Netlify Database is not PCI-certified, but ESIMPROVE never stores card data; Whop handles all card details. |
| Is anything undocumented? | Underlying provider, region, Postgres version, connection limits, SLA and what happens when limits are exceeded. These matter for the privacy policy and reliability. |

---

## 2. Compatibility audit

### Database architecture today
- **Drivers:**
  - Production uses `pg` 8.23 through a `Pool` with `max` 3, 10 s idle timeout and 15 s statement timeout, with TLS required (`DATABASE_SSL=require`).
  - Local development and tests use PGlite (`.pglite`), which is untouched by this move.
- **ORM:** Drizzle (`drizzle-orm/node-postgres` in production).
- **Migrations:** 18 SQL files in `db/migrations` (0000–0017), applied by our own runner.
  - It records each one in the `schema_migrations` table.
  - It runs in one transaction and holds a PostgreSQL advisory lock.
  - Production runs it explicitly with `npm run db:migrate` (`scripts/migrate.ts`), never at app start.
- **Connection settings:** `DATABASE_URL` (app) and `DATABASE_MIGRATION_URL` (migrations, seed and admin scripts), plus `DATABASE_SSL`, `DATABASE_SSL_CA`, `DATABASE_ENV` and `DATABASE_POOL_MAX`.
- **Production safety checks:** in `lib/config.ts`, `DATABASE_URL` must be `postgres://` with TLS, not localhost, and `DATABASE_ENV` must equal `APP_ENV`.

### Neon dependencies found
| Location | Dependency | Change needed |
|---|---|---|
| Netlify env `DATABASE_URL` | Neon connection string | Point to Netlify Database (see §5) |
| `lib/legal-content/{en,fr,es,ar}.ts` | Privacy policy names **"Neon (AWS, United States)"** as a data processor | Name Netlify (and its database provider and region once Netlify confirms them) |
| Code and SQL | None | — |
| `lib/db/client.ts` comment | Mentions a "provider pooler" | Comment only |

### Conflicts with Netlify's own migration system
- Netlify applies migrations it finds in `netlify/database/migrations/` automatically before each deploy is published.
- ESIMPROVE keeps its migrations in `db/migrations/`, so there is **no conflict**. Netlify's docs confirm the native system is optional and your own migration tool is allowed.
- What we lose by keeping our runner: Netlify has no automatic hook to run *our* migrations on production deploys. They still need to be run before the deploy (the same as today, but now with access through the CLI).

---

## 3. Costs (Personal plan, from Netlify's billing page, updated 2026-11-14)

**Prices**
- Compute: **10 credits per compute unit**, where 1 unit = 1 hour of the default 1-unit size.
- Bandwidth: **20 credits per GB**.
- Storage: **free for now** (Netlify promises advance notice before it starts charging).
- Credit price: auto top-up is 500 credits for $5, so **$0.01 per credit**.
- Included credits: the plan's 1,000 credits a month are **shared** with builds, functions and site bandwidth.

**Personal plan limits per database**
- Compute size: 1–4 units.
- Sleep: always after 5 minutes idle; it cannot be kept always on.
- Monthly caps: 100 GB written, 100 GB bandwidth and 100 GB storage.
- Branches: 100.
- Overage behaviour: **not documented**.

| Scenario | Database awake | Compute credits/month | Estimated extra cost |
|---|---|---|---|
| **As today:** `crypto-payment-monitor` runs **every minute** and queries the database | ~24/7 ≈ 730 h | ~7,300 | **≈ $63/month** above the included credits |
| Job every 15 minutes | ~⅓ of the time ≈ 245 h | ~2,450 | ≈ $15/month |
| Job queries the database only when a crypto payment is open (a small flag kept outside the database) | only during real traffic and payments, roughly 30–90 h | 300–900 | ≈ $0–5/month |
| Bandwidth (small database, low traffic) | — | < 40 | negligible |

**Note on Neon (unverified):** the every-minute job probably keeps today's Neon database awake too. Neon's free plan has a monthly compute allowance, so check its usage page.

**Recommendation before moving:** change the background job to the third row. Run it every minute only while crypto payments are pending, and otherwise every 15–30 minutes without touching the database. This is a small, testable code change and keeps crypto detection just as fast.

**Cold starts:** on Personal the database sleeps after 5 idle minutes. The first request after a sleep waits for it to wake, typically under a second up to a few seconds. Checkout and webhooks already tolerate this: Whop retries webhooks, and the database timeout is 10 s.

---

## 4. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Orders or payments written to Neon after the export are lost | **High** | Maintenance window: pause new payments first (§5, step 6), make sure no crypto payment is open, then export |
| Webhooks arriving during the switch | Medium | Whop retries failed deliveries; process them after the switch, and check Whop's failure counter afterwards |
| Version mismatch between `pg_dump` and Neon | Medium | Install client tools that match the server version; rehearse on a preview branch first |
| Unexpected costs | Medium | Fix the job schedule first (§3); set a Netlify credit alert |
| Undocumented provider, region or overage behaviour | Medium | Ask Netlify support before cutover; update the privacy policy |
| Encrypted eSIM activation data | Low | It's encrypted with the app's own keys (`ACTIVATION_KEK_*`), not tied to the host, so copying ciphertext keeps it readable. Spot-check one delivered order after the switch |
| Pending migrations 0016/0017 | Low | Apply them to the new database during the rehearsal and the cutover, **before** deploying the new code |
| Rollback after new orders exist | Medium | Keep Neon untouched for at least 2 weeks; the rollback procedure includes copying back any new rows |

---

## 5. Migration plan (each phase needs your approval)

**Phase 0 — Preparation (no production impact)**
1. Install PostgreSQL client tools matching Neon's server version (`pg_dump`/`pg_restore`).
2. Change the background job so it doesn't keep the database awake (§3). Test it, commit it, and review it with you.
3. Ask Netlify support for: provider, region, Postgres version, connection limit and overage behaviour.
4. Decide how the app connects:
   - **Option A (recommended):** a small code change. When no `DATABASE_URL` is set, use `getConnectionString()` from `@netlify/database`. Previews then get their own isolated database branch automatically, and nothing secret has to be copied by hand.
   - **Option B:** no code change. Set `DATABASE_URL` (production context only) to the Netlify connection string. Never set it for previews, or previews would use the production database.

**Phase 1 — Full backup of the current Neon database (read-only on Neon)**
1. You place the Neon direct connection string in `C:\Users\hp\esimprove-backups\db-url.txt`, outside the repository. Never paste it in chat.
2. Run `pg_dump -Fc` to create `C:\Users\hp\esimprove-backups\esimprove-neon-<date>.dump`, then verify it with `pg_restore --list`.
3. Test-restore it into a throwaway local PostgreSQL database and compare row counts with Neon (read-only queries).

**Phase 2 — Provision Netlify Database and rehearse (no production traffic)**
1. Run `netlify database init`. This creates the database; it needs your approval and uses credits.
2. Load the full dump into a **preview branch** of the Netlify database (schema and data, including the `schema_migrations` history).
3. Run `npm run db:migrate` against the preview branch, applying **0016 and 0017**.
4. Deploy a preview build connected to that branch and test it without payments:
   - pages, admin, existing order pages and QR codes;
   - the checkout pages load and the embedded Whop form starts, without paying;
   - the crypto payment page renders, without sending any transfer.
5. Compare row counts and checksums for `users`, `orders`, `order_items`, `payments`, `crypto_payments`, `esims`, `webhook_events`, `email_events`, `audit_logs` and `schema_migrations`.

**Phase 3 — Production cutover (planned low-traffic window, about 30 minutes)**
1. In Netlify (production), set `SUPPLIER_LIVE_ENABLED=false` and redeploy.
   - This uses the existing safety switch: checkout shows "temporarily unavailable" and no new payment can start.
   - Whop and crypto configuration stay as they are.
2. Wait until no crypto payment is open (at most the 30-minute payment window) and the fulfillment queue is empty.
3. Make a final `pg_dump -Fc` from Neon, then restore it into the Netlify **production** branch.
4. Apply migrations 0016 and 0017 to the Netlify production branch (credentials come from `netlify database status --show-credentials`, piped straight into the command and never printed).
5. Verify row counts and checksums against the final Neon dump.
6. Switch the connection (Option A or B), set `SUPPLIER_LIVE_ENABLED=true` back, and deploy the verified commit (the redesign, the audit fixes and `11f07d6`).
7. Run the safe checks:
   - site, checkout and the Whop form start;
   - the crypto page renders;
   - the webhook rejects unsigned requests;
   - `/api/health` responds and the logs are clean;
   - one existing delivered order still shows its QR code.

**Phase 4 — Clean-up (after at least 2 weeks of stable production)**
1. Update the privacy policy's list of data processors in all 4 languages.
2. Archive a final Neon dump, then remove Neon credentials from Netlify.
3. Decommission Neon only after your explicit approval.

---

## 6. Rollback

- **Before Phase 3 step 6:** nothing has changed for production. Discard the Netlify database branch.
- **After the switch, problem found quickly:**
  1. Pause payments again (`SUPPLIER_LIVE_ENABLED=false`).
  2. Copy any orders, payments, eSIMs and webhook events created since the switch back to Neon, using `pg_dump --data-only` filtered by creation time. This is a scripted, reviewed step.
  3. Restore Neon's `DATABASE_URL`.
  4. Publish the previous deploy in Netlify → Deploys.
  5. Re-enable payments.
- **Safety nets:** Neon stays untouched and the local dumps are kept throughout. Netlify also keeps its own backups (7 days, plus one at each of the last 3 published deploys).

---

## 7. What this means for the current deploy

Moving to Netlify Database **solves the access problem**, but it is a bigger change than the deploy needs. Two ways forward:

1. **Fastest:** provide the Neon connection string once, locally (§5 Phase 1, step 1). I then back up Neon, apply 0016/0017 and deploy the verified code on Neon. The move to Netlify Database follows later as its own project.
2. **All at once:** do Phases 0–3, with the verified code deployed during the cutover. This takes longer and has more moving parts in a single window.

My recommendation is **option 1 now, then the move to Netlify Database after the background-job change**. That keeps each step small and separately reversible.

---

Sources (official):
- [Netlify Database billing and limits](https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/)
- [Switch to Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/switch-to-netlify-database/)
- [Netlify Database migrations](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/)
- [Netlify CLI database commands](https://cli.netlify.com/commands/database/)
