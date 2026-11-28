# ESIMPROVE — Recovery onto the new Neon database: preparation report

Date: 2026-11-28 · Branch: `feat/nodereal-crypto-checkout` · Status: **prepared, waiting for your approval to switch production**

**What was done:** the new Neon database was built and verified, and the catalogue was restored into it. All other work happened on this machine.

**What was not done:**
- The old database was not changed (it is quota-blocked).
- Netlify production variables were not changed.
- Nothing was pushed or deployed, and no production traffic was switched.
- Live payments were not enabled.
- No payment, refund, eSIM purchase, eSIM activation or customer email took place.

---

## 1. Summary

| Item | Result |
|---|---|
| Old database (`ep-smal…2ych`) | Still refuses connections: Neon error **53000 "exceeded the quota"**. Nothing was read or changed. |
| New database (`ep-wild…uvkj`, `neondb`, PostgreSQL 18.7, AWS us-east-2) | Full schema built and verified, catalogue restored, **no customer data** |
| Local rehearsal (temporary PostgreSQL 17.12) | All 17 migrations applied and verified, then the catalogue rebuilt |
| Schema verification (new database) | **2,633 checks, 0 problems** |
| Catalogue (new database) | **8 regions, 244 destinations, 3,300 published plans**; every live sitemap URL is present; sampled prices match the live site |
| Crypto job change | Every 1 min → every 15 min. Reviewed: no missed payments; the trade-offs are in §5 |
| Tests / lint / TypeScript / build | See §7 |

---

## 2. ⚠️ What the new database does NOT contain

The new database **does not contain any historical records** from the old database. They stay in the old Neon project, untouched, until it can be read again.

| Missing until the old data is merged | Tables | Effect while missing |
|---|---|---|
| **Customers and admin accounts** | `users`, `sessions`, `user_identities`, `user_preferences`, `password_resets` | Nobody can sign in, **including your admin**, until a new admin is created (§6) or the old accounts are merged |
| **Orders** | `orders`, `order_items`, `order_events`, `order_status_history`, `order_access_tokens`, `carts`, `cart_items` | Existing customers' order links (`/orders/ES-…?token=…`) show "not found" |
| **Payments** | `payments`, `payment_events`, `crypto_payments`, `payment_provider_cases`, `refunds`, `invoices`, `webhook_events` | Payment history and refund records are missing from admin. A Whop webhook for an **old** order is acknowledged without processing, because the order is unknown, and needs merging later |
| **eSIM profiles** | `esims`, `supplier_transactions`, `fulfillment_jobs`, `outbox_events`, `activation_access_logs` | Customers who already bought an eSIM can't reopen their QR code on the website until the merge. Their eSIMs keep working on their phones |
| **Support, email, consent, analytics** | `support_tickets`, `support_messages`, `email_events`, `notifications`, `cookie_consents`, `consent_events`, `user_consents`, `privacy_requests`, `email_subscriptions`, `analytics_*` | History is missing; new activity is recorded normally |
| **Admin-edited settings** | `system_settings` (for example the supplier low-balance threshold), `admin_settings`, `seo_settings`, `legal_settings`, `legal_document_versions`, `legal_third_parties`, `data_retention_settings`, `coupons`, `pricing_rules`, CMS blog articles, `audit_logs` | **Code defaults apply** until the merge. Anything changed through the admin panel (SEO verification codes, legal business details, coupons, thresholds) reverts to defaults |

**What is complete in the new database:**
- **From the code:** all 10 blog articles and their category pages, the legal texts, and the site layout.
- **Catalogue:** rebuilt from eSIM Access.

**Merging the old data later:** once the old project is readable, I back it up with `pg_dump` to `F:\ESIMPROVE-BACKUPS`, then copy its records into the new database.
- IDs are random, so new and old rows don't collide.
- The catalogue and regions are skipped where they already exist.
- The merge needs its own approval.

---

## 3. Schema verification

- **Migration files:** `db/migrations` holds **17** files (`0001_initial` … `0017_email_provider_ids`). An earlier report said 18; that was wrong.
- **Verifier:** a new script, `scripts/verify-schema.ts`, makes only read-only catalog queries. It compares the database with the app's Drizzle schema (`lib/db/schema.ts`) and the migration files, covering:
  - migrations recorded in `schema_migrations`;
  - every table and column, with type and nullability;
  - primary keys, unique constraints and indexes;
  - foreign keys, including the referenced columns and `ON DELETE`.

