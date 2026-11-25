# ESIMPROVE — USDT (BEP-20) Checkout Preview

**Date:** 25 November 2026  
**Scope:** Local-only upgrade of the demo checkout (`/checkout?demo=1`) so USDT on BNB Smart Chain (BEP-20) is the first and default payment method, with Card retained as the second option.  
**Status:** Implementation and local verification complete. The development server remains available at `http://localhost:3000`.

> **Short result:** The demo checkout now opens with **Pay with USDT on BNB Smart Chain (BEP-20)** selected by default, showing the supplied receiving wallet, the public USDT BEP-20 token contract, copy buttons, a clearly non-scannable QR preview area, payment instructions, wallet guidance, and preview-only statuses. Card remains second with its existing Whop-oriented preview. **No order, payment, Whop API call, blockchain transaction, database write, deployment, or Git operation occurred.**

---

## 1. Payment UI Implementation

### Entry point and files

| Item | Detail |
| --- | --- |
| Route | `/checkout?demo=1` (localized: `/es/...`, `/ar/...`, `/fr/...`) |
| Page | `app/checkout/page.tsx` — demo branch evaluated before cart, database, and payment-provider code |
| Component | `components/checkout-payment-preview.tsx` |
| Central crypto config | `lib/crypto-payment.ts` |
| Method order/default | `lib/checkout-payment.ts` |
| Styling | `app/globals.css` — crypto panel, amount hero, value rows, QR placeholder, wallet guides, status list, mobile stacking, RTL handling |
| Tests | `tests/checkout-payment-preview.test.ts` |

### Layout

The previous two-step review flow was replaced with a single-page selector plus inline method details, which keeps the crypto instructions visible without an extra click:

1. **Payment method selector**
   - **Pay with Crypto** — first card, selected by default. Badge: `USDT · BEP-20`. Description: “Pay securely using your crypto wallet.” Supporting note states that blockchain verification is not connected.
   - **Credit / Debit Card** — second card. Visa and Mastercard badges. Existing card copy and disclosure retained.
2. **Inline payment details** — the panel for the selected method renders directly below the selector. Switching methods swaps the panel; the final action stays disabled.

### Crypto panel contents

- Heading: **Pay with USDT on BNB Smart Chain (BEP-20)**.
- Network badge: **BNB Smart Chain · BEP-20**.
- Amount hero with the exact USDT amount and the line “Pay *[amount]* USDT on BNB Smart Chain (BEP-20)”.
- Explicit conversion-basis note (see §3).
- Metadata list: cryptocurrency, network, network standard, demo order total.
- Receiving wallet with **Copy address** button and note that it is public receiving information.
- Token contract with **Copy contract** button and a note to confirm the official contract before sending.
- Clipboard status message (`aria-live="polite"`) reporting success or a manual-selection fallback.
- QR preview area labelled **QR code preview** and “Not scannable. A real QR code will be generated only from the verified receiving address.”
- Warning callout: address/network/contract not independently verified; wrong asset or network can cause permanent loss.
- Numbered payment instructions.
- Wallet guidance for MetaMask / Trust Wallet and Binance, with text labels only (no third-party assets copied).
- Status list: Awaiting payment (current), Payment verification pending, Payment confirmed (explicitly only after independent blockchain verification).
- Disabled final action: “Payment verification is not connected”.
- Preview-only note: no order is created, no blockchain transaction is verified, and no funds are accepted.

### Card panel

- Heading: card preview, with the Visa/Mastercard artwork placeholder.
- Required disclosure rendered exactly:

  > Preview only — payment processing is not connected.

- Disabled final action: “Payment unavailable in preview”.
- No card fields, CVV field, Whop call, or checkout session. The existing Whop adapter architecture is untouched.

### Scope isolation

The demo branch is reached before `onlineCheckoutAvailable()`, cart reads, order creation, and payment-provider selection. It uses static `demoPlan` data only. The preview component contains no form action, `fetch`, API route, order code, provider SDK, blockchain client, or QR generator. The normal checkout path and `CheckoutForm` are unchanged.

**Coupon field:** omitted because the codebase contains no coupon, promo, or discount functionality. Adding a non-functional Apply button would imply behavior that does not exist.

---

## 2. Receiving Address and Token Contract

