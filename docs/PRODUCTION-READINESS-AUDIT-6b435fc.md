# ESIMPROVE — Production-readiness audit of commits 8e6cd8f and 6b435fc

**Date:** 2026-11-27 · **Branch:** `feat/nodereal-crypto-checkout` at `6b435fc` · **Production:** unchanged on `d0feef5`.
Read-only audit. Nothing was merged, pushed to `main`, deployed or migrated, and no refund, payment or email was made.

## Verification (re-run on 6b435fc)
| Check | Result |
|---|---|
| TypeScript | **PASS** |
| ESLint (0 warnings allowed) | **PASS** |
| Automated tests | **PASS: 518/518 in 52 files** |
| Production build | **PASS** |
| Local production build: Apple Pay file path, `/checkout` and `/orders` pages, no sign-in buttons without credentials | **PASS** |

## Risk-ranked findings

### HIGH 1. The new refund rule loosens a manual-review safeguard (recommend tightening before deploy)

**How a refund webhook is processed** (`lib/payments/whop-webhooks.ts`, `applyCaseEvent`):
1. **Signature:** the webhook signature is verified first (Standard Webhooks). Unsigned or forged events are rejected with 400.
2. **Find the payment:** by signed metadata (internal payment ID plus order ID), then by Whop's payment ID. Cases for payments ESIMPROVE didn't create are acknowledged and ignored.
3. **Duplicate protection:**
   - Each webhook ID is claimed once in `webhook_events`, which has a unique key, so a repeated or replayed webhook changes nothing.
   - Each refund or dispute is one row in `payment_provider_cases`, unique per (provider, kind, Whop case ID). Updates to the same refund overwrite that row instead of adding to the total.
4. **Review gate:** the case is sent to manual review (`needsReview`, plus an admin alert and the payment status left unchanged) when:
   - the amount is not exact in its currency;
   - the currency differs from the payment;
   - **new in 6b435fc:** the amount is more than 2× the payment.

   Before 6b435fc, *any* amount above the payment went to review.
5. **Full or partial:** only when a refund has status `succeeded`, the app adds up all succeeded, non-review refund cases for the payment.
   - Total ≥ payment amount: the payment is `refunded`.
   - Total below it: the payment is `partially_refunded`.

   Transitions are enforced: paid can become refunded, partially refunded or disputed; partially refunded can become refunded; disputed can become refunded. Nothing moves backwards.
6. **On refund:** the order's eSIMs are marked `refund_flagged`, and an admin alert is raised.

**Over-refund protection on our side:** ESIMPROVE starts a refund in only one place: the admin "Refund via Whop" button.
- It requires a ticked confirmation box and the `refunds.write` permission.
- It works only on payments that are `paid`, `disputed` or `partially_refunded`.
- It asks Whop for a **full** refund only (no amount parameter).
- It uses one idempotency key per payment (`esimprove_refund_<paymentId>`), so a second click or a retry can't create a second refund.

Webhooks only *record* what Whop did; they never move money.

**The weakness:**
- **Too generous:** the 2× limit is far wider than currency conversion needs. The real sandbox case was $4.71 on a $4.28 order, about 110%.
- **Per case only:** it is checked per refund, not cumulatively. Two refunds of 1.9× each would both be accepted without review, a total of 3.8×. Money isn't lost through our code in that case, because Whop executes refunds, but an anomaly would no longer reach a human.

**Recommendation (needs your approval):**
- Lower the limit to **115% of the payment**, checked **both per case and on the cumulative total** for the payment.
- Anything above it stays on manual review.
- Add tests for the cumulative case.

### HIGH 2. A real customer checkout already exists on production
- **What's there:** one live order, `ES-261127-E41648`: guest, $3.76 USD, Whop card checkout created 08:16 UTC today, about 9 minutes after the 08:07 deploy.
- **Status:** **pending, not paid.** There are 0 webhook events and nothing was fulfilled. It may have been your own test.
- **Why it matters for the deploy:** a pending Whop checkout from the current version keeps working after the deploy, because the payment page and webhook handling are compatible. If the customer pays later, the signed webhook still settles it.
- **Webhook secret:** no live webhook has been received yet, so the live webhook secret is still unconfirmed.

### MEDIUM 3. Legal document version not bumped
The Privacy and Cookie texts changed in 6b435fc: Whop billing data, wallets, Google/Apple sign-in, Resend, and two new cookies. But `LEGAL_DOCUMENT_VERSION` is still **2.0, effective 26 Nov 2026**. Before deploy, bump it to **2.1** with the deploy date. Checkout already re-checks the version, so customers with a stale page are asked to reload.

