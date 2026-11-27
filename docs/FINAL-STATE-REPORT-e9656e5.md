# ESIMPROVE — Final state report (payments, refunds, checkout entry)

**Branch:** `feat/nodereal-crypto-checkout`.
**Commits:**
- **Local:** `e9656e5` (this work), committed but **not pushed**.
- **GitHub:** the remote branch is at `6b435fc`, from the earlier "save" request.

`main` on both remotes is `d0feef5`.

**Production:** not deployed and not modified.
- **Netlify:** esimprove.com is published from `d0feef5` (08:07:50 UTC). No new deploys. The last change to any of the 41 Netlify variables was 07:47 UTC this morning.
- **Database:** read-only checks only. The production database still has 15 migrations.

No real payment, refund, eSIM purchase or email. No Whop setting changed.

## 1. Issues found and fixed

| # | Issue | Fix |
|---|---|---|
| 1 | The 2×-of-payment refund rule loosened manual review. It was also checked per refund, not cumulatively. | Replaced with **reconciliation against Whop's own payment record** (details in §5). No arbitrary threshold. |
| 2 | **Whop adds VAT on top of our price.** Proven in the sandbox: $4.28 order, $0.43 tax (`tax_behavior: exclusive`), $4.71 charged. The checkout said "No additional fees are added later". | Checkout and Terms wording now disclose that provider-added tax may apply to card, Apple Pay and Google Pay payments, and that USDT is charged exactly (4 languages). Choosing tax-inclusive pricing is a Whop dashboard decision for you (see §8). |
| 3 | The live-email check would have returned 503 for the whole site when switched on. | Replaced with a real Resend readiness check; a misconfiguration now fails the build preflight instead. |
| 4 | Legal texts changed while the document version stayed at 2.0. | `LEGAL_DOCUMENT_VERSION` is now **2.1**. Set the effective date to the deploy day before publishing. |
| 5 | Misleading health labels ("live-disabled" while live). | Accurate labels, plus a new `readiness` block (§6). |
| 6 | Registration always ended on the profile page, so a customer who signed up from checkout lost their place. | Register and sign-in now carry `next`, so customers return to checkout. |
| 7 | The live checkout still said "…in this **preview**". | Replaced with the payment-methods note (4 languages). |
| 8 | Registration page demo wording: "fictional email", "does not create a real customer record", "this build does not send verification email". | Rewritten for a live store (4 languages). |
| 9 | Duplicate "Already have an account? Sign in" on the register page. | Removed. |
| 10 | A lint error (`any`) in the new Whop lookup. | Typed. |
| 11 | A test-setup import broke the fake Whop SDK in 13 tests. | Replaced with an env switch (`WHOP_PAYMENT_LOOKUP=off` in tests only). |

## 2. Files changed in e9656e5
- **Refunds:** `lib/payments/refund-reconciliation.ts` (new), `lib/payments/whop-webhooks.ts`, `lib/integrations/payment/whop.ts` (read-only payment lookup and exact money conversion).
- **Readiness and health:** `lib/payment-readiness.ts` (new), `app/api/health/route.ts`.
- **Checkout entry and auth:** `components/checkout-entry.tsx`, `components/oauth-buttons.tsx` (Google only), `app/login/page.tsx`, `app/register/page.tsx`, `components/auth-forms.tsx`, `lib/auth/actions.ts`.
- **Legal and text:** `lib/legal-profile.ts` (2.1), `lib/legal-content/{en,es,fr,ar}.ts` (tax sentence), `lib/i18n/dictionaries/{en,ar/account,es/account,fr/account}.ts`.
- **Tests:** `tests/refund-reconciliation.test.ts` (new, 24 tests), `tests/whop-webhook.test.ts` (+8 lifecycle tests), `tests/live-email-and-applepay.test.ts`, `tests/setup.ts`.
- **Docs:** `docs/PRODUCTION-READINESS-AUDIT-6b435fc.md`, `docs/screenshots/*`, this report.

