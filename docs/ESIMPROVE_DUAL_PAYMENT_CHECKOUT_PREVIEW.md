# ESIMPROVE — Dual Payment Checkout Preview

**Date:** 25 November 2026  
**Scope:** Local-only redesign of the demo checkout (`/checkout?demo=1`) with Card and Cryptocurrency payment methods.  
**Status:** Implementation and local verification complete. The development server remains available at `http://localhost:3000`.

> **Short result:** The demo checkout now presents Card and Cryptocurrency as two clearly separated, switchable payment methods before any order can be submitted. Card is shown as the intended Whop method and Cryptocurrency as awaiting a provider. **No Whop API call, checkout session, external payment request, real order, or card/crypto payment occurred.**

---

## 1. Screens and Components Implemented

### Entry point

| Item | Detail |
| --- | --- |
| Route | `/checkout?demo=1` (localized equivalents: `/es/...`, `/ar/...`, `/fr/...`) |
| Page | `app/checkout/page.tsx` — demo branch evaluated before cart, database, and payment-provider code |
| Component | `components/checkout-payment-preview.tsx` |
| Method definitions | `lib/checkout-payment.ts` |
| Icon | `CryptoIcon` added to `components/icons.tsx` |
| Styling | `app/globals.css` — selection cards, step indicator, review panels, card art, crypto placeholders, contact grid, mobile stacking, RTL |
| Tests | `tests/checkout-payment-preview.test.ts` |

### Two-step flow

1. **Choose payment method**
   - Card and Cryptocurrency radio cards, each with icon, title, description, and a visible selected state.
   - Continue is disabled until a method is selected and changes label for the selected method.
   - A status line confirms the selected method.
2. **Review**
   - Step indicator moves to “Review”.
   - Order contact section with customer email and country of residence.
   - Selected method summary with **Change**.
   - Method-specific preview panel.
   - **Back to payment methods** navigation.
   - Final payment button is permanently disabled in the preview.

Methods remain switchable before proceeding: the customer can change method from the review step or go back and select the other option.

### Order summary

The demo sidebar shows:

- Selected product: **Demo eSIM — Europe**
- Region: Europe
- Data allowance: 1 GB
- Validity: 7 days
- Subtotal
- Tax estimate (zero)
- Total due in USD
- Illustrative demo-price note
- Link back to the demo product page
- Demo / Whop preview notice

### Scope isolation

The preview branch is reached before `onlineCheckoutAvailable()`, cart reads, order creation, and payment-provider selection. It uses static `demoPlan` data only. The normal checkout path and `CheckoutForm` are unchanged and still use the existing Whop/mock architecture. The preview component contains no form action, `fetch`, API route call, order code, or provider client.

---

## 2. Card Checkout — Preview Status

| Aspect | Status |
| --- | --- |
| Displayed method | **Credit / Debit Card** |
| Networks shown | **Visa**, **Mastercard** only |
| Description | “Secure card payment.” |
| Selection state | Border, background, check indicator, and status text |
| Continue | “Continue with card” |
| Intended provider | Existing Whop adapter |
| Processing | **Not connected** |
| Final action | Disabled button: “Payment unavailable in preview” |

The review panel includes a non-interactive card artwork, confirms that card details would be entered on the provider’s secure hosted checkout, and states that card number, expiry, and security-code fields are not collected in the preview.

**Required disclosure, rendered exactly:**

> Preview only — payment processing is not connected.

The panel also states that Whop is the intended provider and that no Whop API call, checkout session, or card charge is made. No card data is collected, no CVV field exists, and no successful payment is implied.

---

## 3. Cryptocurrency Checkout — Preview Status

| Aspect | Status |
| --- | --- |
| Displayed method | **Cryptocurrency** |
| Icon | Generic professional crypto mark (`CryptoIcon`) |
| Description | “Pay using supported cryptocurrencies.” |
| Selection state | Border, background, check indicator, and status text |
| Continue | “Continue with cryptocurrency” |
| Provider | **None integrated** |
| Final action | Disabled button: “Payment unavailable in preview” |

The review panel shows placeholders for:

- Supported cryptocurrencies — “To be confirmed when a provider is connected”
- Payment instructions — “Will appear here after provider integration”
- Payment status — “Awaiting provider integration”

**Required disclosure, rendered exactly:**

> Cryptocurrency payments are not yet connected.

No cryptocurrency names or tickers, blockchain networks, exchange rates, wallet addresses, QR codes, exchanges, gateways, or simulated transactions are generated. The panel explicitly states that no wallet address, QR code, or blockchain transaction is created.

---

## 4. Existing Whop Adapter Findings

