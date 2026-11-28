# ESIMPROVE — Pre-launch audit (2026-11-28)

Scope: branch `feat/nodereal-crypto-checkout` at `a5d8afb` (9 commits ahead of the production deploy `d0feef5`).
Everything was checked locally or read-only. Nothing was pushed, merged, deployed or migrated. No real payment, supplier purchase or customer email took place. No secret value was printed.

## Verdict

**The code is ready.** All nine areas pass. Seven configuration steps remain before this branch goes live; they are listed in "Before you deploy" and none of them needs code changes.

| Area | Result |
|---|---|
| Payment security and Whop webhooks | ✅ Pass |
| USDT verification and reconciliation | ✅ Pass |
| Supplier fulfillment and duplicate-order protection | ✅ Pass |
| Guest order access and customer privacy | ✅ Pass |
| Resend email readiness | ✅ Ready locally; ⚠️ not configured in production (emails currently off there) |
| Database migrations and backup/rollback | ⚠️ 2 additive migrations must run **before** deploy |
| Environment variables and Netlify | ⚠️ 2 required actions, 3 optional |
| Sitemap, robots, canonicals, structured data | ✅ Pass |
| Purchase-to-delivery flow | ✅ Pass (see how it was tested) |

Tests: **174/174** in the 16 suites for these areas; **567/567** overall. Typecheck, lint and production build pass.

---

## 1. Payment security and Whop webhooks — ✅
- **Signature checks:** every webhook is verified with Standard Webhooks against the raw body before anything is parsed.
  - The signature is compared in constant time.
  - Timestamps outside **±5 minutes** are rejected, which blocks replayed messages.
  - Failure reasons are never echoed back or logged.
- **Live probe:** an unsigned POST to `https://esimprove.com/api/webhooks/whop` returns **400**.
- **Duplicates:** each event is processed once, using the signed `webhook-id` and a unique database constraint inside a transaction. Concurrent duplicate deliveries are tested.
- **What marks an order paid:** only Whop status exactly `paid`, with the right amount, currency, product (`WHOP_PRODUCT_ID`) and checkout. Anything else is held for **manual review** and the order is not marked paid. This covers discounts, overpayments, different products and different checkouts.
- **Paid only once:** the change to paid is conditional, so fulfillment is queued at most once.
- **Second payment:** a second payment on an already-paid order is flagged for refund review and never re-fulfilled.
- **Browser redirects:** they never change payment status.
- **Refunds:** these are never automatic.
  - Full, partial and over-refunds are reconciled against Whop's payment ledger.
  - Disputes are flagged for an admin.
- **Low-priority note:** a signed event that names an ESIMPROVE order this database doesn't know returns 500, so Whop retries it until it gives up.
  - This could happen if a non-production environment ever created checkouts on the live Whop account.
  - It is harmless, because nothing is processed, but it is noisy.
  - Optional fix: acknowledge it with 200 and raise an admin alert.

## 2. USDT (BEP-20) verification and reconciliation — ✅
- **Configuration:** the chain (56), token contract and wallet are validated at startup; a wrong value stops it with an error.
- **Exact amounts:** each order gets a unique exact amount with a random 4-decimal suffix and a 30-minute window. Amounts are compared as whole integers, never floating point.
- **Paid only when all of these hold:**
  - a successful receipt;
  - exactly one matching Transfer log;
  - **15 confirmations**.
- **Held for review:** underpayments, overpayments, late payments and ambiguous matches.
  - A transaction hash can never be reused for a second order.
- **Resilience:**
  - RPC failures fall back to a second provider and are never read as "no payment".
  - Several checks running at once pay the order exactly once.
  - A database failure mid-payment recovers and pays once.
- **Reconciliation:** `/admin/reconciliation` keeps USDT separate from Whop.

## 3. Supplier fulfillment and duplicate-order protection — ✅
- **Before checkout takes any money:**
  - supplier ordering must be enabled;
  - the supplier balance must cover this order plus every paid order still waiting.
  - Otherwise checkout refuses to start ("temporarily unavailable"). This was confirmed in the browser.
- **eSIM Access orders:**
  - Each order uses an idempotent transaction ID, so it is placed once.
  - After a crash, fulfillment resumes from the recorded supplier order instead of ordering again.
  - A wrong number of eSIM profiles, or a profile that already belongs to another order, is never delivered.
  - Insufficient balance after payment keeps the payment and goes to manual review.
- **Fake eSIMs:** none are ever issued for a real package. Demo plans are local-only and cannot be bought.

## 4. Guest order access and customer privacy — ✅
- **No personal data required:** a guest checkout asks for no email, name or country (confirmed in the browser).
- **Order access:**
  - Each order is opened with a 32-byte random token, stored only as a hash, with an expiry and scoped to that order.
  - An unknown order and a wrong token give the same 404, so order numbers cannot be confirmed by probing.
  - The "find an order" form needs the full token and is rate-limited.
- **Referrer-Policy:** set to `strict-origin-when-cross-origin`, so the token in the URL never reaches other sites.
- **Search engines:** order, checkout and account pages are `noindex`, and robots.txt blocks `/orders`, `/checkout`, `/portal`, `/admin`, `/cart`, `/login` and `/api`.
- **Internal events:** admin notes and alerts are hidden from customers on the order page.
- **Fixed in this branch:** the contact form's anti-spam field was visible to people. It is now hidden.

