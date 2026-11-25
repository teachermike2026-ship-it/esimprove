# ESIMPROVE — Production Migration Runbook

**Date:** 2026-11-23
**Target:** Existing Neon project `esimprove`, database `neondb`, role `neondb_owner`.
**Status:** **Executed once on 2026-11-23** with explicit owner approval. The initial migration applied 9/9 files to the then-empty database (65 public tables); no seed ran. Keep this document as the repeatable runbook for future environments, and do **not** re-run it against the same database.
**Rule:** No `db:seed`, no demo data, no destructive SQL, and no credentials in logs or reports.

---

## 1. Approval gate

Do not run any command in this document until the owner confirms:

1. **Migration approval:** “Run the ESIMPROVE production migration.”
2. **Backup/PITR:** the Neon backup or point-in-time-recovery window is confirmed and understood.
3. **Window:** no production traffic or an accepted brief outage (the site is not live yet, so this is low risk).

No migration, seed, admin creation, or schema change had been run before 2026-11-23. A read-only pre-check confirmed the database had **0 public tables** and no `schema_migrations` table.

### Execution record (2026-11-23)

| Check | Result |
|---|---|
| Pre-migration identity | `neondb` / `neondb_owner` via the direct connection |
| Pre-migration state | 0 public tables, no `schema_migrations` |
| Command | `npm run db:migrate` with `APP_ENV=production`, `DATABASE_ENV=production`, direct `DATABASE_MIGRATION_URL` |
| Result | 9/9 migrations applied; exit code 0 |
| Post-migration state | 65 public tables; `schema_migrations` contains `0001`–`0009`; key tables present |
| Seed | Not run — no demo users, plans, orders, or local PGlite data imported |
| Administrator | Created separately after migration; 2FA enabled; credentials only in the ignored local file |

Do not re-run the migration against this database; the runner will skip applied files and reject checksum changes, but the initial schema is already complete.

---

## 2. What will run

| Property | Verified behavior |
|---|---|
| Files | `db/migrations/0001_initial.sql` … `0009_account_refund_support_workflows.sql` (9 files) |
| Order | Filename order (`lib/db/migrate.ts:42–46`) |
| Tracking | `schema_migrations` table with `id`, `applied_at`, `checksum` (`:87–96`) |
| Integrity | SHA-256 checksum per file; edits to applied files are rejected (`:38–40, 108–125`) |
| Locking | PostgreSQL session advisory lock `1481193201` with 15s lock timeout (`:12–13, 183–206`) |
| Transactions | One `BEGIN`/`COMMIT` per file; rollback on failure (`:127–147`) |
| Direction | Forward-only; there are no down migrations |
| Destructive SQL | None found (`DROP TABLE`, `DROP COLUMN`, `DROP INDEX`, `TRUNCATE`, `DELETE FROM`, `ALTER TABLE … DROP` all absent) |
| Seed content | `0006` inserts only legal/compliance defaults with `ON CONFLICT DO NOTHING`; no catalogue, users, orders, or payments |
| Empty-database safety | Create/additive statements with `IF NOT EXISTS`; foreign-key targets created before references |
| Required connection | Direct/session URL (`DATABASE_MIGRATION_URL`); deployed runs refuse the pooled fallback (`scripts/migrate.ts:19–27`) |
| Connection secrets | Read from the local credentials file; never printed |

The migration creates schema and reviewed legal defaults only. It does **not** create a production administrator; that is a separate approved step.

---

## 3. Pre-flight checks

- [ ] Repository root: `C:\Users\hp\esimprove`
- [ ] Node.js available (`node -v`, `npm -v`).
- [ ] Credentials file exists: `%USERPROFILE%\Desktop\neon-credentials.txt` (do not open in an editor that displays values).
- [ ] `.env.netlify.production` exists locally and is ignored by Git.
- [ ] Neon backup/PITR confirmed.
- [ ] No deploy is currently publishing the old schema to users.

Optional read-only sanity check: confirm the target is still empty (via Neon SQL editor):

```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Expected before migration: 0
```

---