Inspected: `lib/integrations/payment/whop.ts`, `lib/integrations/payments/whop.ts`, `lib/integrations/payments/index.ts`, `lib/checkout.ts`, and `app/api/webhooks/whop/route.ts`.

### Already implemented

- Official `@whop/sdk` client, server-only API key usage, sandbox/live environment selection.
- Runtime configuration for API key, webhook secret, account ID, sandbox flag, app URL, and plan-variant map.
- Plan variant resolution by ESIMPROVE plan slug or ID.
- Hosted checkout creation through `checkoutConfigurations.create` with:
  - variant ID
  - redirect URL
  - ESIMPROVE order, payment, and plan metadata
  - idempotency key derived from the payment reference
- Server-side validation that the returned variant matches the expected price, currency, variant ID, and one-time billing type.
- Redirect safety: only `https://whop.com` or `https://*.whop.com` purchase URLs are accepted.
- Webhook verification with the Standard Webhooks helper using the exact raw body and full header set.
- Webhook payload validation for `payment.succeeded` and `payment.failed`, including ESIMPROVE order/payment references, amount, and currency.
- Existing order/payment tables and webhook route wiring for paid-status updates and fulfillment.

### Expected future card flow

1. Customer submits a real order from the normal checkout.
2. ESIMPROVE creates its own order and payment records server-side.
3. The server calls the Whop adapter to create a checkout configuration for the mapped plan variant.
4. The customer is redirected to Whop’s hosted `purchase_url`.
5. A verified Whop webhook updates the payment/order status.
6. Fulfillment proceeds only for a verified paid order.

This flow was **not executed**. The preview stops before order creation and never reaches the adapter.

### Adapter constraints relevant to enabling checkout

- One eSIM plan per Whop order.
- Quantity must be one.
- Tax must be zero for the Whop path.
- Total must equal the selected plan price.
- A valid mapping is required for every offered plan.
- Checkout fails closed if the webhook secret, public HTTPS app URL, or plan mapping is missing.

---

## 5. Missing Configuration / Integration Requirements

### Card (Whop)

Local `.env.local` currently has `APP_ENV=local`, `DEMO_MODE=true`, `PAYMENTS_LIVE_ENABLED=false`, `WHOP_SANDBOX=false`, and values for `WHOP_COMPANY_API_KEY` and `WHOP_ACCOUNT_ID`. Those credential values were **not used, tested, or modified**.

Missing or blocking items:

| Requirement | Current state |
| --- | --- |
| `PAYMENT_PROVIDER=whop` | Absent; provider defaults to `mock` |
| `WHOP_WEBHOOK_SECRET` | Absent; webhook verification cannot run |
| `WHOP_PLAN_VARIANT_MAP` | Absent; no plan can resolve to a Whop variant |
| `APP_URL` | Absent; `SITE_URL` is `http://localhost:3000`, which is not a public HTTPS origin |
| Sandbox/live choice | `WHOP_SANDBOX=false` while `PAYMENTS_LIVE_ENABLED=false`; live checkout is gated |
| Public HTTPS origin + webhook route | Not available locally |
| Live-payment approval | `PAYMENTS_LIVE_ENABLED` is false and live payments are not implemented in this build |

Consequently, `onlineCheckoutAvailable()` fails closed for Whop, and no checkout session can be generated. Enabling card payments later requires a deliberate configuration and approval step, a public HTTPS deployment, a verified webhook secret, and a complete plan mapping. No such change was made.

### Cryptocurrency

No cryptocurrency payment provider is integrated or selected. Before this method can accept funds, the project needs:

- an approved provider and merchant account;
- server-side credentials and a documented API integration;
- a supported-asset/network list supplied by that provider;
- webhook or polling-based payment-status verification;
- settlement, compliance, refund, and reconciliation handling;
- localized payment instructions and status states.

None of these were invented or stubbed as if operational.

---

## 6. Translation Coverage

All new checkout labels and descriptions were added in English, Spanish, Arabic, and French.

| Metric | Value |
| --- | --- |
| Locales | `en`, `es`, `ar`, `fr` |
| New checkout keys per locale | 45 |
| Total keys per locale | 1,320 |
| Checkout keys per locale | 77 |
| Demo-preview keys per locale | 24 |
| Dictionary parity | Equal key counts across all four locales |

### Required disclosures by locale

| Locale | Card disclosure | Crypto disclosure |
| --- | --- | --- |
| English | Preview only — payment processing is not connected. | Cryptocurrency payments are not yet connected. |
| Spanish | Solo vista previa — el procesamiento de pagos no está conectado. | Los pagos con criptomonedas aún no están conectados. |
| Arabic | معاينة فقط — معالجة الدفع غير متصلة. | مدفوعات العملات الرقمية غير متصلة بعد. |
| French | Aperçu uniquement — le traitement des paiements n’est pas connecté. | Les paiements en cryptomonnaie ne sont pas encore connectés. |