## 5. Resend email delivery readiness — ⚠️ production not configured
- **Locally:** the key authenticates with Resend (a read-only domain check), and **esimprove.com is verified**.
  - The sender is `ESIMPROVE Support <support@esimprove.com>`.
- **Email never blocks delivery:** the QR code appears on the order page either way.
- **Production:** `EMAIL_LIVE_ENABLED` is **false**, and `RESEND_API_KEY`, `EMAIL_FROM` and `EMAIL_PROVIDER` are **missing**.
  - Today production sends no emails. That is safe; customers still get their eSIM on the website.

## 6. Database migrations and backup/rollback — ⚠️ run before deploy
- **Pending on production:** `0016_user_identities.sql` (a new table) and `0017_email_provider_ids.sql` (two nullable columns).
  - Both are additive and safe for the code currently live.
- **Order matters:** run them **before** deploying, because the new code writes to these columns.
- **How migrations run:** with `npm run db:migrate`, in one transaction, holding an advisory lock so two runs can't collide.
- **Backup first:** create a Neon branch `pre-0017-YYYYMMDD` (Neon console → Branches).
  - Restore steps are in `docs/BACKUP-AND-RESTORE.md` (point-in-time restore, branch or `pg_dump`).
- **Rolling back the code:** use Netlify → Deploys → the previous deploy → **Publish deploy**. The schema can stay as it is, because the old code ignores the new table and columns.
- **Rolling back the schema:** only if truly needed:
  ```sql
  DROP TABLE IF EXISTS user_identities;
  ALTER TABLE email_events DROP COLUMN IF EXISTS provider_message_id, DROP COLUMN IF EXISTS provider_response;
  DELETE FROM schema_migrations WHERE id IN ('0016_user_identities', '0017_email_provider_ids');
  ```
- **Not re-verified today:** the earlier read-only check showed 15 of 17 migrations applied. The local credentials file used for that check no longer exists.

## 7. Environment variables and Netlify — ⚠️
- **Present:** all 45 production variables needed by the configuration checks, including the Whop live key, product ID, webhook secret, database (TLS required), encryption keys and the USDT wallet and contract.
- **Safe values confirmed:** `WHOP_SANDBOX=false`, demo mode off, admin two-factor required.
- **Build checks:** the Netlify build runs the preflight first, so invalid values fail the build before release.
- **Missing:**
  - `APPLE_PAY_DOMAIN_ASSOCIATION`: Apple Pay won't verify the domain without it.
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: the Google button stays hidden. That is fine.
  - The 4 email variables above.
- **Stale comment:** `netlify.toml` still says "No Netlify site… exists yet". This is cosmetic; update it on the next commit.
- **Deploys:** a push or merge to `main` deploys automatically.

## 8. Sitemap, robots, canonicals and structured data — ✅
- **Live robots.txt:** correct disallow rules, plus `Sitemap: https://esimprove.com/sitemap.xml`.
- **Live sitemap:** 3,589 URLs, all on `https://esimprove.com`, with 17,885 hreflang alternates (EN, FR, ES, AR and x-default).
- **Live spot check of 38 sitemap URLs:** every one returns 200, has a self-referencing canonical, no `noindex`, valid JSON-LD, and hreflang links on the page.
- **Redesign regression:** zero changes across 1,465 URLs (`.audit/redesign/SEO-REGRESSION.md`).
- **Local sitemap and robots:** they are intentionally empty locally and on previews (no-index safety rail).

## 9. Purchase-to-eSIM-delivery flow — ✅
- **In the browser (local):** plan → **Buy plan** → "Continue as guest" → payment choice.
  - Checkout correctly **refused to take payment**, because local supplier ordering is off.
  - This is the safety gate in section 3, and it worked as designed.
- **Real Whop sandbox payment (earlier):** order `ES-261127-E21106`, paid with a 3-D Secure test card in the embedded checkout, verified by webhook and marked **delivered**.
- **Automated end-to-end tests (passed):**
  - a tampered cart price is rejected;
  - a verified payment produces **one** supplier order;
  - the QR code is shown **only after** a verified payment;
  - refund flagging, 3-D Secure and pending states, and cancelled payments are handled.
- **Not done, by design:** a live supplier order (it would buy a real eSIM) and a live card payment.

---

## Before you deploy (in order)
1. **Neon:** create the branch `pre-0017-<date>` as a backup.
2. **Migrations:** run `npm run db:migrate` against production with the production `DATABASE_URL`, then confirm 17 rows in `schema_migrations`.
3. **Whop webhook secret:** in Netlify → production, re-set `WHOP_WEBHOOK_SECRET` from `.env.local`. The Netlify copy may predate a later change. After deploying, use Whop → Webhooks → **Send test** and expect **200**.
4. **Legal date:** set `LEGAL_EFFECTIVE_DATE` in `lib/legal-profile.ts` to the deploy day. It is currently 2026-11-27.
5. **Apple Pay (optional):** add `APPLE_PAY_DOMAIN_ASSOCIATION` from the Whop/Apple dashboard.
6. **Email (optional):** add `RESEND_API_KEY`, `EMAIL_FROM=ESIMPROVE Support <support@esimprove.com>`, `EMAIL_PROVIDER=resend` and `EMAIL_LIVE_ENABLED=true`.
7. **Deploy:** merge the branch into `main`. Afterwards check `/api/health`, then a USDT and a card checkout page, stopping before paying.