| Database | Migrations recorded | Tables | Indexes | Foreign keys | PK/unique/check constraints | Problems |
|---|---|---|---|---|---|---|
| Local rehearsal (PostgreSQL 17.12) | 17 / 17 | 67 app + `schema_migrations` | 193 | 49 | 95 | **0** |
| New Neon (PostgreSQL 18.7) | 17 / 17 | 67 app + `schema_migrations` | 193 | 49 | 95 | **0** |

**Notes (not problems):**
- **Two unique indexes are already covered.** `legal_settings_id_unique` and `seo_settings_id_unique` exist in the Drizzle code, but each sits on the primary-key column, and the primary key already enforces uniqueness.
- **Pre-existing difference.** Six legal "effective date" columns are `date` in the SQL migrations and `text` in the Drizzle code. The old production database was built from the same migrations, so it has the same difference; it isn't caused by this move. A small follow-up could make them consistent.

**How the new database was migrated:** with the production code path.
- `APP_ENV=production`, `DATABASE_ENV=production`, and a dedicated `DATABASE_MIGRATION_URL`.
- One transaction, holding an advisory lock.

---

## 4. Catalogue restore (supplier API used read-only)

- **Regions:** `scripts/bootstrap-regions.ts` (new) creates the same 8 regions, with the same IDs, slugs, names and accents as the live site. It only adds missing rows, so it's safe to re-run.
- **Catalogue:** `scripts/catalog-sync.ts` read the eSIM Access package list, a read-only listing. No order, top-up or activation call is made.

| Result | |
|---|---|
| Packages retrieved / valid / created | 3,300 / 3,300 / 3,300 |
| Destinations created | 244 (202 countries, 42 multi-country) |
| Packages by type | 2,916 country, 369 regional, 15 global |
| Pricing used | target profit $3.00, card fee 4.2% + $0.30 (identical to the Netlify production values) |
| Live sitemap URLs present | destinations 244/244, regions 8/8, plans 3,300/3,300 |
| Price spot check against live pages | `esim-ae-0-1-7` $3.76 ✓ · `esim-cd-0-5-daily` $5.53 ✓ · `esim-cd-3-15` $13.05 ✓ · `esim-cd-2-daily-1mbps` $11.38 ✓ |

**Why the catalogue was loaded before the switch:** a full sync took about 12 s locally. In production it runs inside the scheduled job's time limit, and this way the shop has products from the first request.

---

## 5. Crypto background job: every minute → every 15 minutes

**Change:** `netlify/functions/crypto-payment-monitor.ts` now runs `*/15 * * * *` (documented in `docs/CRYPTO-PAYMENTS.md`).

**Review results:**
- **Detection while the page is open: unchanged.** The payment page calls `/api/orders/[id]/verify` every few seconds.
- **No missed transfers.** Each payment stores how far it has scanned (`scannedToBlock`) and the next scan resumes there, with a reorg margin. 15 minutes is about 2,000 BSC blocks, well inside one 50,000-block request.
- **Payment expiry: correct.** Expiry follows each payment's `expiresAt` time, not the job schedule. Supplier-balance reservations stop counting a payment the moment it expires. The visible status changes to "expired" at the next check, whether from the open page or within 15 minutes from the job.
- **Late payments and reconciliation: unchanged.** Expired payments are still re-scanned for 24 hours. Reserved amounts are released after the late window (at most 15 minutes later than before), and reconciliation reads stored records.
- **Fulfillment: immediate.** It runs inline the moment a crypto payment confirms (`verifyCryptoPayment` → `runOutboxAndJobs`), from the page or from the job. Card webhooks also fulfil immediately. The job only **retries failed fulfillments**, now within 15 minutes instead of 1.
- **Pending-payment recovery:** a customer who closes the page before confirmation (about 7 s on BSC) gets the eSIM within 15 minutes instead of 1.
- **Concurrency: unchanged.** Paying exactly once when the page and the job check at the same time is already covered by tests.

