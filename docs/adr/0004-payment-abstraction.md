# ADR-0004: Provider-neutral payments; Stripe as first proposed adapter

- **Status:** Interface and signed mock implemented locally; live processor disabled
- **Date:** 2026-10-23
- **Deciders:** Project owner (pending); payment processor approval outstanding
- **Related:** ADR-0007, ADR-0010

## Context

The storefront needs card payments, refunds, disputes, and webhook-driven confirmation. No processor is selected and no merchant account exists. Stripe is the proposed first adapter because it documents hosted Checkout, signed webhooks, test mode, refunds, and fraud controls.

Stripe's public restricted-business page (last updated 2026-09-22) lists travel reservation services as a restricted category and says the list is not exhaustive. eSIM resale is not confirmed as approved. Taking live money before underwriting would risk account suspension and customer harm.

## Decision

- Define a `PaymentProvider` interface covering checkout creation, webhook verification, payment lookup, refunds, and optional disputes.
- Use hosted Checkout or tokenised components only; card data never touches our servers.
- Verify webhook signatures against the raw request body before any order mutation.
- Store provider event IDs uniquely for replay protection and keep payment state separate from fulfillment state.
- Use an idempotency key per payment attempt and per refund.
- Implement Stripe as the first adapter, **disabled** behind `PAYMENTS_LIVE_ENABLED=false`.
- Do not enable live payments until written processor approval, entity verification, statement descriptor, refund policy, and test-mode webhook/refund tests exist.
- Never infer payment success from a browser redirect.

## Consequences

**Positive**

- Processor replacement is feasible without rewriting orders.
- Hosted checkout reduces PCI scope.
- Signed webhooks and replay protection make payment confirmation auditable.
- Test mode allows a full checkout/refund exercise before live money.

**Negative / risks**

- Stripe may decline the business model; the adapter may never be usable.
- Hosted checkout limits control over the payment UI and some local payment methods.
- Provider fees, payout timing, currency conversion, and chargeback rules affect margins.
- Webhook endpoints are public attack surfaces; signature verification and rate limits are mandatory.
- Refund timing depends on the processor, not our UI.

**Neutral**

- No card numbers, CVVs, or raw payment credentials are stored or logged.
- Disputes are modelled separately from refunds.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| Stripe embedded Payment Element | More UI control but more integration and PCI surface; hosted Checkout is safer for MVP. |
| Paddle/Lemon Squeezy merchant of record | May simplify tax, but changes the business relationship and is not evaluated. |
| Adyen/Checkout.com | Likely better for scale, but onboarding and minimums are unknown and unnecessary pre-revenue. |
| PayPal only | Insufficient card coverage and different dispute behaviour. |
| Direct card acquiring | Far higher PCI/compliance burden. |

## Verification

1. Written processor approval for the legal entity and eSIM resale model.
2. Test-mode checkout creates exactly one payment for duplicate submissions.
3. Signed webhook accepted; invalid signature rejected without state change.
4. Duplicate and out-of-order events do not regress payment state.
5. Refund succeeds in test mode and is reflected only after provider confirmation.
6. Live mode remains blocked by flag and environment checks.

## Revisit triggers

- Processor declines or restricts the account.
- Chargeback rate or fees make the model unviable.
- The owner selects a merchant-of-record model.
- A new processor offers materially better approval, cost, or coverage.