### MEDIUM 4. Apple Pay file should be a static file, not an environment variable
- **What's built:** the route serves `APPLE_PAY_DOMAIN_ASSOCIATION` at `/.well-known/apple-developer-merchantid-domain-association`. Tested: 200, `text/plain`, no redirect, 404 while unset.
- **The problem:** Apple's association file is usually several kilobytes. Netlify functions have a **4 KB total limit for all environment variables** (an AWS Lambda limit), and the site already has 41 variables, so this value may not fit.
- **Recommendation:** when Whop provides the file, commit it as `public/.well-known/apple-developer-merchantid-domain-association`. It's public by design, not a secret. Static files take precedence over the rewrite, so no code change is needed. Keep the variable route as a fallback.

### MEDIUM 5. Refunds don't cancel the eSIM at the supplier
A refund marks the order's eSIMs `refund_flagged`, but doesn't revoke them at eSIM Access. A refunded customer could keep a working eSIM until an admin cancels it with the supplier. This is consistent with the manual-refund policy, but it's an operating step.

### LOW 6. Order access tokens travel in the URL
- **Protection:** guest and order links carry a 256-bit token stored hashed, 365 days for guests and 30 days for account orders. `Referrer-Policy: strict-origin-when-cross-origin` keeps it from leaking to other sites.
- **Where it can still appear:** browser history, the dev server's request log, possibly hosting request logs, and the `returnUrl` handed to Whop's form.
- **Assessment:** acceptable for launch. A later hardening would swap the token for an HTTP-only cookie on first open.

### LOW 7. Google/Apple sign-in not tested against the real providers
- **What's tested:** the code is fully unit-tested against fake providers with real signature checks.
- **In production:** buttons stay hidden until credentials are set, so nothing broken is shown.
- **Accounts:** sign-in links to an existing account only via a provider-verified email, admin accounts are refused, and new accounts record Terms, Privacy and age consent with the version.
- **Before enabling:** test it on the live domain. Apple also requires HTTPS and its `form_post` callback.

### LOW 8. Email
**Verified:**
- **Settings read:** `RESEND_API_KEY` and `EMAIL_FROM`; locally `ESIMPROVE Support <support@esimprove.com>`. The esimprove.com domain is verified in Resend.
- **When email is live:** real email is sent only if `EMAIL_LIVE_ENABLED=true` **and** `EMAIL_PROVIDER=resend` **and** a `re_` key **and** a sender address are all set.
- **Misconfiguration:** a misconfigured live-email setup fails the Netlify preflight, so the bad build never publishes. The live site keeps running the previous deploy. It no longer means "always 503".
- **Failure isolation:**
  - The eSIM delivery email runs after the job is marked delivered and never throws.
  - Admin-alert emails are wrapped in a catch, after a durable order-timeline entry.
  - Payment webhooks commit before alerts, and a retried webhook is detected as a duplicate.
- **Tests:** a failing provider still leaves the QR code on the website.
- **Production:** none of the email settings are set yet, so email is off.

### INFO 9. Guest checkout
- **Personal details:** ESIMPROVE collects no email, name or country from guests. They're not required by the form, the server action or the database.
- **Required checkboxes:** the Terms/Privacy box and the immediate-supply box stay required and unticked. For guests, they're recorded against the order ID with the document version.
- **Recovery:** private link, an HTTP-only device list re-verified on each visit, and a rate-limited "Find an order" form.
- **Whop's card form:** it collects the payer's email and billing details for Whop. This is disclosed in the updated Privacy Policy.

## Database: migration 0016
- **Additive only:**
  - `CREATE TABLE IF NOT EXISTS user_identities` and three `CREATE … INDEX IF NOT EXISTS`. No `DROP`, `ALTER`, `UPDATE` or `DELETE`. The only `DELETE` in the file is the `ON DELETE CASCADE` foreign-key rule to `users`.
  - No backfill.
  - Migrations 0001–0015 are byte-identical between `d0feef5` and `6b435fc`, so the runner's checksum check passes.
- **Where the table is used:** only Google/Apple sign-in, which is hidden without credentials. The current production code ignores the table, so migrating **before** the code deploy is safe.
- **Current production state** (read-only): 15 migrations applied (last is `0015`), `user_identities` doesn't exist, 3,300 published plans, 1 user, 1 pending order, 1 pending payment.

### Backup and recovery procedure (not executed)
1. **Snapshot.** In the Neon console (project `esimprove`), open Branches → Create branch, from `main` at "now", named `pre-0016-YYYYMMDD`. This is an instant copy-on-write snapshot. Also note the restore (PITR) window your plan allows.
   - **Optional second copy**, with PostgreSQL client tools installed:
     ```powershell
     pg_dump "$env:DATABASE_MIGRATION_URL" -Fc -f esimprove-pre-0016.dump
     ```
     Keep the file outside the repository.