**What this change does NOT solve:**
- **Compute is reduced.** The database can now sleep between runs, roughly a third of the time awake instead of always.
- **The quota type is unknown.** Neon's error doesn't say *which* quota was exceeded. It could be compute hours or **network transfer (data out)**.
- **Transfer is unaffected.** It comes mainly from page views: every catalogue page queries the database, and search engines and AI crawlers fetch about 3,600 URLs repeatedly.
- **Next steps:**
  - check the old project's **Usage** page to see which limit was hit;
  - consider caching the catalogue pages (a separate change) to cut database reads;
  - watch the new project's Usage page daily for the first week.

---

## 6. Admin access (prepared, not created)

The new database has **no admin account**.

**Why I didn't create one:** `scripts/create-admin.ts` stores your password as a hash and protects the two-factor secret with **`ACTIVATION_KEK_V1`**. That key must equal the **production** one on Netlify, which can't be read. The local copy in `.env.local` was very likely the source of Netlify's value, but that can't be confirmed before a sign-in test. Creating it myself would also mean handling your password, so you run it in your own PowerShell window, after the switch is approved.

1. **Generate a new two-factor secret** (shown only in your window):
   ```powershell
   node -e "const c='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let s='';for(const b of require('crypto').randomBytes(20))s+=c[b%32];console.log(s)"
   ```
   Add it to your authenticator app as a new account named "ESIMPROVE admin".

2. **Create the admin.** Put your values in place of the placeholders, use a long new password, and run it in the project folder:
   ```powershell
   $env:APP_ENV='production'; $env:DATABASE_ENV='production'; $env:ADMIN_CREATE_CONFIRM='CREATE'
   $env:DATABASE_MIGRATION_URL=(Get-Content F:\ESIMPROVE-BACKUPS\target-db-url.txt -First 1)
   $env:ADMIN_EMAIL='<your admin email>'; $env:ADMIN_PASSWORD='<new password>'; $env:ADMIN_TOTP_SECRET='<secret from step 1>'
   npx tsx scripts/create-admin.ts
   ```
   Then close that PowerShell window, so the variables don't linger.

3. **After the switch:** sign in at `/login`.
   - If the two-factor step rejects valid codes, the key differs. Nothing is harmed, but the admin has to be recreated with the production key. Your old admin account also returns with the data merge.

---

## 7. Checks

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ pass |
| ESLint (`--max-warnings=0`) | ✅ pass (the project config skips `scripts/`) |
| Full test suite | ✅ **567 / 567** in 55 files |
| Production build (`next build`) | ✅ pass |

---

## 8. Production switch plan (needs your explicit approval)

1. **You** create the admin (§6), or decide to wait for the merge.
2. **Neon connection string:** copy the new database's **pooled** connection string (Neon → Connect → pooling ON) for the app. The direct string stays for migrations and the merge.
3. **Netlify production:** with your approval, set `DATABASE_URL` to the new pooled string, either in the Netlify UI by you or by me through the CLI without printing it. Every other variable stays as it is.
4. **Legal date:** set `LEGAL_EFFECTIVE_DATE` to the deploy day.
5. **Deploy:** merge into `main` and deploy the verified commit.
6. **Safe checks, no payments:**
   - `/api/health` is OK;
   - home, destination and plan pages load, with prices;
   - checkout loads and the embedded Whop form starts without paying;
   - the crypto page renders without a transfer;
   - the webhook returns 400 to an unsigned request;
   - the logs are clean.
7. **Monitoring:** watch the new Neon Usage page.

**Rollback:** set `DATABASE_URL` back to the old string and publish the previous deploy. The old database is untouched, though it stays quota-blocked until its reset.

---

## 9. Files changed (local, not committed)

| File | Change |
|---|---|
| `netlify/functions/crypto-payment-monitor.ts` | Schedule `* * * * *` → `*/15 * * * *`, with the reason documented |
| `docs/CRYPTO-PAYMENTS.md` | Schedule description updated |
| `scripts/bootstrap-regions.ts` | **New:** creates the 8 storefront regions on an empty database (insert-only, same guards as migrate) |
| `scripts/verify-schema.ts` | **New:** read-only schema verification against Drizzle and the migrations |
| `docs/NEW-NEON-DATABASE-RECOVERY.md` | This report |
