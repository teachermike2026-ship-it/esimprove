# Whop Webhook Hardening — Test Plan & Status

Reference: current official Whop docs (checked: https://whop.com/blog/integrate-checkout-api/ , https://whop.com/blog/how-to-use-the-whop-api/ , https://whop.com/blog/add-checkout-to-nextjs-app/ )
Status: BLOCKED for live verification — no WHOP_WEBHOOK_SECRET configured; no sandbox checkout performed.

## Existing safeguards verified (local/mock)
- `lib/payments.ts`: `handlePaymentWebhook` uses `provider.verifyWebhook(rawBody, signature)` and stores `sha256Hex(rawBody)` in `webhookEvents` table.
- Duplicate detection via `webhookEvents` query (line 56+); replay protected by hash + event id comparison.
- `lib/integrations/payment/whop.ts`: `validateWebhookSignature` requires configured secret; throws / returns false if missing (no fabricated accept).
- Fulfillment only triggered after `canTransitionPayment` and verified event type; no fulfillment on unpaid/unverified.

## Safe tests implemented / planned (do not claim passed for live Whop)
- Mock webhook (`app/api/webhooks/payments/mock/route.ts`) verifies `handlePaymentWebhook` with mock signature; idempotency verified through `webhookEvents` table (existing tests in `tests/webhook.test.ts`).
- Signature checks covered conceptually: valid, missing, malformed, wrong secret — adapter throws/rejects, never accepts blindly.
- Replay / duplicate: existing `webhookEvents` hash comparison prevents duplicate fulfillment.
- Unknown order/payment id: `handlePaymentWebhook` returns `ok: false` when match missing.
- Incorrect amount/currency: requires real Whop checkout metadata comparison; blocked until sandbox.
- No fulfillment for failed/cancelled events: `lib/state.ts` transitions prevent fulfillment for non-paid states.

## Blocked verification steps (require credentials + sandbox)
1. Obtain `WHOP_COMPANY_API_KEY` and `WHOP_WEBHOOK_SECRET`; confirm account eligibility for eSIM/reseller model.
2. Configure `WHOP_SANDBOX=true`; create internal order.
3. Create Whop checkout; verify amount/currency/order metadata.
4. Complete sandbox payment; receive webhook payload; verify signature against secret (current official method — do NOT invent HMAC if Whop uses different scheme).
5. Confirm `handlePaymentWebhook` returns `duplicate=false`, `ok=true`, eventType correct.
6. Replay identical payload; confirm `duplicate=true`, fulfillment not repeated.
7. Send invalid/tampered signature; confirm rejection (400 / error), no fulfillment.
8. Send unknown checkout id; confirm `ok=false`.
9. Confirm fulfillment triggered exactly once; no duplicate supplier attempt.
10. Confirm error logging excludes secret values / payment-sensitive data.

Never fabricate a signature algorithm. If current Whop documentation specifies a verification method different from the placeholder `validateWebhookSignature`, replace the placeholder with the documented method when credentials are available.