Both values live in the central configuration `lib/crypto-payment.ts` and are referenced from there by the component; they are not duplicated in UI code.

| Field | Value |
| --- | --- |
| Asset | `USDT` |
| Network | `BNB Smart Chain` |
| Network standard | `BEP-20` |
| Receiving wallet | `0xBF93e7123FfEf0973d469F6Ce39D201dC2e5Aa5E` |
| Token contract | `0x55d398326f99059fF775485246999027B3197955` |
| Token decimals | `18` |

The receiving address is reproduced character-for-character from the supplied value and is asserted in tests and browser checks. The token contract is the public **Binance-Peg BSC-USD** contract on BNB Smart Chain, checked against public BscScan/search results only.

**Not independently verified in this task:** ownership/control of the receiving wallet, network compatibility of that wallet, and whether the contract above is the officially intended USDT contract for this business. These must be verified before accepting real customer funds.

The address is public receiving information, not a secret. No private key, seed phrase, recovery phrase, or wallet credential exists in the application, and no field asks for one.

---

## 3. Amount Calculation

The displayed crypto amount is derived from the authoritative demo order total, never hardcoded and never taken from browser input.

- Demo plan price: `demoPlan.priceMinor = 100`, currency `USD` → **1.00 USD**.
- `formatPreviewUsdtAmount()` in `lib/crypto-payment.ts` converts the server-supplied minor-unit total using a preview basis of `PREVIEW_USDT_PER_USD = 1`.
- The page passes two server-formatted strings to the component: `usdtAmount` (e.g. `1.00`) and `sourceAmount` (localized USD total, e.g. `$1.00`).
- Non-USD totals and negative/non-integer minor amounts throw, so misuse fails loudly rather than displaying a misleading amount.

**Conversion disclosure shown in the UI:** the demo order total is displayed 1:1 as USDT, and this is **not a live exchange rate** and must not be used to accept funds. No market rate, quote, oracle, or fiat conversion service is contacted.

For a future live flow, the amount must be computed and enforced server-side from the authoritative order record; a browser-supplied amount must never be trusted.

---

## 4. Wallet Instructions

Rendered as text chips plus two guidance blocks; no logos or assets are copied from other sites.

**MetaMask / Trust Wallet**

1. Select BNB Smart Chain.
2. Select USDT (BEP-20).
3. Send the exact displayed amount to the receiving address.
4. Keep some BNB separately for network fees.

**Binance**

1. Select USDT withdrawal.
2. Choose BNB Smart Chain (BEP-20).
3. Check the current withdrawal minimum and fees.
4. Confirm the recipient receives the exact required amount.

No minimum withdrawal amount or fee figure is invented or stated.

---

## 5. Payment Status Behavior

| Status | Behavior in preview |
| --- | --- |
| Awaiting payment | Shown as the current state, tagged **Preview only** |
| Payment verification pending | Listed but inactive |
| Payment confirmed | Listed but inactive, with “Only after independent blockchain verification” |

The status area explicitly states: “Preview statuses only. No payment has been detected, received, or verified.”

Clicking anything never marks an order paid. No transaction hash, block confirmation, or success message is generated. The final buttons are permanently disabled.

---

## 6. Security and Architecture Notes

- Receiving address and contract are centralized in `lib/crypto-payment.ts`.
- The component receives the amount from the server page; it does not compute pricing or read currency input.
- Order pricing remains server-authoritative in existing code paths; demo data is static and isolated from production records.
- Demo route is gated by `demoProductEnabled()` and never reads a cart or writes an order.
- No Whop API/session/credential call, no gateway activation, no live blockchain RPC, no wallet connection, no production DB write.
- No new secrets, environment variables, credentials, DNS, or hosting changes.
- Clipboard handling uses `navigator.clipboard.writeText` with a local `execCommand` fallback; failure is surfaced to the user.

---

## 7. Localization

All new strings were added to the four locale dictionaries and dictionary parity is maintained at **1,364 keys per locale** (`en`, `es`, `ar`, `fr`).

