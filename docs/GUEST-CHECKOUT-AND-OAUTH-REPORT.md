# ESIMPROVE — Checkout entry redesign, guest checkout and Google/Apple sign-in

**Date:** 2026-11-27 · **Status:** implemented locally, **not committed, not pushed, not deployed.**
No real payment, no real eSIM, no live switch changed, no Whop dashboard change, production database untouched.

## 1. What changed

### Checkout entry screen (new first step)
Visitors who are not signed in now see **"How would you like to continue?"** with two cards:

- **Continue with an account:** "Continue with Google", "Continue with Apple", and a link to sign in with email and password.
- **Continue as guest:** one button. No registration, email, name, country or password.

Signed-in customers skip this screen and see "Signed in as …". Guests see "Checking out as a guest — no personal details needed", with a link to change.

### Pre-payment form
- **Removed:** Email for the order, Name on the order, and Country of residence.
- **Server-side too:** the fields were removed from the server-side schema (`checkoutSchema`) and from the server action. They were not just hidden in the form.
- **What remains:**
  - payment method: Whop card or the separate USDT BEP-20 checkout;
  - the Terms / Privacy acceptance;
  - the immediate-supply / withdrawal acknowledgement;
  - links to the eSIM Service, Payment and Refund policies.

### Backend
- **Optional customer details:**
  - `createCheckout` treats email, name and country as optional and stores `""` for guests.
  - Signed-in orders take email and name from the account, never from the form.
  - No database migration was needed for this.
- **Email handling:**
  - Guest orders without an email skip every email step, including eSIM delivery, refund notices and admin emails. Website delivery is unaffected.
  - The webhook's email comparison is skipped when the order has no email.
- **Admin and order pages:** they show "Guest checkout (no email)" instead of blank fields.

### Guest order access (secure, no account)
- **Access token:** every order gets a cryptographically random 32-byte access token (256-bit). Only its SHA-256 hash is stored. Guest tokens now last **365 days**; account orders keep 30.
- **What opens an order:** the token, the order owner's session, or an admin. The order number alone never does: a wrong token, another order's token or a different signed-in user gets a 404.
- **Saving access:** the confirmation and order pages show a **"Keep access to your order"** card for guests, with:
  - **Copy private order link.**
  - **Remember on this device:** stores the order in an HTTP-only, SameSite=Lax cookie that page scripts can't read. Each entry is re-verified against the database.
  - A note on how to recover access.
- **`/orders` (My orders):**
  - lists this device's guest orders;
  - has a **Find an order** form that accepts the private link, or the order number plus access code;
  - gives the same answer for "no such order" and "wrong code", and is rate-limited to 10 tries per 15 minutes per IP.
- **QR codes:** still released only after a verified payment and a confirmed fulfilment job (existing `isOrderItemDelivered` gate). Nothing is invented.

### Google and Apple sign-in
- **Flow:** OpenID Connect authorization-code flow (`lib/auth/oauth.ts`, `/api/auth/oauth/[provider]/start` and `/callback`).
- **Request protection:** state (CSRF protection), nonce (replay protection) and PKCE for Google, kept in a 10-minute HTTP-only cookie. Apple uses `form_post`, so that cookie is SameSite=None.
- **Token checks:** the ID-token RS256 signature is verified against Google's or Apple's published keys, along with issuer, audience, expiry and nonce. The Apple client secret is signed locally (ES256). No new npm packages.
- **No duplicate accounts:**
  - A sign-in is matched by the provider's stable `sub` first. A new table, `user_identities` (migration `0016`), has a unique index on (provider, subject).
  - If not found, it links to the existing account with the same **verified** email.
  - Only otherwise does it create one new customer account.
  - Unverified emails are refused.
- **Admin accounts are refused**, so they keep password plus TOTP.
- **New accounts:**
  - Email is verified and the account has no usable password. The customer can set one later with "forgot password".
  - Terms, privacy and age consents are recorded, marketing is off, and the sign-in is audit-logged.
- **When credentials are missing:** the buttons are shown disabled with a note, and the routes redirect safely to the login page.
- **Login page:** now also has the Google and Apple buttons, and clear error messages for cancelled, expired, unverified-email, admin and conflict cases.

## 2. Files changed

| Area | Files |
|---|---|
| **New** | `components/checkout-entry.tsx`, `components/oauth-buttons.tsx`, `components/guest-access-card.tsx`, `components/copy-link-button.tsx`, `lib/auth/oauth.ts`, `lib/guest-orders.ts`, `app/api/auth/oauth/[provider]/start/route.ts`, `app/api/auth/oauth/[provider]/callback/route.ts`, `app/orders/page.tsx`, `app/orders/actions.ts`, `db/migrations/0016_user_identities.sql`, `tests/guest-checkout.test.ts`, `tests/oauth-signin.test.ts` |
| **Checkout and orders** | `app/checkout/page.tsx`, `app/checkout/actions.ts`, `components/checkout-form.tsx`, `lib/checkout.ts`, `lib/validation.ts`, `app/checkout/success/page.tsx`, `app/orders/[orderNumber]/page.tsx`, `app/checkout/pay/[paymentId]/page.tsx`, `components/order-detail.tsx` |
| **Email and payments** | `lib/fulfillment.ts`, `lib/email-notices.ts`, `lib/payments.ts` |
| **Admin display** | `app/admin/orders/page.tsx`, `app/admin/orders/[orderNumber]/page.tsx`, `app/admin/refunds/page.tsx` |
| **Login and schema** | `app/login/page.tsx`, `lib/db/schema.ts` |
| **Text and styles** | `lib/i18n/dictionaries/en.ts`, `lib/i18n/dictionaries/{ar,es,fr}/account.ts` (58 new keys per language), `app/globals.css`, `.env.example` |
| **Existing test, extended** | `tests/migration-upgrade.test.ts`: lists the new migration `0016`, so its count goes 15 → 16, as with earlier migrations. No assertion was removed. |

