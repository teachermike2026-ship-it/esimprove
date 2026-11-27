# Whop card checkout: sandbox build report

Date: 2026-11-26 · Scope: card checkout through Whop, sandbox only.

- **Not done:** nothing was deployed, committed or pushed. No live Whop key was used, and no real payment or supplier purchase was made.
- **Kept apart:** USDT payments remain a separate module, and nothing about crypto is sent to Whop.

## Status

| Item | Status |
|---|---|
| Code, embedded checkout, webhook handling, admin views | Built |
| Unit and integration tests | 14 new tests; full suite 468/468 passing |
| **Sandbox end-to-end run with Whop test cards and a tunnel** | **Not run yet.** It needs your Whop sandbox credentials (see "What I need from you") |

## Important finding: the Whop values in `.env.local` are live credentials

`.env.local` contains `WHOP_SANDBOX=false` together with a Whop key, a business ID, a product ID and a webhook secret. These are live credentials.

They're inactive today because `PAYMENT_PROVIDER` isn't set and `PAYMENTS_LIVE_ENABLED=false`. I didn't use them, and I added a guard so that a live Whop refund is also refused while `PAYMENTS_LIVE_ENABLED` isn't `true`.

For sandbox testing, replace them with sandbox values as described below.

## What was built

The existing Whop integration was extended rather than rebuilt. It already had:
- server-side pricing from the database;
- a supplier readiness check before an order is created;
- an inline one-time plan with metadata and an idempotency key;
- Standard Webhooks signature verification;
- deduplication on `webhook-id`;
- amount and currency checks;
- refund and dispute records;
- outbox-based fulfilment.

### Provider-agnostic payment module
- `lib/integrations/payments/types.ts` defines the `PaymentProvider` interface:
  - `createCheckout`, `verifyWebhook`, and the new `refundPayment`;
  - a new `payment.pending` event type.
- `lib/integrations/payments/whop.ts` is the Whop adapter; it now implements `refundPayment`.
- Checkout pages and order logic talk only to the interface (`getPaymentProvider()`). A new provider is a new adapter plus a config value.

### Checkout (steps 1–3)
- **Order creation.** `lib/checkout.ts` re-reads prices from the database and rejects a cart whose price changed. It refuses unpublished plans and plans the supplier can't fulfil, then creates a pending order and points card payments at our own payment page.
- **Whop checkout.** `lib/integrations/payment/whop.ts` creates the Whop checkout configuration through the official `@whop/sdk`:
  - an inline one-time plan priced at the server total, with currency and amount re-checked in the response;
  - metadata `{ orderId, planId }` plus the existing internal references;
  - the idempotency key `esimprove_checkout_<paymentId>`.
- **Env names.** It reads `WHOP_API_KEY` and `WHOP_COMPANY_ID`; the old names still work as fallbacks.
- **Embedded checkout.**
  - `components/whop-embedded-checkout.tsx` renders Whop Elements (`@whop/elements-react` and `@whop/elements` 1.10.0, MIT) with `checkoutConfiguration="ch_…"`, `environment="sandbox"` and a `returnUrl`.
  - If the Elements script can't load, Whop's hosted page for the same checkout is offered instead.
  - Shown on `app/checkout/pay/[paymentId]/page.tsx`.
- **Return page.** `app/checkout/success/page.tsx` shows only the status stored in our database. Whop's `?status=failed|canceled` adds a "payment not completed" notice. The return page never fulfils.
- **Security policy.** `lib/security-headers.ts` and `proxy.ts` allow Whop's frame, script and API origins only on `/checkout/pay/…`, and only for the environment `WHOP_SANDBOX` selects. In sandbox that means `cdn.whop.com` and `sandbox-api.whop.com`. A test keeps this list in sync with `contentSecurityPolicy()` from `@whop/elements`.

### Webhook fulfilment and edge cases (steps 4–6)
| Event or situation | Behaviour |
|---|---|
| Invalid signature, stale timestamp, malformed payload | 400, nothing stored, only the error class logged |
| Duplicate or retried delivery | Recognised by the signed `webhook-id`; never a second eSIM or email |
| `payment.succeeded` | Matched on `metadata.orderId`; amount and currency must equal the order. Marks the order paid and queues fulfilment once. The eSIM email (QR code and install steps) goes through the email transport, which only logs in local/sandbox |
| Amount or currency mismatch, wrong product, provider status not `paid` | Held for review, not paid, not fulfilled; **admin alert** |
| `payment.pending`, `payment.requires_action` | Logged on the timeline; status unchanged |
| `payment.failed`, `payment.canceled` | Pending order marked failed; an order already paid is never touched |
| Refund succeeded | Order refunded or partially refunded; **every eSIM flagged `refund_flagged`**; admin alert |
| Dispute | Payment and order marked disputed, fulfilment held; **admin alert** |
| Supplier fails after payment | Order goes to `manual_review` ("needs attention"); **admin alert**; job retry and **"Refund via Whop"** available in admin |

