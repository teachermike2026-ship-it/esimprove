# Whop webhooks — ESIMPROVE integration

Endpoint: `POST https://<your-site>/api/webhooks/whop`
Code: `app/api/webhooks/whop/route.ts` → `lib/payments/whop-webhooks.ts`
Parser: `lib/integrations/payment/whop-webhook.ts`

Nothing in this document was tested against Whop. Schemas were checked against
the public OpenAPI document `https://api.whop.com/api/v1/openapi.json`
(`info.x-api-version-date` = `2026-11-23-3`) and the public guide
`https://docs.whop.com/developer/guides/webhooks`. All tests use synthetic,
locally signed payloads.

## 0. Checkout creation (one dynamic checkout per order)

`lib/integrations/payment/whop.ts` → `createWhopCheckout` calls
`POST /api/v1/checkout_configurations` once per order (idempotency key
`esimprove_checkout_<paymentId>`) with an inline variant:

- `product_id` = `WHOP_PRODUCT_ID` (one existing product for all eSIM plans),
- `billing_type: one_time`, `visibility: hidden`, `force_create_new_plan: false`
  (identical prices reuse the same variant),
- `initial_price` = the server-side order total, `currency` = order currency,
- `metadata` = ESIMPROVE order/payment references, `redirect_url` = success page.

Carts with several plans or quantity > 1 are priced as one dynamic checkout at
the exact order total (title "ESIMPROVE eSIM order"); a fixed per-plan variant
can only cover one plan at quantity 1. No static per-plan checkout link is needed. `WHOP_PLAN_VARIANT_MAP` is only a
fallback when no product is configured. The response is accepted only if it is
a `ch_…` configuration with an HTTPS whop.com `purchase_url` and a one-time
variant whose price and currency equal the order. The OpenAPI document does not
say what happens when `product_id` is omitted, so a product is required.

Tested only against a fake SDK (`tests/whop-checkout.test.ts`). The first real
checkout should be a single small live order once the Whop account is eligible.

## 0b. Card availability on the hosted checkout

