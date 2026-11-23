# Production PostgreSQL Migration Plan — Esimprove

**Status (2026-11-23):** Neon project `esimprove` created by the owner. The pooled and direct
connection strings are stored outside this repository. No connection, migration, or data transfer
has run. This document does not authorize those actions.

## 1. Why an external database is required

Netlify Functions have no persistent local filesystem. A PGlite directory cannot survive a deploy,
scale across function instances, or provide durable storage. Deployed contexts already refuse to
start on PGlite and require `DATABASE_URL` to be a `postgres://` or `postgresql://` URL.

The application supports PostgreSQL through `pg` and Drizzle ORM. The schema is defined by nine
forward-only SQL migrations in `db/migrations/` (64 tables). No new database abstraction is needed.

## 2. Protected local databases

| Path | Role | Rule |
| --- | --- | --- |
| `.pglite/` | Original local PGlite database | Keep in place, gitignored, never overwrite or migrate without approval |
| `.audit/impl-db/` | Recovered/implementation PGlite database | Keep in place, gitignored, never overwrite or delete |

Additional rules:

- Never open the same PGlite directory from two processes at once.
- Never copy a database directory while a process may be using it.
- Never move either directory into Git or upload it to Netlify.
- Do not delete recovery archives or audit artifacts.
- Do not run `db:seed` or `db:migrate` against a preserved local database as part of deployment
  preparation.

The local databases are evidence and recovery sources, not production data.

## 3. Production data decision

**Recommended:** provision a fresh production database and do **not** copy the local demo
database into it.

Reasons:

- The local catalogue is 99 demo plans across 33 destinations, all marked `isDemo`.
- Local orders, payments, users, and activation records are simulated.
- Production must not present demo inventory or demo customers as real.
- The schema is reproducible from migrations; production should start clean.

Production initialization is therefore:

1. Empty managed PostgreSQL database.
2. Apply the nine migrations.
3. Create the first administrator with `npm run admin:create`.
4. Enter only real catalogue/content through the admin UI, after approval.

If the owner later requires specific non-demo records to be preserved, export only those reviewed
rows after stopping every process that can access the local database, then import them into the
migrated production database and validate counts and references. That transfer is a separate,
explicitly approved operation. It is not part of this plan's default path.

## 4. Provider options

**Selected provider: Neon.** The owner created the `esimprove` Neon project. Use its pooled endpoint
for `DATABASE_URL` and its direct (non-pooled) endpoint for `DATABASE_MIGRATION_URL`. Keep the direct
URL out of the Functions runtime. Use a separate Neon branch/database for preview/staging; do not
point deploy previews at the production branch.

Any managed PostgreSQL provider that offers TLS, backups/PITR, and both pooled and direct/session
connection strings is technically compatible. The table below records the evaluation criteria.

| Provider family | Examples | Points to verify |
| --- | --- | --- |
| Serverless PostgreSQL | Neon, Supabase | Pooled vs direct URL, cold starts, connection limits, PITR plan |
| Managed app platforms | Railway, Render | Persistent Postgres add-on, backups, region, pooled endpoint |
| Hyperscaler managed | Amazon RDS/Aurora, Google Cloud SQL, Azure Database for PostgreSQL | Private networking/VPC access from Netlify Functions, public TLS endpoint, pooled proxy, cost |
| Specialized Postgres | Crunchy Bridge and similar | Pooler availability, region, restore procedure |

Selection criteria:

- Public TLS endpoint reachable from Netlify Functions, or a supported secure proxy.
- A pooled connection string for runtime and a direct/session connection for migrations.
- Backups and point-in-time recovery enabled before the first production migration.
- A connection limit compatible with serverless concurrency. The app defaults to
  `DATABASE_POOL_MAX=3` per function instance.
- Region close to the Netlify Functions region to reduce latency.
- Ability to create separate preview and production databases/roles.

Do not invent hostnames, credentials, or provider-specific DNS records.

## 5. Topology and secrets

Create at least:

- one isolated preview/staging database;
- one production database;
- separate roles/passwords per context;
- separate application secrets and KEKs per context.

The existing Neon project currently provides the production database. Before enabling Netlify
deploy previews, create an isolated Neon branch or database for preview/staging. Never point a
deploy preview at the production branch.

Required database variables:

| Variable | Scope | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Build and Functions runtime | Pooled/session URL with TLS; must not point at localhost or use `sslmode=disable` |
| `DATABASE_MIGRATION_URL` | Migration tooling only | Direct/session URL; keep out of the Functions runtime scope |
| `DATABASE_ENV` | Build and runtime | Must equal `APP_ENV` (`preview`, `staging`, or `production`) |
| `DATABASE_SSL` | Build and runtime | `require` recommended; `disable` is rejected when deployed |
| `DATABASE_SSL_CA` | Optional | Only for a provider with a private CA; never commit a private key |
| `DATABASE_POOL_MAX` | Runtime | 1–10; default 3 deployed |

Transaction-mode poolers are not suitable for `DATABASE_MIGRATION_URL`: the migration runner uses
a session advisory lock and a dedicated connection. Use a direct or session-mode URL for
migrations.

## 6. Migration procedure

Do not run these commands until the owner approves the database and migration window. Supply the
direct Neon URL from the owner's credentials file at execution time; never paste it into this
document, commit it, or add it to the Functions runtime. Never run migrations against `.pglite` or
`.audit/impl-db`.

### Preview

```powershell
$env:APP_ENV = "preview"
$env:DATABASE_ENV = "preview"
$env:DATABASE_MIGRATION_URL = "postgresql://USER:PASSWORD@PREVIEW_HOST:5432/PREVIEW_DB?sslmode=require"
npm.cmd run db:migrate
```

### Production

```powershell
$env:APP_ENV = "production"
$env:DATABASE_ENV = "production"
$env:DATABASE_MIGRATION_URL = "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
npm.cmd run db:migrate
```

Bash equivalent:

```bash
APP_ENV=production \
DATABASE_ENV=production \
DATABASE_MIGRATION_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require' \
npm run db:migrate
```

Behavior:

- Migrations apply in filename order, one transaction per file.
- A session advisory lock prevents concurrent migration runs.
- Applied files store a SHA-256 checksum; editing an applied file aborts the next run.
- The script prints only the dialect and context; it never prints the host or credentials.
- Migrations are forward-only. Rollback is restore-from-backup or a reviewed compensating
  migration, never editing an applied file.

### First administrator

After migrations, create the first production administrator with the guarded command. Use a
one-off secret source, not the Functions runtime scope.

```powershell
$env:APP_ENV = "production"
$env:DATABASE_ENV = "production"
$env:DATABASE_MIGRATION_URL = "postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
$env:ACTIVATION_KEK_V1 = "BASE64_32_BYTE_KEY"
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "A-LONG-UNIQUE-PASSWORD"
$env:ADMIN_TOTP_SECRET = "BASE32_AUTHENTICATOR_SECRET"
$env:ADMIN_CREATE_CONFIRM = "CREATE"
npm.cmd run admin:create
```

Remove the variables from the shell afterwards. Do not run `db:seed` in production.

## 7. Verification after migration

- `npm run db:target` reports the expected context, host, and dialect without secrets.
- The migration table contains all nine applied files with matching checksums.
- Expected tables exist (64 in the current schema).
- `/api/health` returns 200 and the detailed check reports the PostgreSQL dialect.
- Admin login with TOTP works; no demo users or demo plans exist.
- A preview database is reachable independently from production.
- Backups/PITR are enabled and a restore rehearsal is scheduled before launch.

## 8. Rollback and recovery

- Application rollback does not roll back schema changes.
- Restore from the provider backup/PITR, or apply a reviewed compensating migration.
- Keep every applied migration file unchanged.
- If a migration fails mid-run, stop, inspect the provider state, restore if necessary, and do not
  retry blindly.
- Preserve the local PGlite databases as the recovery source for pre-production work.

## 9. Approval gates

The following require explicit owner approval and are not performed by this plan:

1. Creating a provider account or project.
2. Provisioning preview or production databases.
3. Storing connection strings or secrets in Netlify.
4. Running migrations against any external database.
5. Transferring any local data.
6. Creating the production administrator.
7. Enabling backups, monitoring, or paid provider features.
8. Committing/pushing the applied Next.js 16.4.6 package/lockfile upgrade.
9. Creating a Netlify site or adding Netlify-scoped environment variables.
10. Changing DNS or connecting `esimprove.com`.