- **Code:**
  - `lib/integrations/payment/whop-webhook.ts`: parsing;
  - `lib/payments.ts`, `lib/payments/whop-webhooks.ts`: applying events;
  - `lib/fulfillment.ts`: supplier failure;
  - `lib/admin-alerts.ts` (new): alerts.
- **Admin alerts:** written to the order timeline and emailed to `ADMIN_ALERT_EMAIL` (falling back to `SUPPORT_EMAIL`). With the mock email transport they're only logged.
- **Refund path:**
  - `refundOrderViaProviderAction` in `app/admin/actions.ts` handles the button on the admin order page.
  - It requires the `refunds.write` permission and a confirmation tick, and sends a full refund with the idempotency key `esimprove_refund_<paymentId>`.
  - The order is marked refunded only when Whop's verified refund webhook arrives.
- **Admin visibility:**
  - `/admin/payments` now has a **webhook event log**: provider, event, delivery ID and time. Payloads, secrets and card data are never stored.
  - The payment status is shown per order.
  - Rejected requests appear only in the server log.

### Other files
- `.env.example`: new sandbox block.
- `docs/WHOP-WEBHOOKS.md`: event list.
- `scripts/whop-setup-webhook.ts`: `--url=` for a tunnel, and `--sandbox-only`.
- `lib/config.ts`: name aliases.
- `components/status-badge.tsx`: `refund_flagged` badge.
- i18n: four languages.
- `app/globals.css`.

Backups are in `.audit/backups/`.

## Test results

- **New tests, all passing:**
  - `tests/whop-sandbox-adapter.test.ts`: 6 tests, fake SDK. Covers env names, sandbox client, inline plan, metadata, idempotency key, no crypto or customer data sent to Whop, refund calls, live-refund guard, and the security-policy rules.
  - `tests/whop-sandbox-flow.test.ts`: 8 tests, synthetic signed webhooks. Covers price tampering, an unorderable plan, pending and 3-D Secure events plus their duplicates, cancellation, success with eSIM issued once then flagged on refund, dispute alert, amount mismatch held with an alert, and supplier failure leading to needs-attention with an alert.
- **Existing tests:** `tests/whop-webhook.test.ts` and `tests/whop-checkout.test.ts` already cover invalid signatures, duplicate and concurrent deliveries, amount and currency mismatches, success, failure, refunds and disputes.
- **Final verification:** `tsc` clean, ESLint clean, **468/468 tests in 47 files**, and `next build` succeeds. Logs are in `.audit/whop-*.log`.
  - Because the machine was at 100% CPU (other apps plus the dev server), the full run used longer database-setup timeouts (`--hookTimeout=300000`). No assertion was changed or skipped.

## What I need from you to run the sandbox end-to-end test

1. **Sandbox account.** Create one at https://sandbox.whop.com. In **Dashboard → Developer**, create an API key that can create checkout configurations, read products and plans, refund payments, and create webhooks.
2. **Sandbox product.** Create one, for example "ESIMPROVE eSIM data plan", without mentioning crypto, and copy its `prod_…` ID.
3. **Update `.env.local`.** Comment out the current live Whop lines and set:
   ```
   PAYMENT_PROVIDER=whop
   WHOP_SANDBOX=true
   WHOP_API_KEY=<sandbox API key>
   WHOP_COMPANY_ID=<sandbox biz_… ID>
   WHOP_PRODUCT_ID=<sandbox prod_… ID>
   WHOP_WEBHOOK_SECRET=<filled in after step 5>
   APP_URL=http://localhost:3000
   ```
   Keep `PAYMENTS_LIVE_ENABLED=false`.
4. **Approve a tunnel tool.** I need either Cloudflare's `cloudflared` (a quick tunnel needs no account) or `ngrok` (needs an account), to give the local webhook a public HTTPS URL.
5. **Approve the sandbox webhook.** Either let me create it with `npm run whop:webhook -- --url=https://<tunnel> --sandbox-only --create --confirm`, or create it yourself in the sandbox dashboard pointing at `https://<tunnel>/api/webhooks/whop` with the nine events listed below, then paste its `ws_…` secret into `WHOP_WEBHOOK_SECRET`.