Every checkout is created with
`payment_method_configuration: { enabled: ["card"], include_platform_defaults: true }`
(card explicitly requested; Whop's location-based defaults stay on). Whop returns
`effective_payment_method_configuration`, resolved through the checkout, variant
and account layers:

| Effective configuration | ESIMPROVE behaviour |
|---|---|
| `card` in `enabled` | Redirect to Whop (card confirmed by Whop's response) |
| `card` in `disabled`, or `include_platform_defaults: false` without `card` | No redirect; customer sees "Card payments are not available…" and can pay with crypto |
| `null` / defaults only | Redirect, logged as "card availability could not be confirmed" |

Whop's public docs do not list which methods are platform defaults, and do not
say whether identity/business verification is required before live card
acceptance. Card visibility on the real hosted page can therefore only be
confirmed by the account owner (dashboard) or by a real hosted checkout.

Owner checks in the Whop dashboard (not verifiable from code):
1. The product used as `WHOP_PRODUCT_ID` has **Credit/debit card** selected in
   its payment methods ("Choose payment methods" on the product).
2. The business account has completed any verification and payout setup Whop
   asks for, and is approved for live payments.
3. eSIM / mobile data sales are accepted for the account (some business
   categories need Whop's approval first).

## 1. API version strategy

| Setting | Value ESIMPROVE expects |
|---|---|
| Webhook API version (`api_version`) | `v1` (anything else is rejected with 400) |
| Payload pin (`api_version_date`) | **`2026-11-23-3`** (`WHOP_WEBHOOK_API_VERSION_DATE`) |

Why the pin matters: Whop serializes v1 webhook payloads at the dated version the
webhook endpoint is pinned to. Unpinned webhooks keep the payload shape they had
when they were created (the legacy shape is not described in the OpenAPI file).
The parser validates the 2026-11-23-3 shape strictly:

- `payment.*` → `Payment`: `id` (`pay_`), `status`, `currency`, `total`
  (`Money`: `amount` string, `currency`, `decimals`), `subtotal`, `tax_amount`,
  `tax_behavior`, `metadata`, `checkout_configuration_id`.
- `refund.*` → `RefundLegacy`: `id`, `amount` (number), `currency`, `status`,
  `payment.id`, `payment.metadata`.
- `dispute.*` → `Dispute`: `id` (`dspt_`), `amount` (number), `currency`,
  `status`, `reason`, `payment.id`.

A payload that does not match is rejected with HTTP 400 and logged
(`Whop webhook rejected: Invalid Whop … payload`). A payload that matches but
carries a different `api_version_date` is processed and a warning is logged so
the pin can be corrected.

Whop documents that the pin is set **when the webhook is created through the
API** (`api_version_date` on `POST /api/v1/webhooks`, changeable with
`PATCH /api/v1/webhooks/{id}`). The public guide does not describe a dashboard
field for the date. If the dashboard does not show one, create or update the
webhook with that API call yourself (it needs your account API key, so it was
not done here).

## 2. Events handled

| Event | Effect |
|---|---|
| `payment.succeeded` | Marks the payment and order paid and queues fulfillment **only if** all checks in §3 pass. |
| `payment.failed`, `payment.canceled` | Marks a pending payment/order failed. Never touches an order already paid by another method. |
| `payment.pending`, `payment.requires_action` | Logged on the order timeline (once per delivery) and in the admin webhook log. Never changes status. |
| `refund.created`, `refund.updated` | Stored in `payment_provider_cases`. When the refund status is `succeeded`, the payment/order become `partially_refunded` or `refunded`, every eSIM of the order is flagged `refund_flagged`, and an admin alert is recorded. |
| `dispute.created`, `dispute.updated` | Stored in `payment_provider_cases`. An open dispute moves a `paid` payment/order to `disputed` and alerts an admin. |
| Anything else | Acknowledged (200), recorded for deduplication, not processed. |
| Payments without ESIMPROVE metadata | Acknowledged and ignored (other sales on the same Whop account). |

Refund and dispute events never insert an outbox row, so they can never start
fulfillment. Fulfillment itself refuses any order whose payment status is not
exactly `paid`, so a refund or dispute also holds an eSIM that has not been
delivered yet. A won dispute is recorded but does not restore `paid`
automatically; review it manually.

## 3. When an order is marked paid

All of these must hold for `payment.succeeded`:

1. Standard Webhooks signature verified with `WHOP_WEBHOOK_SECRET` (the `ws_…`
   value, passed unchanged to the official SDK helper; 5-minute timestamp window).
2. `data.status` is exactly `paid`.
3. `metadata.esimprove_order_id` / `esimprove_payment_id` match a stored Whop
   payment for that order, `checkout_configuration_id` matches the stored
   `ch_…` checkout when both exist, and `product_id` equals `WHOP_PRODUCT_ID`
   when both are set.
4. Currency equals the order currency (Whop codes such as `usd`, `usdt`,
   `whop_usd` are accepted as values, but must still equal the order currency).
5. Amount: `total − tax_amount (when tax_behavior is "exclusive")` equals the
   order price exactly, and `subtotal` (when present) equals the order price.
   `total` already excludes buyer fees. A discount, partial payment, different
   price, or an amount that cannot be represented exactly is **held for manual
   review** (order event `payment.review_required`), never accepted.

A declined card followed by a successful retry in the same hosted checkout is
supported: `payment.failed` marks the attempt failed but keeps the `ch_…`
reference, and the later verified `payment.succeeded` pays the order.

A held event is acknowledged with 200 so Whop does not retry it for 3 days and
then disable the webhook; the order stays unpaid until staff review it.

## 4. Idempotency and concurrency

- Deduplication key: the signed **`webhook-id` header** (Whop: "Each retry of a
  delivery has the same `webhook-id`"). Stored in `webhook_events`
  (unique on provider + external event ID).
- The claim row is inserted inside the same transaction as the state change. A
  concurrent duplicate hits the unique index, rolls back, and returns
  `duplicate: true`.
- The paid transition is conditional (`status <> 'paid'`), so even two
  different events for the same payment queue fulfillment at most once.
- Refund/dispute cases are upserted on (provider, kind, provider case ID).
- Fulfillment jobs are unique per order item (`fulfillment:<itemId>`).
- The route answers Whop first and runs fulfillment afterwards with Next.js
  `after()` (Whop requires a 2xx within 5 seconds). If that run fails, the
  scheduled `/api/jobs/run` worker (Netlify scheduled function, every minute)
  retries it.

## 5. Responses

| Status | Meaning | Whop behaviour |
|---|---|---|
| 200 | Processed, duplicate, ignored, or held for review | Stops retrying |
| 400 | Bad signature or payload that does not match the expected schema | Retries (fix the pin/secret) |
| 500 | Temporary server error (database unavailable, unknown references) | Retries ~3 days |
| 503 | `WHOP_WEBHOOK_SECRET` not configured | Retries |

## 6. Manual configuration (Whop dashboard / account owner)

1. Create the webhook for `https://<your-site>/api/webhooks/whop` with API
   version **v1**.
2. Pin `api_version_date` to **`2026-11-23-3`** (API call; see §1). Steps 1–3
   can be done with `npm run whop:webhook` (dry run, no network) and then
   `npm run whop:webhook -- --create --confirm` (one authenticated call that
   creates the webhook; it writes the signing secret to the git-ignored
   `.env.whop-webhook.local` instead of printing it). Run it yourself only when
   you are ready to activate.
3. Subscribe to: `payment.succeeded`, `payment.failed`, `payment.pending`,
   `payment.requires_action`, `payment.canceled`, `refund.created`,
   `refund.updated`, `dispute.created`, `dispute.updated`.
4. Copy the signing secret (`ws_…`) into the server environment as
   `WHOP_WEBHOOK_SECRET` exactly as shown (do not strip the prefix).
5. Run `npm run db:migrate` on the production database (adds migration
   `0012_payment_provider_cases.sql`).
6. Do not enable "test" deliveries from the dashboard against production.