## 3. Whop configuration status
- **Webhook secret:**
  - Live mode reads `WHOP_WEBHOOK_SECRET` (the standard variable, never the sandbox one). The local value starts with `ws` and ends with `eeb01`, as you described.
  - A synthetic event signed with it **passes** the app's own Standard Webhooks verification. A tampered body, a wrong secret or a replayed timestamp is **rejected**.
  - **Open:** Netlify's copy was set at 07:47 UTC from `.env.local`, but `.env.local` was modified at **10:04 UTC**. If the secret changed then, Netlify still holds the old value. Netlify won't reveal stored secrets, so they can't be compared. **Action for you:** re-set `WHOP_WEBHOOK_SECRET` in Netlify production from `.env.local` (§8). I didn't change it.
- **Live key permissions:** checkout, plans, payments read and refund, and webhooks. It **lacks** `domain:read` and `company:manage_checkout`, so Apple Pay domain status can't be read through the API.
- **Product:** `prod_Fsw55cZw0Qn4w` is still visible (dashboard change needed).

## 4. Payment methods (app side)
| Method | App configuration | Verified | Remaining |
|---|---|---|---|
| **Card** | Requested from Whop. Embedded form on `/checkout/pay` only, no whop.com links. | Sandbox form renders inside esimprove.com (desktop and mobile). You confirmed Card is enabled in the Whop dashboard. | None on the app side. |
| **Google Pay** | Requested as `google_pay`. The security policy allows `pay.google.com`. Browser payments allowed for our page and `cdn.whop.com` on `/checkout/pay` only. | The Whop sandbox effectively enables it. You confirmed it's enabled in the dashboard. | No domain step. It appears only in supported browsers with a saved Google Pay card. Not yet seen live (production runs older code that requests card only). |
| **Apple Pay** | Requested as `apple_pay`. The security policy allows the Apple Pay script and fonts. The domain file is served at `/.well-known/apple-developer-merchantid-domain-association` (from `APPLE_PAY_DOMAIN_ASSOCIATION`, or a static file). | The Whop sandbox effectively enables it. Live esimprove.com returns 404 for the domain file, as expected because nothing is configured. | **Domain verification:** Whop must register esimprove.com with Apple, and the site must serve Apple's file (§8). It won't appear until then, and only in Safari on Apple devices. |

## 5. Refund workflow and test coverage
- **Execution:** refunds are executed only by an admin: the Whop dashboard, or the admin "Refund via Whop" button (full refund, one idempotency key per payment). **ESIMPROVE never refunds automatically.**
- **Each refund webhook:**
  1. The signature is verified, and each webhook ID is processed once.
  2. Each refund case is stored once and updated in place.
  3. For a succeeded refund, Whop's payment is read (read-only) and the app checks:
     - the payment metadata names this order;
     - the settlement currency and Whop's subtotal match the verified order;
     - **refunded versus charged in the buyer's currency** (no FX drift). Equal means full refund; less means partial; more means review.
  4. Settled USD refunds above the charge are accepted only when the buyer-currency amounts confirm them. Without buyer-currency amounts, settled amounts are compared directly, and anything above the charge goes to review.
- **When Whop can't be read:** only same-currency refunds whose **cumulative** total stays within the verified payment are applied. Anything more goes to review.
- **Always manual review, with an admin alert and an audit record:**
  - inexact or negative amounts;
  - currency mismatches;
  - wrong order;
  - over-refunds;
  - "succeeded" while Whop shows nothing refunded;
  - a previously succeeded refund later reported failed.
- **No change:** pending or failed refunds change nothing. Status never moves backwards automatically.
- **eSIMs:**
  - **Full refund:** all eSIMs flagged `refund_flagged`, and the alert says to cancel at eSIM Access by hand (a refund does **not** cancel the eSIM at the supplier).
  - **Partial refund:** eSIM status unchanged, and the admin decides.
- **Tests:** 24 rule tests (including the real sandbox case and exact money conversion) and 8 new webhook tests:
  - the same refund re-sent under a new webhook ID;
  - a cumulative over-refund;
  - a reversed refund;
  - a failed refund;
  - partial then full with Whop's record, with eSIM handling;
  - an order mismatch;
  - an above-price refund with and without Whop confirmation.

  Existing tests cover pending → partial → full, duplicate retries and disputes.

