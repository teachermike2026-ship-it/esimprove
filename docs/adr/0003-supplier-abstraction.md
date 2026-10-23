# ADR-0003: Provider-neutral supplier interface with disabled live adapter

- **Status:** Interface and mock implemented locally; live supplier disabled
- **Date:** 2026-10-23
- **Deciders:** Project owner (pending)
- **Related:** ADR-0006, ADR-0007, ADR-0010

## Context

The platform must resell eSIMs from a wholesale supplier. No supplier account, contract, credential, or commercial approval exists. eSIM Access is the leading candidate because its public documentation describes a reseller API without a published minimum top-up; eSIM Go is a fallback but documents a **$1,000** minimum top-up. Neither has been tested.

Supplier APIs differ in identifiers, price scales, status vocabularies, webhook security, and cancellation semantics. Embedding one supplier's payloads throughout the app would make replacement expensive and would blur the line between verified supplier data and our own claims.

## Decision

- Define a narrow `SupplierAdapter` interface in the supplier module.
- Normalise all supplier data into our domain types with Zod validation at the boundary.
- Store raw supplier payloads only in `supplier_products.raw_payload` / supplier transaction records for audit, never pass them directly to UI or domain logic.
- Preserve supplier price scale explicitly; never assume cents.
- Implement the eSIM Access adapter first, but ship it **disabled** behind `SUPPLIER_LIVE_ENABLED=false`.
- Allow only safe, read-only catalogue fixtures until credentials, written resale rights, and a funded test path exist.
- Use a supplier-specific idempotency key (`transactionId`) and store our own reference separately.
- Treat uncertain create-order outcomes as `under_investigation`; reconcile before any retry.
- Do not implement automatic multi-supplier routing in the MVP.

## Consequences

**Positive**

- Supplier replacement does not require rewriting checkout or order state machines.
- Price/scale and status translation are explicit and testable.
- Live ordering cannot be enabled accidentally.
- Raw evidence is retained for reconciliation.

**Negative / risks**

- The abstraction can leak if supplier capabilities differ sharply (e.g. top-up or cancellation support).
- A lowest-common-denominator interface may hide useful supplier features.
- Adapter contract tests require recorded fixtures until a real sandbox exists.
- eSIM Access webhooks are unsigned, so webhook data is untrusted input and must be reconciled.

**Neutral**

- Capability flags on the adapter advertise which optional operations are supported.
- Multi-supplier routing, failover, and price arbitrage are Version 2.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| Direct eSIM Access calls in checkout | Fast to write, but couples the domain to one supplier and bypasses reconciliation controls. |
| Build for multiple suppliers immediately | Premature; no measured need and much more testing surface. |
| Use an aggregator platform | Adds margin, dependency, and another approval layer; not evaluated. |
| No abstraction, swap later | Underestimates the cost of untangling supplier payloads from orders and money. |

## Verification

Before this ADR is accepted:

1. Adapter unit tests parse documented eSIM Access fixtures, including malformed and boundary cases.
2. Contract tests fail closed on unknown statuses, missing LPA/ICCID, and unexpected price scale.
3. Live ordering remains impossible with the flag off; a test asserts the guard.
4. A funded test order, status query, webhook dedupe, cancellation, and reconciliation are completed **only after owner authorisation**.

## Revisit triggers

- A supplier offers a genuinely free sandbox with signed webhooks.
- Contract terms require a different ordering or cancellation model.
- A second supplier becomes commercially necessary.
- eSIM Access changes price scale, auth, or webhook behaviour.