Backups of every modified file are in `.audit/backups/guest-checkout-20261127/`.

## 3. Does guest checkout require zero personal information?
**Yes, on ESIMPROVE's side.** The guest path asks for no email, name, country, password or account. The server rejects nothing for their absence and stores none of them.

The guest still ticks the two legal boxes (see §4).

Two caveats:
- **USDT:** the payment itself needs nothing from the customer beyond the on-chain transfer.
- **Whop card form:** Whop's embedded form is Whop's own. Card schemes and Whop may ask the payer for card-holder details or an email inside that form, for fraud and receipt purposes. That data goes to Whop, not ESIMPROVE, and ESIMPROVE has no control over it.

## 4. Legal and payment-provider requirements that remain
- **Terms of Service and Privacy Policy acceptance:** still a required, unticked checkbox at checkout. For guests it is now recorded against the order ID instead of a hashed email.
- **Immediate-supply request and withdrawal acknowledgement** (EU Consumer Rights Directive art. 16(m), UK regulations 36–37): still a required, unticked checkbox. This express consent can't be removed without losing the right to refuse change-of-mind refunds after activation.
- **Google/Apple account creation:** consent is given by a notice next to the buttons ("by continuing… you accept the Terms… Privacy Policy… and confirm legal age"), and recorded. This is weaker evidence than the separate checkboxes on the email registration form. Have a lawyer confirm it is acceptable.
- **Legal pages to update before going live:** I did not edit the legal texts.
  - **Privacy Policy:** should mention Google/Apple sign-in data (provider ID, verified email, name).
  - **Cookie Policy:** should list two new strictly-necessary cookies, `esimprove_guest_orders` (365 days) and `esimprove_oauth` (10 minutes).
- **Manual-refund policy:** unchanged.

## 5. Test results
| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | **PASS** |
| ESLint (0 warnings allowed) | **PASS** |
| Automated tests | **PASS: 507/507 in 50 files** (was 480/48; +27 new tests) |
| Production build (`next build`) | **PASS** |
| Guest card checkout, no personal info (mock provider, no charge) | **PASS** |
| Guest USDT checkout, payment request created, no transfer | **PASS** |
| Secure guest access (own token only; number alone, wrong or other token, stranger refused) | **PASS** |
| QR delivery after simulated verified payment and mock fulfilment; no email attempted | **PASS** |
| Signed-in order uses account details and appears in order history | **PASS** |
| Google sign-in and registration (fake provider, real RS256 signature checks): new account, same identity again, linking, password still works | **PASS** |
| Apple sign-in (ES256 client secret verified, name field, linking to the same account) | **PASS** |
| Bad nonce, audience, issuer, expiry or signature; unverified email; admin account | **PASS (all refused)** |
| Existing payment, webhook, idempotency and fulfilment safeguards (existing suites) | **PASS** |
| Browser check (local dev, desktop and 375 px mobile): entry screen, guest step (only the payment choice and 2 legal boxes), `/orders`, wrong-link error, login error message, OAuth routes when unconfigured | **PASS, no console errors** |

## 6. Outstanding limitations
1. **Real Google/Apple sign-in is not tested end to end.** No Google or Apple credentials exist yet. To enable it:
   - **Google:** create an OAuth client in Google Cloud with redirect URI `https://esimprove.com/api/auth/oauth/google/callback`.
   - **Apple:** in Apple Developer, set up a Services ID, register the domain, and create a Sign in with Apple key. Return URL: `https://esimprove.com/api/auth/oauth/apple/callback`. Apple needs HTTPS, so it can only be tested on a deployed or tunnelled site.
   - **Then:** set the six variables listed in `.env.example`.
2. **Migration `0016` must be applied to the production database before deploying this code.** It adds a new table only.
3. **Guest recovery has one hard limit.** If a guest loses the link and clears cookies, we have no email to identify them. Support would need the order number plus payment proof (Whop receipt or transaction hash). This follows directly from collecting no personal data.
4. **Order emails can't reach guests.** Delivery, refund and support emails need an address, so guests rely on their order page. An optional "email me my link" could be added later, but was not, because the brief was to collect nothing.
5. **Builds are now active on Netlify.** Any push to `main` deploys automatically. Don't push this work until you approve a deploy.