## 6. Resend email and health check
- **Email:**
  - Real email requires `EMAIL_LIVE_ENABLED=true`, `EMAIL_PROVIDER=resend`, a `re_` key in `RESEND_API_KEY`, and `EMAIL_FROM`. Missing settings are named in the configuration problems (names only).
  - The key stays server-side: none of 27 secret values appear in the browser bundle.
  - Email failures never block payment or fulfilment. Guest orders with no email skip all email.
  - Templates are unchanged. The esimprove.com domain is verified in Resend. **Production has none of the email settings yet.**
- **Health check:** `/api/health` (with the health token) now reports, by name and true/false only:
  - Whop mode, key, company and product;
  - webhook secret present;
  - card ready;
  - Apple Pay requested, plus "requires Whop domain verification";
  - Google Pay requested;
  - USDT;
  - supplier: live, unconfigured or off;
  - email: live, unconfigured (with missing names) or off;
  - migrations: applied and pending.

## 7. Verification
| Check | Result |
|---|---|
| TypeScript | **PASS** |
| ESLint (0 warnings allowed) | **PASS** |
| Automated tests | **PASS: 550/550 in 53 files** |
| Production build | **PASS** |
| Static secret scan (commit diff and built bundle) | **PASS** (0 hits) |

The full suite and build ran just before one final cosmetic change: removing the duplicate sign-in link. Types, lint and the related 33 tests were re-run after it and pass.

### Checkout entry (mobile)
- **Exactly two choices** (screenshots in `docs/screenshots/`):
  - **Create an ESIMPROVE account:** Continue with Google (appears automatically once Google credentials exist), **Sign up with email**, and **Sign in** for existing customers. All return to checkout.
  - **Continue as guest.**
- **Guest step:** only the payment method (card, Apple Pay and Google Pay inside card, or the separate USDT) and the two required legal boxes. No email, name, country or password.
- **Not offered:** Apple sign-in stays implemented on the server but isn't shown.
- **Google sign-in:** no credentials exist locally or on Netlify, so it isn't active. It isn't faked.

## 8. Remaining manual actions for you
1. **Webhook secret:** in Netlify, open production, then Environment variables. Set `WHOP_WEBHOOK_SECRET` to the value in `.env.local` (secret, production context).
2. **Whop tax:** decide whether VAT should stay on top of your prices (exclusive, now disclosed) or be included in them (tax-inclusive in Whop, which lowers your margin).
3. **Apple Pay:**
   - In Whop, add **esimprove.com** with Apple Pay enabled, or give the API key the `domain:read`/`domain` permissions.
   - Copy the domain-association file Whop provides into `public/.well-known/apple-developer-merchantid-domain-association`. Using `APPLE_PAY_DOMAIN_ASSOCIATION` instead risks Netlify's 4 KB limit on all environment variables combined.
   - Deploy, then run Whop's domain check until it shows **ready**.
4. **Google sign-in:**
   - In Google Cloud Console, open APIs & Services, then Credentials, and create an OAuth client ID of type Web application.
   - Authorised redirect URI: `https://esimprove.com/api/auth/oauth/google/callback`. For local testing, add `http://localhost:3000/api/auth/oauth/google/callback`.
   - On the OAuth consent screen, fill in the app name, support email, the esimprove.com domain, privacy and terms URLs, and the scopes `openid email profile`.
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on Netlify (secret). The button then appears automatically.
5. **Whop product:** set `prod_Fsw55cZw0Qn4w` to hidden.
6. **Email (optional):** on Netlify, set `RESEND_API_KEY` (secret), `EMAIL_FROM=ESIMPROVE Support <support@esimprove.com>`, `EMAIL_PROVIDER=resend` and `EMAIL_LIVE_ENABLED=true`.
7. **Deployment (needs your approval):**
   - Push the branch.
   - Take a Neon snapshot, then run migration `0016` (see `docs/PRODUCTION-READINESS-AUDIT-6b435fc.md`).
   - Set the legal effective date to deploy day.
   - Merge into `main`.
   - Smoke-test.
8. **Production order:** one unpaid live checkout, `ES-261127-E41648` ($3.76, 08:16 UTC). If it was your own test, it can stay. It expires harmlessly.
9. **eSIM Access:** after any full refund, cancel the eSIM at the supplier by hand.