- English source: `lib/i18n/dictionaries/en.ts`.
- Spanish: `lib/i18n/dictionaries/es/account.ts` and `es/public.ts`.
- Arabic: `lib/i18n/dictionaries/ar/account.ts` and `ar/public.ts`.
- French: `lib/i18n/dictionaries/fr/account.ts` and `fr/public.ts`.
- Demo preview lead/banner/explanation text updated in all four locales to describe crypto-first selection and the absence of blockchain verification.

RTL/LTR handling:

- Arabic renders `<html lang="ar" dir="rtl">`.
- Wallet address, token contract, network badge, and amounts use `dir="ltr"` plus `unicode-bidi: isolate`, so they remain readable and correctly ordered in RTL layouts.
- Amount formatting uses Latin digits (`numberingSystem: "latn"`) and locale-appropriate decimal separators for USD display (`1,00` in es/fr, `1.00` in en/ar).

---

## 8. Tests and Verification

### Automated

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npx vitest run tests/checkout-payment-preview.test.ts` | 9 tests pass |
| `npm test` (full suite) | **67 files / 573 tests pass** |

The focused tests cover: crypto-first order and default, exact address and contract, dynamic amount derivation and invalid-input rejection, required disclosures, dictionary parity and translations, server-supplied amount wiring, and absence of network/provider/blockchain/QR code in the component.

### HTTP content checks

`200 OK` for `/checkout?demo=1`, `/es/checkout?demo=1`, `/ar/checkout?demo=1`, `/fr/checkout?demo=1`, with exact address, contract, localized headings, disclosures, and statuses present; no `whop.com` URL and no 32-byte hash in any page.

### Headless Edge checks (local CDP)

- Crypto card is first and selected by default; card second.
- Amount renders as `1.00 USDT` derived from the demo total.
- Exact receiving address and token contract appear.
- Both copy buttons copy the exact values to the clipboard.
- Switching to Card hides the crypto panel and shows the exact card disclosure; switching back preserves address/amount.
- Final actions disabled; no QR canvas/image; no password or key field; no fake success text; no transaction hash.
- Mobile (390 px): payment methods and wallet guides stack, no horizontal overflow.
- Arabic desktop/mobile: RTL layout, LTR addresses/contracts/amounts, no overflow.
- No external payment, blockchain, exchange, or provider request; no runtime errors.

Screenshots were captured for desktop crypto, desktop card, mobile crypto, and Arabic crypto in the local temp directory.

---

## 9. Required Before Live Blockchain Verification

The preview is not a payment system. A live implementation still requires, at minimum:

1. **Wallet ownership proof** — confirm control of `0xBF93e7123FfEf0973d469F6Ce39D201dC2e5Aa5E`.
2. **Network compatibility** — confirm the wallet can receive BEP-20 USDT on BNB Smart Chain.
3. **Official contract confirmation** — verify the intended USDT contract independently (the value used is the public Binance-Peg BSC-USD contract, not a business-confirmed choice).
4. **Server-side order and amount binding** — create the order server-side, persist the expected amount and currency, and derive any conversion from an authoritative source with an explicit rate and expiry.
5. **Independent chain monitoring** — watch the receiving address for the correct token contract, amount, and sufficient confirmations via a trusted RPC/indexer.
6. **Idempotent verification and replay protection** — deduplicate transactions, prevent duplicate order fulfillment, and handle underpayment/overpayment/late payment.
7. **Expiry and re-quote policy** — define how long a quoted USDT amount remains valid.
8. **Operational controls** — monitoring, alerts, reconciliation, refund policy, and support handling for wrong-network or wrong-token transfers.
9. **Real QR generation** — produce a QR only from the verified address and expected amount, using an audited library.
10. **Legal/compliance review** — confirm crypto payment, tax, and record-keeping obligations for the operating jurisdictions.

Until those exist, the UI must remain preview-only and the final action disabled.

---

## 10. No Real Transaction — Explicit Confirmation

- No real order was created.
- No Whop API, checkout session, credential test, or configuration change occurred.
- No cryptocurrency payment gateway was activated.
- No blockchain transaction was signed, submitted, or broadcast; no wallet was connected.
- No order or payment was marked paid or confirmed.
- No transaction hash or blockchain confirmation was fabricated.
- No production database read/write, migration, or seed occurred.
- No deployment, Git commit, Git push, DNS, hosting, or credential change occurred.

All work is local and uncommitted. The development server remains running at `http://localhost:3000`.
