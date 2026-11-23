# Deploying database migrations

This document covers the SQL migration runner for PostgreSQL deployments. It
does **not** authorize a deployment, and it does not make any pending external
prerequisite (managed PostgreSQL, backups, scheduler, monitoring) available.

## Current baseline

| Item | Value |
| --- | --- |
| Migration files | `db/migrations/0001` … `0006` |
| Latest migration | `0006_legal_compliance.sql` |
| Applied on the local PGlite database | 0001–0005 only (0006 is pending until migrated) |
| Runner | `lib/db/migrate.ts` via `npm run db:migrate` |
| Failure mode | Fail closed: no local PGlite fallback for deployed contexts |

## How the runner works

1. Reads every `*.sql` file in `db/migrations`, sorted by filename.
2. Creates `schema_migrations` if it does not exist.
3. Skips files already recorded in `schema_migrations`.
4. Rejects an applied file whose SHA-256 checksum has changed. Never edit an
   applied migration; add a new numbered file instead.
5. For PostgreSQL, takes a session advisory lock so two deploys cannot migrate
   concurrently, and applies each migration inside `BEGIN`/`COMMIT`.
6. Records the migration id and checksum only after the SQL commits.

PGlite applies migrations automatically when the application opens the local
database. Deployed PostgreSQL does not: it requires the explicit command below.

## Required environment

| Variable | Requirement |
| --- | --- |
| `APP_ENV` | `local`, `preview`, `staging`, or `production` |
| `DATABASE_ENV` | Must equal `APP_ENV` for `preview`, `staging`, or `production` |
| `DATABASE_MIGRATION_URL` | Preferred migration connection string; falls back to `DATABASE_URL` |
| `DATABASE_URL` | Application connection string; used if no migration URL is set |

For `preview`, `staging`, or `production`, the runner refuses to start when
`DATABASE_ENV` does not match `APP_ENV`, or when neither connection string is
present. A deployed context is never allowed to migrate the local `.pglite`
directory.

Use a direct or administrator connection for migrations, not a transaction-mode
pooler. The advisory lock and `BEGIN`/`COMMIT` must stay on one session.

## Before applying

1. Confirm the target database host, `APP_ENV`, and `DATABASE_ENV` in the
   deployment environment. Do not print connection strings.
2. Confirm a provider backup or point-in-time recovery window exists. This is an
   external prerequisite and remains **BLOCKED** until the owner confirms it.
3. Read the pending migration SQL. `0006_legal_compliance.sql` is additive: it
   creates Phase 5 tables and indexes, seeds reviewed defaults with
   `ON CONFLICT DO NOTHING`, and adds `support_tickets.requester_email` with
   `IF NOT EXISTS`. It contains no `DROP`, `TRUNCATE`, or `DELETE`.
4. Check the authenticated detailed health response:
   `GET /api/health` with `x-health-token` or `Authorization: Bearer …`.
   The `details.migrations` object reports `appliedCount`, `pending`,
   `schemaTablePresent`, and `upToDate`.

## Apply

```powershell
# Run from the repository root with the target environment loaded.
# APP_ENV and DATABASE_ENV must match; secrets come from the deployment
# environment, never from a committed file.
npm run db:migrate
```

The command prints only the dialect and context, never the host or credentials,
and then `Migrations applied on postgres.` Exit code 0 means every file is
recorded in `schema_migrations`.

## After applying

1. Re-check `GET /api/health` (detailed). `details.migrations.pending` must be
   an empty array and `upToDate` must be `true`.
2. Spot-check application reads and writes in the target environment.
3. Do not run `0006` manually; the runner already did.
4. If a migration fails, the failing file is rolled back and not recorded. Fix
   forward with a new migration file. Do not edit an applied file.

## Rollback

There is no automatic down migration. Rollback means restoring the provider
backup taken before the run. Because `0006` is additive, an application rollback
without a database rollback leaves unused tables and one extra nullable-safe
column (`requester_email` defaults to an empty string); it does not delete
existing data.

## Upgrade evidence (local copy, 2026-11-08)

WP3 copied `.pglite` to
`C:\Users\hp\AppData\Local\Temp\opencode\esimprove-pglite-0006-copy`, removed
only the stale `postmaster.pid` from the copy, and migrated the copy. The
original remained byte-identical (aggregate SHA-256 unchanged).

| Check | Before | After |
| --- | --- | --- |
| `schema_migrations` rows | 5 | 6 |
| Public tables | 54 | 65 |
| Phase 5 tables present | 0 | 11 |
| `support_tickets.requester_email` | absent | present (`text NOT NULL DEFAULT ''`) |
| Users | 1 | 1 |
| Orders | 4 | 4 |
| Plans | 99 | 99 |
| Support tickets | 0 | 0 |

Regression coverage: `tests/migration-upgrade.test.ts` builds a representative
0001–0005 database, applies 0006, verifies all 11 tables and the added column,
confirms representative rows survive, checks pending-migration reporting, and
proves a second run is a no-op.

## Related external prerequisites (BLOCKED)

Managed production PostgreSQL, provider backups/restore drills, the external
scheduler that invokes `/api/jobs/run`, monitoring/alerting, and deployment
approval are not provided by this repository. See
`ESIMPROVE_OPEN_ISSUES_AND_BLOCKERS.md`.
