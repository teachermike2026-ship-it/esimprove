# Architecture map

Next.js App Router routes are in `app/`; reusable UI is in `components/`. Authentication, sessions, guards and permissions live in `lib/auth/`. Database selection and the Drizzle schema live in `lib/db/`; SQL migrations are in `db/migrations/`. Operational scripts live in `scripts/`, and Vitest tests in `tests/`. The existing admin console is under `app/admin/`.

`createDatabase()` selects PostgreSQL when `DATABASE_URL` is set; otherwise local execution uses PGlite, with `PGLITE_DATA_DIR` overriding the `.pglite` default. `getDb()` automatically runs local PGlite migrations on first use. Production PostgreSQL migrations are explicit. Session and permission checks are server-side, but the dedicated verified-owner identity is not integrated into authorization.

For design detail and historical decisions see [existing architecture](../ARCHITECTURE.md), [data model](../DATA-MODEL.md), and [ADRs](../adr/README.md). Check [current status](PROJECT_STATUS.md) before relying on historical claims.
