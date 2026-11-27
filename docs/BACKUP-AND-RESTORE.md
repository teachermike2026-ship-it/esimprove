# ESIMPROVE — Backup and restore procedure (production database)

The production database is PostgreSQL on **Neon** (project `esimprove`, database `neondb`). This document describes the backup strategy and how to restore. Nothing here has been executed against production by this change.

## What protects the data today
| Layer | What it does | Where to check |
|---|---|---|
| **Neon point-in-time restore (PITR)** | Neon keeps the write-ahead log for the history window of your plan, so the database can be restored to any second inside that window. | Neon console → project `esimprove` → **Settings → Storage / History retention** (window length depends on plan). |
| **Neon branches (snapshots)** | A branch is an instant copy-on-write copy of the database at a moment. Use one before every migration or risky change. | Neon console → **Branches**. |
| **Logical dumps (`pg_dump`)** | Portable file copies you keep outside Neon. Recommended daily. | Your own storage (never in the Git repository). |

## Recommended daily backup
1. **Automated (preferred):** create a scheduled job (for example a GitHub Actions workflow on a private repository, or any trusted scheduler) that runs nightly:
   ```bash
   pg_dump "$DATABASE_MIGRATION_URL" --format=custom --no-owner --file="esimprove-$(date -u +%F).dump"
   ```
   The scheduler stores the file in private storage, such as a private S3 or R2 bucket with versioning, and keeps 30 days. The direct (non-pooler) connection string is stored only as a secret in that scheduler.
2. **Before every migration or deployment:** create a Neon branch named `pre-<change>-YYYYMMDD`.

The admin console can't show "last successful backup" yet. That needs either a Neon API key (to list branches or backups) or a heartbeat from your backup job. See the manual actions in the final report.

## Restore procedures
**A. Undo a bad change within the PITR window (fastest, whole database):**
1. Open Neon console → **Branches → Restore** (or "Reset from parent / point in time").
2. Choose a timestamp just before the problem, and restore into a **new branch** first.
3. Check the new branch with read-only queries: row counts for `orders`, `payments` and `esims`, and the latest `schema_migrations`.
4. Point production at it (make it the primary branch, or change `DATABASE_URL` in Netlify), then redeploy.

**B. Restore from a snapshot branch:**
1. Neon console → **Branches** → the `pre-…` branch → **Set as primary**, or copy its connection string into Netlify.
2. Orders placed after the snapshot are not in it. Export them from the old branch first if they matter.

**C. Restore from a `pg_dump` file (into a new, empty database or branch):**
```bash
pg_restore --no-owner --dbname="$TARGET_DATABASE_URL" esimprove-YYYY-MM-DD.dump
```
Verify, then switch `DATABASE_URL` as above.

## Rules
- Never run `DROP`, `TRUNCATE` or destructive SQL on the production database.
- Never restore over the live branch directly. Always restore into a new branch, verify, then switch.
- Never commit dumps, connection strings or credentials to the repository.
- Migrations are forward-only and additive (see `docs/PRODUCTION_MIGRATION_RUNBOOK.md`).
