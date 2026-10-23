# Architecture decision records

This directory records significant decisions made during Phase 0 and the local implementation.
A decision becomes `Accepted` only when the owner approves it and, where relevant, staging
evidence exists. `Superseded` decisions remain for history.

The local demo implements parts of several proposals, but **none of the production launch gates
are met**. Status labels below distinguish "implemented locally" from "accepted for production".

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](0001-netlify-nextjs-modular-monolith.md) | Netlify + Next.js App Router modular monolith | Implemented locally; not deployed |
| [ADR-0002](0002-postgres-drizzle-pglite.md) | PostgreSQL + Drizzle; PGlite for local tests only | Implemented locally; managed Postgres pending |
| [ADR-0003](0003-supplier-abstraction.md) | Provider-neutral supplier interface with disabled live adapter | Interface + mock implemented; live disabled |
| [ADR-0004](0004-payment-abstraction.md) | Provider-neutral payments; Stripe as first proposed adapter | Interface + signed mock implemented; live disabled |
| [ADR-0005](0005-auth-better-auth-totp.md) | Better Auth, database sessions, mandatory admin TOTP | Superseded by ADR-0012 |
| [ADR-0006](0006-outbox-and-job-queue.md) | Transactional outbox + Postgres queue + Netlify functions | Implemented locally; Netlify functions not deployed |
| [ADR-0007](0007-money-and-snapshots.md) | Integer minor units and versioned price/cost/FX snapshots | Implemented locally; FX/tax production rules pending |
| [ADR-0008](0008-activation-encryption.md) | Envelope encryption for activation data | Implemented locally; key custody/rotation pending |
| [ADR-0009](0009-domain-brand-gate.md) | Domain and brand evidence gate before public identity | Open gate |
| [ADR-0010](0010-live-money-provisioning-gate.md) | No live money/provisioning until evidence and explicit sign-off | Open gate |
| [ADR-0011](0011-email-abstraction.md) | Provider-neutral transactional email, disabled by default | Interface + local logger implemented; live disabled |
| [ADR-0012](0012-custom-demo-auth.md) | Custom database sessions + scrypt + TOTP for the local demo | Accepted for local demo; production review pending |

## Conventions

- File name: `NNNN-short-title.md`.
- Required sections: Status, Date, Context, Decision, Consequences, Alternatives considered,
  Verification, Revisit triggers.
- Do not rewrite an accepted decision in place. Add a new ADR and mark the old one
  `Superseded by ADR-NNNN`.
- Link evidence, not assertions. "Tested on staging" is not evidence unless the test, result, and
  date are recorded.
