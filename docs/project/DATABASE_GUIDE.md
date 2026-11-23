# Database guide

Read [current status](PROJECT_STATUS.md) first. Run `npm.cmd run db:target` from the project directory for a non-connecting, credential-redacted description of **that command's own process configuration**. It cannot inspect another running server or prove database identity or safety. The default local data directory is `C:\Users\hp\esimprove\.pglite`, relative to the process working directory; environment overrides may select another database. Never publish `DATABASE_URL` or other environment values. The server on port 3000 has a verification-directory reference in its ancestry; its actual database has not been verified.

**Do not run setup, seed, migrations, provisioning, or restart the app against the preserved database until a consistent backup has been made and restore-verified.** `npm run dev` invokes `predev` setup; `getDb()` automatically applies local migrations. Simply copying an active data directory is not a verified backup.

PGlite 0.5.11 exposes `dumpDataDir()`. Its existence alone is not a verified backup procedure: establish safe exclusive ownership, use the installed API appropriately, store the backup outside the data directory with restricted access, then restore an isolated copy and check integrity and application data before modifying the original. No such backup or restore drill has yet been verified. Do not open a second PGlite instance on a potentially active directory.

For deployed PostgreSQL use the provider's consistent backup and restore procedure, and the separate [migration guide](../DEPLOY-MIGRATIONS.md). The production target and provider are currently unknown. Do not point local recovery scripts at production.