## 4. Execution procedure

Run in a **private local PowerShell window**. The commands below do not print the connection string.

```powershell
# 1. Move to the repository
cd C:\Users\hp\esimprove

# 2. Read the direct (non-pooled) URL into the process environment without displaying it
$credRaw = Get-Content "$env:USERPROFILE\Desktop\neon-credentials.txt" -Raw
$urls = [regex]::Matches($credRaw, 'postgres(?:ql)?://[^\s"'']+') | ForEach-Object { $_.Value }
$env:DATABASE_MIGRATION_URL = @($urls | Where-Object { $_ -notmatch '-pooler\.' })[0]
if (-not $env:DATABASE_MIGRATION_URL) { throw "Direct Neon URL not found; stop." }

# 3. Declare the deployed context (must match)
$env:APP_ENV = "production"
$env:DATABASE_ENV = "production"

# 4. Apply migrations
npm run db:migrate
```

Expected output (no host, no credentials):

```text
Applying migrations to PostgreSQL (target redacted) (APP_ENV=production)...
Migrations applied on postgres.
```

Exit code `0` means every file was committed and recorded. If a file fails, it is rolled back and **not** recorded; fix forward with a new migration file.

### Why these variables are enough

`scripts/migrate.ts` loads `.env.local`, but Node does not overwrite variables already set in the process environment. The direct URL therefore stays authoritative, and `.env.local` still supplies nothing that can redirect the migration to PGlite. The runner refuses a deployed context without `DATABASE_MIGRATION_URL`.

---

## 5. Post-migration verification (read-only)

Using the Neon SQL editor or any read-only client:

```sql
SELECT count(*) AS applied FROM schema_migrations;
-- Expected: 9

SELECT id FROM schema_migrations ORDER BY id;
-- Expected: 0001_initial.sql … 0009_account_refund_support_workflows.sql
```

Do not run `db:seed`. Do not copy local PGlite data. Do not insert demo users, plans, or orders.

After the Netlify deploy exists, verify the application view:

```powershell
curl.exe -sS -H "Authorization: Bearer $env:HEALTH_CHECK_TOKEN" `
  "https://esimprove-4eiz.netlify.app/api/health"
```

Expected: `checks.database: "ok"`, `migrations.pending: []`, `upToDate: true`.

### Clear the temporary environment variables

```powershell
Remove-Item Env:DATABASE_MIGRATION_URL -ErrorAction SilentlyContinue
Remove-Item Env:APP_ENV -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_ENV -ErrorAction SilentlyContinue
```

---

## 6. Initial administrator bootstrap (separate approval)

The database must be migrated first. This step writes one admin user. It is **not** automated and does not run during a deploy. It was executed **once on 2026-11-23** after migration, using a locally generated password and TOTP secret; the stored hash, encrypted secret, and current TOTP code were verified. Credentials exist only in the ignored local file `.audit/esimprove-production-admin-credentials.txt`.

Required inputs:

| Variable | Requirement |
|---|---|
| `APP_ENV` | `production` |
| `DATABASE_ENV` | `production` |
| `DATABASE_MIGRATION_URL` | Direct Neon URL (same extraction as above) |
| `ACTIVATION_KEK_V1` | **The same production KEK** used by the app (copy from `.env.netlify.production` without displaying it) |
| `ADMIN_EMAIL` | Owner-controlled email |
| `ADMIN_NAME` | Display name (optional; default “Administrator”) |
| `ADMIN_PASSWORD` | ≥10 characters; use a generated password from a password manager |
| `ADMIN_TOTP_SECRET` | Base32 secret, 16–64 characters (`A–Z`, `2–7`) |
| `ADMIN_CREATE_CONFIRM` | Must be exactly `CREATE` when `APP_ENV=production` |

Safety behavior of `scripts/create-admin.ts`:

- Refuses production without `ADMIN_CREATE_CONFIRM=CREATE` (`:15–21`).
- Requires `APP_ENV=production` and `DATABASE_ENV=production` to match (`:22–25`).
- Requires a valid email and a password of at least 10 characters (`:27–30`).
- Requires a Base32 TOTP secret and `ACTIVATION_KEK_V1` (`:31–37`).
- Refuses if the email already exists, so it cannot silently overwrite an account (`:53–60`).
- Creates the user with role `admin`, `emailVerifiedAt`, `totpEnabled=true`, and an encrypted TOTP secret (`:62–71`).
- Prints the email only; never prints the password or TOTP secret (`:73–74`).

Suggested safe entry (private terminal; inputs are not echoed by `Read-Host -AsSecureString`):

```powershell
cd C:\Users\hp\esimprove
$env:APP_ENV = "production"
$env:DATABASE_ENV = "production"
$env:ADMIN_CREATE_CONFIRM = "CREATE"