### Localized method labels

| Locale | Card | Cryptocurrency | Card description | Crypto description |
| --- | --- | --- | --- | --- |
| English | Credit / Debit Card | Cryptocurrency | Secure card payment. | Pay using supported cryptocurrencies. |
| Spanish | Tarjeta de crédito / débito | Criptomoneda | Pago seguro con tarjeta. | Paga con criptomonedas admitidas. |
| Arabic | بطاقة ائتمان / خصم | العملات الرقمية | دفع آمن بالبطاقة. | ادفع باستخدام العملات الرقمية المدعومة. |
| French | Carte de crédit / débit | Cryptomonnaie | Paiement sécurisé par carte. | Payez avec les cryptomonnaies prises en charge. |

Arabic renders with `<html lang="ar" dir="rtl">`; the step navigation, method cards, review panel, card artwork, and Arabic text align correctly without horizontal overflow. Country names use `Intl.DisplayNames` for the active locale, and the card number placeholder is isolated as LTR.

---

## 7. Test Results

### Static checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| Targeted checkout tests | 2 files, 21 tests passed |
| Full suite (`npm test`) | **67 files, 570 tests passed** |

The new `tests/checkout-payment-preview.test.ts` verifies:

- Exactly the `card` and `crypto` methods are offered.
- Card networks are limited to Visa and Mastercard.
- Both required English disclosures match exactly.
- All four locales contain the new labels and disclosures.
- No cryptocurrency asset names, tickers, or wallet-address patterns appear in crypto copy.
- The preview component contains no `fetch`, API route, order creation, Whop checkout call, or QR code generation.

### Runtime checks

HTTP requests returned **200** for:

- `/checkout?demo=1`
- `/es/checkout?demo=1`
- `/ar/checkout?demo=1`
- `/fr/checkout?demo=1`
- `/plans/demo-esim-europe`
- `/`

Headless Microsoft Edge checks (desktop and mobile) confirmed:

- Both payment options appear, with no method selected initially.
- Continue is disabled until a selection is made.
- Card selection, Continue, card review, and Back/Change work.
- Crypto selection, Continue, crypto review, and switching back to card work.
- Only one method is selected at a time.
- Both exact disclosures render.
- Customer email and country fields are present in review.
- The final payment button is disabled for both methods.
- No QR canvas or QR image is generated.
- No wallet address or fake success message appears.
- Mobile layout stacks both methods in one column without horizontal overflow.
- Arabic desktop and mobile remain RTL without horizontal overflow.
- No request to Whop, a crypto provider, or any other external payment host was observed.
- No runtime errors occurred during the checks.

Visual screenshots for desktop card/crypto panels, Arabic selection, and mobile selection were reviewed; the layouts render as intended.

---

## 8. Safety Confirmations

- **No external payment request occurred.** No Whop API call, checkout session, credential test, crypto gateway call, exchange call, or other payment-provider request was made during implementation or verification.
- **No real order was created.** The demo branch uses static demo-plan data and does not read or write the cart, orders, payments, or any other database record.
- **No payment was marked paid or fulfilled.**
- **No card data, wallet address, QR code, or blockchain transaction was generated.**
- **No production database write, migration, or seed was run.**
- **No credential, 2FA setting, encryption key, secret, admin account, DNS, or hosting configuration was changed.**
- **No dependency was added.**
- **No production build, publish, Netlify deployment, Git commit, or push occurred.**
- The existing Whop adapter, normal checkout flow, catalogue records, and localization architecture were preserved.

The development server remains available at **`http://localhost:3000`**. Temporary headless browser processes used for verification are stopped; the Next.js server is left running.

---

## 9. Files Touched

**Created**

- `components/checkout-payment-preview.tsx`
- `lib/checkout-payment.ts`
- `tests/checkout-payment-preview.test.ts`
- `docs/ESIMPROVE_DUAL_PAYMENT_CHECKOUT_PREVIEW.md`

**Modified**

- `app/checkout/page.tsx` — demo branch uses the dual-payment preview and enhanced static order summary
- `app/globals.css` — responsive and RTL styles for the new checkout UI
- `components/icons.tsx` — generic `CryptoIcon`
- `lib/i18n/dictionaries/en.ts`
- `lib/i18n/dictionaries/es/account.ts`
- `lib/i18n/dictionaries/ar/account.ts`
- `lib/i18n/dictionaries/fr/account.ts`
- `lib/i18n/dictionaries/es/public.ts`
- `lib/i18n/dictionaries/ar/public.ts`
- `lib/i18n/dictionaries/fr/public.ts`

All changes remain uncommitted and local.
