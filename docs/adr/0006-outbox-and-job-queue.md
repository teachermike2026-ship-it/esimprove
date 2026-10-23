# ADR-0006: Transactional outbox, Postgres queue, Netlify functions

- **Status:** Outbox/jobs implemented locally; Netlify functions and production acceptance pending
- **Date:** 2026-10-23
- **Deciders:** Project owner (pending)
- **Related:** ADR-0001, ADR-0002, ADR-0003

## Context

A paid order must reliably become a fulfillment job and a delivery email. Serverless functions can fail after a database commit, webhooks can arrive twice or out of order, and supplier calls can time out with an unknown outcome. A direct “write order then call supplier” flow would lose work or duplicate orders.

The platform should avoid Redis, a managed queue, and a separate worker service until measured load justifies them. Netlify provides Background Functions (up to 15 minutes) and Scheduled Functions (30 seconds, published deploys only).

## Decision

- Use a **transactional outbox**: any state change that requires a side effect writes an `outbox_events` row in the same Postgres transaction.
- Use a Postgres job queue (`fulfillment_jobs`, `email_jobs` or equivalent) claimed with `SELECT ... FOR UPDATE SKIP LOCKED`, a lease, attempt count, and `next_attempt_at`.
- A dispatcher invokes Netlify Background Functions with a signed internal request containing only a job ID.
- A Scheduled Function sweeps due jobs and stuck orders; it enqueues work rather than performing long supplier calls itself.
- Every job has a unique idempotency key. Retries are bounded with exponential backoff and jitter.
- Unsafe/uncertain supplier operations are never retried blindly; they move to `under_investigation` and require reconciliation.
- Dead jobs are visible in admin with controlled retry/resolve actions and audit entries.
- Email delivery is tracked separately from eSIM delivery.

## Consequences

**Positive**

- No lost fulfillment job after a committed payment.
- No extra queue infrastructure in the MVP.
- Idempotency and retries are explicit and testable.
- Background functions can perform supplier calls that exceed normal request limits.

**Negative / risks**

- Postgres becomes both datastore and queue; heavy volume can affect query latency.
- `SKIP LOCKED` and lease handling require careful testing under concurrency.
- Netlify function invocation is at-least-once; handlers must be idempotent.
- Scheduled Functions do not run on unpublished deploys and have a 30-second limit.
- Internal job endpoints need authentication; a leaked secret could trigger work.
- Long-running supplier calls may still hit the 15-minute ceiling.

**Neutral**

- A dedicated queue (SQS, QStash) can replace the dispatcher later without changing domain transactions.
- Outbox events are retained for audit and replay, with a retention policy.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| Call supplier directly in the payment webhook | Webhook timeout and function limits; no retry safety. |
| Redis/BullMQ | Adds a paid service and another failure domain before load requires it. |
| Managed queue (SQS/QStash) | Good future option; unnecessary complexity for MVP volume. |
| Database triggers invoking functions | Opaque, hard to test, and provider-specific. |
| Cron-only polling | Too slow for a good customer experience and wasteful. |

## Verification

1. Integration test: payment transaction commits order + outbox atomically; a forced failure rolls back both.
2. Concurrent workers claim a job exactly once.
3. Duplicate function invocations produce one supplier order and one email.
4. A stuck job is swept, alerted, and recoverable in admin.
5. A >30-second simulated job completes in a Background Function.
6. The Scheduled Function runs on a published staging deploy and enqueues work within its limit.

## Revisit triggers

- Job volume or latency degrades checkout/database performance.
- Netlify function limits are insufficient for supplier latency.
- A managed queue becomes cheaper or materially more reliable.
- Exactly-once delivery becomes a hard requirement (it still requires idempotent handlers).