# Direct URL without printing
$credRaw = Get-Content "$env:USERPROFILE\Desktop\neon-credentials.txt" -Raw
$urls = [regex]::Matches($credRaw, 'postgres(?:ql)?://[^\s"'']+') | ForEach-Object { $_.Value }
$env:DATABASE_MIGRATION_URL = @($urls | Where-Object { $_ -notmatch '-pooler\.' })[0]

# Copy the KEK from the local production file without printing it
$env:ACTIVATION_KEK_V1 = ((Get-Content .env.netlify.production | Where-Object { $_ -match '^ACTIVATION_KEK_V1=' }) -split '=',2)[1]

$env:ADMIN_EMAIL = Read-Host "Admin email"
$env:ADMIN_NAME = Read-Host "Admin display name"
$secure = Read-Host "Admin password (≥10 chars)" -AsSecureString
$env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
)
$env:ADMIN_TOTP_SECRET = Read-Host "Base32 TOTP secret (16–64 chars)"

npm run admin:create
```

Expected: `Administrator created for <email>. The password and TOTP secret were not logged.`

Then clear the variables:

```powershell
$env:ADMIN_PASSWORD = $null
$env:ADMIN_TOTP_SECRET = $null
$env:ACTIVATION_KEK_V1 = $null
$env:ADMIN_EMAIL = $null
$env:ADMIN_NAME = $null
$env:ADMIN_CREATE_CONFIRM = $null
Remove-Item Env:DATABASE_MIGRATION_URL -ErrorAction SilentlyContinue
```

### First login

1. Open `https://esimprove-4eiz.netlify.app/login`.
2. Enter the admin email and password.
3. Complete the TOTP challenge with the authenticator entry matching `ADMIN_TOTP_SECRET`.
4. Confirm `/admin` loads and non-admin users cannot access it.
5. Store the password and TOTP recovery material in a password manager. Do not display them again.

Demo admin accounts are never seeded in production: `db:seed` refuses `APP_ENV=production`, and `db:setup` refuses all deployed contexts.

---

## 7. Failure handling

| Failure | Action |
|---|---|
| Missing direct URL | Stop; verify the credentials file and classification; do not guess or substitute the pooled URL |
| Checksum mismatch | An applied migration was edited. Do not bypass; inspect history and fix forward with a new file |
| SQL error inside a file | The file is rolled back and not recorded. Fix with a new migration; do not edit an applied file |
| Advisory lock timeout | Another migration session holds the lock. Wait and retry; do not force-unlock blindly |
| Wrong database | Stop immediately. Verify `DATABASE_ENV=production` and the direct URL classification without printing values |

---

## 8. Rollback and recovery

- **Application:** redeploy the previous Netlify deploy. The migrations are additive, so older code can run against the new schema.
- **Database:** restore the Neon backup/PITR snapshot taken before the migration. There are no down migrations.
- **Code:** no commit or push is part of this runbook; deployment remains driven by the approved `main` commit.

---

## 9. Explicitly out of scope

- No `npm run db:seed`.
- No copy of `.pglite` or `.audit/impl-db`.
- No production demo catalogue, users, orders, or payments.
- No preview/staging database migration.
- No DNS or custom-domain change.
- No live payment/supplier/email/catalogue/analytics activation.

**This runbook is prepared and ready for an approved migration window. Nothing in it has been executed.**
