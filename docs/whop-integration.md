# Whop Integration — Documentation and Blocker List

Status: BLOCKED (pending account eligibility, credentials, sandbox verification)

Reference sources checked:
- https://whop.com/blog/integrate-checkout-api/
- https://whop.com/blog/how-to-use-the-whop-api/
- https://whop.com/blog/add-checkout-to-nextjs-app/

This adapter uses the existing supplier/payment architecture pattern (MockSupplierAdapter, DisabledLiveSupplierAdapter, integrationModes, flags).

## Required environment variables

- `WHOP_COMPANY_API_KEY` — required; not configured.
- `WHOP_WEBHOOK_SECRET` — required for webhook verification; not configured.
- `WHOP_SANDBOX` — optional; defaults to true in development.
- `APP_URL` or `SITE_URL` — must match Whop webhook endpoint host.

## Adapter contract

- `lib/integrations/payment/whop.ts` defines the adapter interface and placeholder functions.
- `createWhopCheckout` requires a valid company API key.
- `verifyWhopPayment` requires a valid company API key.
- `validateWebhookSignature` requires a configured webhook secret.
- All production functions throw if credentials are missing; they never fabricate successful checkout or verification responses.

## Verification steps required before activation

1. Confirm Whop account eligibility for eSIM/reseller business model.
2. Obtain `WHOP_COMPANY_API_KEY` and `WHOP_WEBHOOK_SECRET` from official Whop developer settings.
3. Configure `WHOP_SANDBOX` and perform sandbox checkout creation.
4. Confirm checkout creation returns a valid URL and associates with `orderId`.
5. Perform sandbox payment.
6. Confirm webhook delivery and verify webhook payload structure.
7. Confirm server-side verification returns correct status.
8. Confirm duplicate webhook protection works.
9. Confirm order/purchase association is exact.
10. Confirm no live payment is triggered until all steps pass.

## Blockers

- No Whop company API key configured.
- No Whop webhook secret configured.
- No sandbox verification performed.
- No official confirmation that the business model is permitted by Whop.
- Integration disabled; adapter throws clearly with descriptive errors rather than pretending success.
