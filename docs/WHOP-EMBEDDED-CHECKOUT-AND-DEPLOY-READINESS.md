# ESIMPROVE — Embedded Whop checkout, email and secrets check, deployment readiness

**Date:** 2026-11-27 · **Status:** local only. Nothing committed, pushed or deployed. Production is unchanged: esimprove.com still serves `d0feef5`.
No real payment, no real eSIM, no email sent, no Whop dashboard change.

## 1. Card checkout stays on esimprove.com

### Before this change
- **Already right:** the card form was already embedded on our own page, `/checkout/pay/…`, not on whop.com.
- **What broke your rules:**
  - an "Open the secure Whop checkout page instead" link was always shown;
  - a button sent customers to whop.com whenever the form couldn't be embedded;
  - Apple Pay and Google Pay could not work: the site-wide `Permissions-Policy: payment=()` header switches off browser payments, and our security policy had Whop's wallet sources turned off.

### What changed
- **Links to whop.com removed:** the hosted-checkout link and button are gone, and so is their text in all four languages. If the form can't load, the customer sees "Try again" plus View order / Contact support, never a whop.com link.
- **Checkout step 2:** the payment page is now styled as the final checkout step:
  - **Main card:** "Checkout · Payment" header, a "Pay by card" card with a "Secure payment" badge, and Whop's form inside it.
  - **Sidebar:** the same order summary as the checkout page.
  - **Branding:** ESIMPROVE header, navigation and responsive layout around the form.
