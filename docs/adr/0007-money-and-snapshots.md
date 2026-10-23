# ADR-0007: Integer minor units and versioned price/cost/FX snapshots

- **Status:** Minor-unit money and order snapshots implemented locally; FX/tax production rules pending
- **Date:** 2026-10-23
- **Deciders:** Project owner (pending)
- **Related:** ADR-0002, ADR-0003, ADR-0004

## Context

The business sells prepaid eSIM plans at a markup over supplier cost. Supplier prices may be expressed at a non-standard scale (eSIM Access examples use 1/10,000 USD), currencies may differ, tax may apply, and prices change. Floating-point arithmetic, live lookups during checkout, or deriving historic totals from current settings would create charge errors and disputes.

## Decision

- Store money as `amount_minor BIGINT` plus ISO 4217 `currency` and explicit `currency_decimals`.
- Store supplier price scale explicitly; never assume the supplier uses cents.
- Store FX as an integer ratio (`rate_nano BIGINT` at 1e9) with base/quote, source, and timestamp.
- Apply one shared rounding function with a documented mode per currency/market; test it exhaustively.
- At checkout, the server recalculates the price from the plan, quantity, pricing rule, FX snapshot, and tax. The client sends plan ID and quantity only.
- Persist immutable snapshots on the order/item: supplier cost, sale price, currency, FX, tax, discount, fee, pricing-rule version, and terms version.
- If the price changed before payment, return a `price_changed` conflict and require explicit re-consent; never silently charge the new amount.
- Refunds use the original captured currency and amount; FX differences are handled by policy, not by recomputing history.
- Store all timestamps as `timestamptz` in UTC.

## Consequences

**Positive**

- No floating-point drift in charges, refunds, or reconciliation.
- Historic orders remain explainable even after prices, FX, or tax rules change.
- Supplier scale mistakes are caught at the adapter boundary.
- Finance can reconcile order revenue against supplier cost.

**Negative / risks**

- `BIGINT` handling in JavaScript requires discipline (native `bigint` or a decimal library); JSON serialisation needs explicit conversion.
- Multi-currency and tax add UI complexity.
- FX rates must be sourced and timestamped; stale rates need a policy.
- Rounding disputes are possible if the policy is not disclosed.

**Neutral**

- Display formatting is locale-aware but never used for arithmetic.
- Supplier cost and customer price are separate fields; margin is derived for reporting only.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| JavaScript `number` cents | Safe for small values but easy to misuse and insufficient for non-2-decimal currencies. |
| Floating-point dollars | Unacceptable for money. |
| Decimal strings in the database | Workable, but integer minor units plus explicit scale are simpler to constrain and index. |
| Recompute historic orders from current prices | Destroys auditability and can misstate refunds. |

## Verification

1. Unit/property tests cover rounding boundaries, zero-decimal currencies, three-decimal currencies, negative adjustments, and large values.
2. A supplier price at 1/10,000 USD converts correctly and rejects an unexpected scale.
3. A price change between cart and checkout forces re-consent in an integration test.
4. A refund after an FX change uses the original capture, with the policy applied explicitly.
5. Database checks reject negative totals and refunds exceeding captured amounts.

## Revisit triggers

- The business adds currencies with unusual exponents or crypto assets.
- Tax calculation requires a provider with different rounding rules.
- Supplier pricing moves to a different scale or includes tax.
- Finance reports a reconciliation discrepancy.
