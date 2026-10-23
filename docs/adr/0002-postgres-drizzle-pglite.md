# ADR-0002: PostgreSQL + Drizzle; PGlite for local tests only

- **Status:** Implemented locally with PGlite; managed PostgreSQL and production acceptance pending
- **Date:** 2026-10-23
- **Deciders:** Project owner (pending), implementing engineer
- **Related:** ADR-0001, ADR-0006, ADR-0007

## Context

The platform needs durable, transactional state for orders, payments, refunds, supplier transactions, eSIM activation secrets, jobs, outbox events, audit logs, and admin approvals. Money correctness and idempotency depend on real database constraints and transactions.

The local environment has no Docker and no `psql`. Requiring a container would slow development and CI. A production-grade managed Postgres is not yet provisioned.

## Decision

- Use **PostgreSQL** as the only production database.
- Use **Drizzle ORM + drizzle-kit** for typed schema and versioned SQL migrations.
- Use **PGlite** for local development and fast integration tests only.
- Keep SQL portable and avoid provider-specific extensions unless an ADR justifies them.
- Run migrations as an explicit deployment step, not automatically on every request or cold start.
- Target a pooled connection string from a managed provider; Neon is recommended but not selected.

## Consequences

**Positive**

- Real relational constraints (unique keys, foreign keys, checks) enforce idempotency and financial invariants.
- `SELECT ... FOR UPDATE SKIP LOCKED` supports the job queue without Redis.
- Drizzle produces readable SQL migrations and typed queries.
- PGlite removes Docker from the inner loop.
- Provider-neutral SQL limits lock-in.

**Negative / risks**

- PGlite is not byte-identical to managed Postgres; extensions, concurrency, and planner behaviour can differ.
- Drizzle is less mature than some ORMs; complex queries may require hand-written SQL.
- Serverless functions need pooling; naive connections exhaust Postgres limits.
- Migrations require a controlled release process and rollback planning.
- Managed Postgres adds a monthly cost and a data-processing relationship.

**Neutral**

- No production data will be copied to staging without anonymisation.
- Backups, PITR, and restore drills are provider responsibilities plus our verification.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| SQLite/Turso | Weaker fit for concurrent financial transactions and row-level locking. |
| MySQL/MariaDB | Viable, but Postgres features (JSONB, constraints, `SKIP LOCKED`) are preferred. |
| Prisma | Good tooling, but heavier runtime and less direct SQL control; Drizzle fits the serverless/edge constraints better. |
| Hosted backend (Supabase client) | Convenient, but couples domain logic to a vendor SDK; direct Postgres keeps portability. |
| PGlite in production | Not acceptable for durability, concurrency, backups, or multi-instance access. |

## Verification

1. Schema and migrations apply cleanly to PGlite and to a real managed Postgres test branch.
2. Integration tests cover unique constraints, outbox atomicity, concurrent job claims, and rollback behaviour.
3. A connection-pooling test under concurrent serverless invocations shows no exhaustion.
4. A restore from backup is performed and timed before launch.

## Revisit triggers

- PGlite cannot support a required auth or SQL feature.
- The chosen provider's pooling or region makes latency unacceptable.
- Migration rollback fails in staging.
- A legal data-residency requirement changes the provider/region.