2. **Migrate.** Follow `docs/PRODUCTION_MIGRATION_RUNBOOK.md` §4: the direct (non-pooler) URL in `DATABASE_MIGRATION_URL`, `APP_ENV=production`, `DATABASE_ENV=production`, then `npm run db:migrate`. Expected output: "Migrations applied on postgres."
3. **Verify (read-only):**
   - `SELECT count(*) FROM schema_migrations` returns 16;
   - `SELECT to_regclass('public.user_identities')` is not null;
   - after deploy, `/api/health` (with the health token) shows `pending: []`.
4. **Recovery:**
   - **Fast rollback:** the table is unused while sign-in is off. If it must be removed and is still empty, run in one transaction:
     ```sql
     DROP TABLE IF EXISTS user_identities;
     DELETE FROM schema_migrations WHERE id = '0016_user_identities.sql';
     ```
   - **Full restore:** reset `main` from the `pre-0016-…` branch, or use point-in-time restore. Orders placed after the snapshot would be lost, so prefer the fast rollback.
   - **Code rollback:** in Netlify, open Deploys, choose `d0feef5`, then "Publish deploy" (instant). The old code works with or without the new table.

## Apple Pay: what's built and what's still manual
- **Built:**
  - Whop is asked for `apple_pay` and `google_pay` alongside `card`.
  - Browser payments are allowed only on `/checkout/pay/*`, for our page and `cdn.whop.com`.
  - The security policy includes Apple Pay's script and font hosts.
  - The association file is served at `/.well-known/apple-developer-merchantid-domain-association`.
- **Still manual (Whop account changes, not made):**
  1. In Whop, add **esimprove.com** as a domain with **Apple Pay** enabled, through the Whop dashboard or the API (`domains.create` with `apple_pay: {}`; the current live key may not have the domains permission).
  2. Whop shows the domain-association file content, or an `action_required` issue whose code block contains it. Commit it as `public/.well-known/apple-developer-merchantid-domain-association` (recommended), or set `APPLE_PAY_DOMAIN_ASSOCIATION`.
  3. Deploy, confirm the URL returns the file over HTTPS with no redirect, then use Whop's "check" so Apple verifies it. The status should become `ready`.
  4. Test on an iPhone or a Mac with Safari: Apple Pay should appear in the card form.
- **Google Pay:** needs no domain step and should appear in supported browsers after deploy. Not yet verified live.

## Production confirmation (read-only)
- **Netlify:** the published deploy is `d0feef5` (ready, 08:07:50 UTC). No newer production deploy; one failed CLI attempt at 08:00 was never published.
- **Netlify variables:** 41. The last change was 07:47 UTC (the live settings set this morning), with **no changes since**.
- **GitHub:** `main` on both remotes is `d0feef5`. The audited work is only on `feat/nodereal-crypto-checkout`.
- **Database:** no schema or record changes by this audit, which used read-only transactions only. The one order and one payment were created by the live site at 08:16, not by me.

## Deployment checklist (for when you approve)
**Before deploy (code, needs your approval):**
- [ ] Tighten the refund rule: 115%, per case and cumulative, with tests (finding 1).
- [ ] Bump `LEGAL_DOCUMENT_VERSION` to 2.1 with the deploy date (finding 3).
- [ ] Re-run typecheck, lint, tests and build.

**Database:**
- [ ] Neon snapshot branch `pre-0016-YYYYMMDD` (plus optional `pg_dump`).
- [ ] Run migration `0016` (runbook §4). Verify 16 migrations and that `user_identities` exists.

**Deploy:**
- [ ] Merge `feat/nodereal-crypto-checkout` into `main` and push. Netlify builds automatically, and the preflight checks the configuration.
- [ ] Confirm the deploy is ready and `/api/health` shows `configuration: ok`, `database: ok`, `pending: []`.

**Smoke test (no payment):**
- [ ] `/checkout` shows the entry screen.
- [ ] The guest step shows only the payment choice and the 2 legal boxes.
- [ ] The card step embeds Whop's form on esimprove.com with no whop.com link.
- [ ] `/orders` works, and the USDT page loads.

**Whop and Apple (manual):**
- [ ] Hide product `prod_Fsw55cZw0Qn4w`.
- [ ] Optionally register esimprove.com for Apple Pay and add the association file.

**First live payment:**
- [ ] Watch the order turn paid through the webhook. This confirms the webhook secret.
- [ ] Confirm the eSIM is delivered with its QR code.

**Optional later:**
- [ ] Resend settings on Netlify: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_PROVIDER=resend`, `EMAIL_LIVE_ENABLED=true`.
- [ ] Google/Apple sign-in credentials.

**Rollback:**
- [ ] Netlify "Publish deploy" on `d0feef5`. The migration can stay.