Then I'll run:
- 4242 4242 4242 4242: success, eSIM issued once, email logged;
- 4000 0000 0000 0002: declined;
- 5385 3083 6013 5181: 3-D Secure, password `Checkout1!`;
- a sandbox refund from admin, and a resend of a webhook to confirm deduplication.

## Switching to live later

1. **In the live Whop dashboard (whop.com → Dashboard → Developer):** create a live API key with the same permissions, keep the business ID (`biz_…`), and create or choose the live product (`prod_…`).
2. **Register the webhook** at `https://esimprove.com/api/webhooks/whop`. Choose API version v1, pinned to `2026-11-23-3`, with these events:
   - `payment.succeeded`, `payment.failed`, `payment.pending`, `payment.requires_action`, `payment.canceled`;
   - `refund.created`, `refund.updated`;
   - `dispute.created`, `dispute.updated`.

   Copy its `ws_…` secret.
3. **Set the production environment** (your host, never the repo): `PAYMENT_PROVIDER=whop`, `WHOP_SANDBOX=false`, `WHOP_API_KEY`, `WHOP_COMPANY_ID`, `WHOP_PRODUCT_ID`, `WHOP_WEBHOOK_SECRET`, `APP_URL=https://esimprove.com`, `ADMIN_ALERT_EMAIL`, and `PAYMENTS_LIVE_ENABLED=true` (the explicit live gate).
4. **Supplier and email:** live eSIM issuing needs `SUPPLIER_LIVE_ENABLED=true` and a funded supplier balance, and a real email provider instead of the mock logger.
5. **Smoke test:** one small real purchase, then a refund from admin.

## Decisions for you

1. **eSIMs after a refund.** Refunded orders' eSIMs are flagged, but the QR code and activation details stay visible to the customer. Should they be hidden after a refund? That protects against using the line after a refund, but it's a policy choice.
2. **Sandbox embedded checkout may be unavailable.** Whop's docs say sandbox Elements are "not yet generally available". If the embed doesn't load in sandbox, the page falls back to Whop's hosted checkout automatically. Is that acceptable for go-live, or must the card form always be embedded?
3. **Admin alert email.** Which address should receive admin alerts (`ADMIN_ALERT_EMAIL`)?
4. **Refund scope.** Admin refunds are full refunds only. Do you also want partial refunds?
5. **The live credentials in `.env.local`.** Keep them there, or remove them from the local machine?

## Sandbox end-to-end: status on 2026-11-27

- **Done:**
  - Sandbox keys are in `.env.local` (`PAYMENT_PROVIDER=whop`, `WHOP_SANDBOX=true`, `WHOP_API_KEY`, `WHOP_COMPANY_ID`).
  - The key is accepted by `sandbox-api.whop.com`.
  - `cloudflared` was downloaded to `C:/Users/hp/tools/cloudflared/` (Cloudflare, Inc. code signature valid).
  - A tunnel was tested: the site loaded and the webhook rejected unsigned requests with 400. The tunnel has been stopped again.
- **Blocked:**
  - **Key permissions.** The sandbox API key lacks permissions. Creating the product failed with "not authorized for the access_pass:create scope". The key needs to create products, plans, checkout configurations and webhooks, and to read and refund payments.
  - **Product ID.** `WHOP_PRODUCT_ID` is still the **live** product (the sandbox returns 404). It will be replaced by the new sandbox product.
  - **Webhook secret.** `WHOP_WEBHOOK_SECRET` is still the **live** secret. It will be replaced by the sandbox webhook secret.
- **Local database incident:**
  - The local PGlite database was found damaged; it aborted on open, most likely after an unclean server stop.
  - With your approval it was restored from the 14:17 backup on 2026-11-26 (3,300 plans, 245 destinations, 7 orders, 2 users).
  - Only local analytics and page-view rows written after 14:17 were lost. Both damaged copies are kept in `.audit/backups/`.
- **To resume:** update the key's permissions, then:
  1. start a new tunnel (it gets a new URL);
  2. create the sandbox product;
  3. register the webhook with `--sandbox-only` and save its secret;
  4. run the cards 4242… (success), 4000…0002 (decline) and 5385… (3-D Secure), a refund and a duplicate delivery.