- **Form appearance:** Whop's form uses a light theme with a green accent, in the customer's language (English, Spanish or French; Arabic shows English, since Whop doesn't offer it).
- **No ad tracking:** Whop's advertising pixel is turned off with `skipPixel`. Card processing is unaffected.
- **Wallets:**
  - The checkout requests `card`, `apple_pay` and `google_pay`; Whop's own crypto stays disabled.
  - The security policy now matches Whop's published wallet-enabled list exactly (checked by a unit test), plus Apple Pay's font host.
  - Browser payments are allowed **only** on `/checkout/pay/*`, for our page and `cdn.whop.com`. Every other page keeps `payment=()`.
- **Unchanged:**
  - Payment is confirmed only by the signature-verified Whop webhook. Whop sends the customer back to our own `/checkout/success`, which only displays the status the webhook recorded. A browser "success" never triggers fulfilment.
  - The USDT checkout, the guest flow and the legal checkboxes are untouched.

### Customer journey (verified on a local production build with Whop sandbox)
| Step | URL in the browser | What the customer sees |
|---|---|---|
| 1 | `esimprove.com/checkout` | "How would you like to continue?" Account (Google / Apple / email) or **Continue as guest**. |
| 2 | `esimprove.com/checkout?as=guest` | Card or USDT, Terms box and immediate-supply box. Then **Buy now — pay by card**. |
| 3 | `esimprove.com/checkout/pay/pay_…?token=…` | The ESIMPROVE page with **Whop's payment form embedded** (frame from `cdn.whop.com`): email, card, billing details, and Apple Pay / Google Pay where supported. |
| 4 | `esimprove.com/checkout/success?order=…&token=…` | Order confirmation. The QR code appears once the verified webhook marks the order paid and the eSIM is delivered. Guests also get the "Keep access to your order" card. |

The browser URL never leaves esimprove.com. Measured on the payment page:
- the address bar stays on our host;
- 0 links to whop.com;
- Whop's form frame from `cdn.whop.com` renders inside our page (500×884 px on desktop, 309×987 px on a 375 px phone);
- the loading indicator clears when the form is ready;
- no horizontal overflow on mobile.

## 2. Resend email
| Check | Result |
|---|---|
| Code reads `RESEND_API_KEY` and `EMAIL_FROM` | **Yes** (`lib/integrations/email/resend.ts:40–41`). Optional: `EMAIL_REPLY_TO`, `EMAIL_TEST_RECIPIENT`. |
| Real email only with `EMAIL_LIVE_ENABLED=true` **and** `EMAIL_PROVIDER=resend` **and** a complete configuration | **Yes** (`lib/integrations/email/index.ts`). |
| Local `.env.local` | `RESEND_API_KEY` is set (format `re_…`). `EMAIL_FROM="ESIMPROVE Support <support@esimprove.com>"`, so the sender address is support@esimprove.com. |
| Resend domain | **esimprove.com is verified** in Resend (read-only check; nothing sent). |
| Netlify production | `RESEND_API_KEY`, `EMAIL_FROM` and `EMAIL_PROVIDER` are **not set**. Email stays off in production. |
| Key in logs or errors | The key is never logged; error messages are redacted (unit-tested). |

## 3. Secrets exposure
- **Browser code:** no browser component reads a server environment variable. The only public variables are `NEXT_PUBLIC_SITE_NAME` and `NEXT_PUBLIC_ANALYTICS_DISABLED`.
- **Built bundle scan:** 27 secret values from the local env files were searched for in the built browser files (41 files) and the server output (1,893 files). **No secret value was found.** The only match was `PAYMENT_TOKEN_CONTRACT`, which is the public USDT contract address and has to be visible.
- **Logs:**
  - The app never logs API keys, webhook secrets or activation codes. Email bodies are stored redacted.
  - Owner-run CLI scripts print only status messages, except `provision-owner.ts`, which deliberately shows a new owner's temporary password once in the owner's own terminal.
  - **Note:** order access tokens travel in the URL (`?token=`). They are not secrets in a log sense, but they grant access to one order. The local dev server's request log prints them, and hosting request logs may too. Low risk; a later improvement would be to move the token out of the query string.

## 4. Verification results
| Check | Result |
|---|---|
| TypeScript | **PASS** |
| ESLint (0 warnings allowed) | **PASS** |
| Automated tests | **PASS: 512/512 in 51 files** |
| Production build | **PASS** |
| Sandbox: guest card checkout up to the embedded Whop form (no payment) | **PASS** |
| No whop.com link or redirect (unit test and browser check) | **PASS** |
| Wallet permissions only on `/checkout/pay` (unit test of the real `next.config.ts` headers) | **PASS** |
| Mobile layout | **PASS**, after fixing a stretched sandbox badge |

Two existing tests were updated to the new requirement, and both still check exact values: the Whop payment-method list is now `card, apple_pay, google_pay`, and the security-policy comparison is now against Whop's wallet-enabled list. Five new tests are in `tests/whop-embedded-only.test.ts`.

## 5. Blockers and items to settle before deployment approval
1. **Database migration `0016_user_identities` must run on production before deploying.** It adds a new table only.
2. **Live email cannot be switched on yet.** `lib/config.ts:322` still reports "EMAIL_LIVE_ENABLED is not implemented in this build". Setting `EMAIL_LIVE_ENABLED=true` in production would fail the configuration check and **make the whole site return 503**. This needs a small code fix and updated tests first. With email left off, deployment is safe.
3. **Apple Pay on esimprove.com isn't enabled yet.** Whop needs the domain registered for Apple Pay (a live Whop account change), and the site must serve the Apple domain-association file Whop provides. Until then, card payments work and Apple Pay simply doesn't appear. **Google Pay** needs no domain registration but has not been verified live.
4. **Whop's form asks the payer for email and billing details** (name, country, address). ESIMPROVE still collects nothing, but card payers do give these details to Whop. Guest USDT payments need no personal details.
5. **The live Whop product `prod_Fsw55cZw0Qn4w` is still publicly visible.** Set it to hidden in the Whop dashboard.
6. **The live webhook secret is unverified.** Whop doesn't return it, so the first real payment confirms it.
7. **Refund-amount fix is still pending.** Live refunds stay on manual review, per the current policy.
8. **Legal pages:**
   - The Privacy Policy should mention Whop's billing-data collection and Google/Apple sign-in.
   - The Cookie Policy should list `esimprove_guest_orders` and `esimprove_oauth`.
9. **Google/Apple sign-in has no credentials yet.** The buttons show disabled with a note in production. Either add credentials, or hide the buttons until then.
10. **Deploying means committing and pushing to `main`.** Netlify builds are now active, so a push to `main` deploys automatically. 34 modified files and 15 new ones are uncommitted locally.
11. **Currency display:** Whop shows the price in the buyer's local currency (for example ₫ in the sandbox test), while the order is in USD. This is expected Whop behaviour and also caused the refund-amount mismatch.

## 6. Local test data left behind
- **Local test order:** one pending order, `ES-261127-AC2DD9`, with a Whop **sandbox** checkout configuration. Never paid. It exists only in the local database.
- **Demo plan:** `japan-1000mb-7d` was made available for the test and has been archived again.
- **Launch configuration:** `.claude/launch.json` gained a local production-server entry, `esimprove-prod-local`. Not committed.
