# ADR-0010: No live money or provisioning until evidence and explicit sign-off

- **Status:** Proposed
- **Date:** 2026-10-23
- **Deciders:** Project owner (mandatory)
- **Related:** ADR-0003, ADR-0004, ADR-0009

## Context

The platform can take customer money and spend supplier balance to provision eSIMs. Failures are not abstract: a customer can be charged without receiving a working eSIM, or a supplier order can be duplicated. Payment acceptance and supplier resale rights are unverified. Legal/tax review is absent. No code, test, or deployment exists.

The safest default is to build and test the entire flow with live integrations disabled, then enable them only after evidence.

## Decision

- Ship with independent server-side kill switches, default **off**:
  - `PAYMENTS_LIVE_ENABLED=false`
  - `SUPPLIER_LIVE_ENABLED=false`
  - `EMAIL_LIVE_ENABLED=false`
  - `CATALOGUE_SYNC_ENABLED=false`
- A disabled integration must be visibly disabled in admin and must never render a purchase button that cannot complete.
- Live payments require: approved processor/entity, written business-model approval, test-mode checkout/refund/webhook evidence, published draft policies reviewed by counsel, tax handling, and a support path.
- Live provisioning requires: approved supplier account, written resale/white-label rights, funded balance within an approved cap, successful test order/cancellation/reconciliation, webhook dedupe evidence, and activation encryption tests.
- Both require every P0 gate in `docs/LAUNCH-GATES.md` to be met, a rollback/disable drill, and explicit written owner authorisation recorded with a date and commit/deploy reference.
- Production boot checks must fail closed if a live flag is on while required secrets, legal configuration, or gate evidence are missing.
- Enabling a flag is a reviewed change, not an environment tweak in the Netlify UI without a record.

## Consequences

**Positive**

- No customer money or supplier balance is at risk during development.
- Demo/test behaviour cannot silently become production behaviour.
- The owner makes an explicit, informed go-live decision.
- Incidents can be contained by disabling one integration.

**Negative / risks**

- End-to-end testing is less realistic until approvals exist.
- Flags add configuration complexity and can drift between environments.
- A mistaken flag/secret combination could still enable a live path if boot checks are incomplete.
- Delaying live tests may reveal integration problems late.

**Neutral**

- Test-mode payment and supplier fixtures are allowed when clearly labelled and environment-separated.
- A “live” flag does not bypass legal or supplier approval.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| Enable live payments early to “test with real cards” | Unlawful/unapproved money handling and refund risk. |
| Enable supplier ordering with a small deposit before legal review | Spends money and may violate resale terms; still no customer launch. |
| Rely on a single `NODE_ENV=production` check | Too coarse; staging and production both run production builds. |
| Manual process only, no flags | Human error is likely; flags plus boot checks are testable. |

## Verification

1. With flags off, checkout cannot create a live payment and provisioning cannot call a live supplier; tests assert both.
2. Admin shows the disabled state and explains why.
3. Boot fails if a live flag is on without its required secrets/config.
4. A staging drill disables payments and supplier mid-flow without corrupting in-flight orders.
5. The signed launch checklist references the exact deploy and evidence.
6. Rollback restores the previous deploy and flags.

## Revisit triggers

- Processor/supplier approvals are granted or revoked.
- A legal review changes what may be sold or how.
- An incident requires emergency disablement.
- The owner explicitly authorises a gated live pilot.
