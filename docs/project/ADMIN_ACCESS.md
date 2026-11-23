# Admin access & owner provisioning

Status as of 2026-11-11 (local):

- The preserved local database `.pglite` **does contain one owner row** for `teacher.mike2026@gmail.com` (role `admin`, TOTP enabled, `passwordChangeRequired = true`). It was created accidentally by an earlier bootstrap run that omitted `PGLITE_DATA_DIR`, so the script fell back to `.env.local` → `.pglite`.
- That row is **not usable yet**: the password printed by the old script does not verify against the stored hash (the old stdin handling did not reject invisible/embedded characters). There is no verified pre-write backup of `.pglite` from before that insert.
- No customer, order, payment, or other business data was changed. The `users.email` unique index prevents duplicate accounts.
- A safe `--repair` mode now exists and has been exercised end-to-end against an isolated copy of `.pglite`.
- The site currently listening on port 3000 (PID 11624) is **not** using `.pglite`; it was started against a disposable verification directory. It must be restarted before the repaired account is visible.

## Owner account

- Email: `teacher.mike2026@gmail.com`
- Role: existing `admin` role (the proposed distinct `owner` role is **not** implemented)
- Login method: email + password; no token login
- Admin login additionally requires a TOTP code because `ADMIN_2FA_REQUIRED` defaults to true
- First login must rotate the temporary password (`passwordChangeRequired = true`)

## Step 1 — Stop the old site

The current port-3000 server (PID 11624) was started against a disposable verification directory. Stop it before touching `.pglite` so only one process can access the database:

- Go to the terminal window that is running the site and press `Ctrl+C`, **or**
- In PowerShell, run `Stop-Process -Id 11624` (only if that is still the site's PID).

Do not run the repair while another process may be holding `.pglite`.

## Step 2 — Repair the real owner row (run this yourself)

Open a normal PowerShell window and run these two lines from the project root. The script prints the temporary password **once, to this terminal only**. Do not paste that output into chat, a file, or Git.

```powershell
cd C:\Users\hp\esimprove
$pw = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 24); $pw | npm.cmd run owner:provision -- --repair
```

The script will:

1. print the exact resolved target (`C:\Users\hp\esimprove\.pglite`) and refuse anything else;
2. refuse `DATABASE_URL`, `memory://`, missing directories, and non-PGlite paths;
3. refuse unless the existing account has the `admin` role;
4. write and validate a compressed backup in `.audit/backups/owner-repair-*.tar.gz` **before** writing;
5. rotate the password hash, TOTP secret, and `passwordChangeRequired = true`;
6. delete all existing sessions for that account;
7. record an `owner.account.repaired` audit event;
8. print the new temporary password, a current 6-digit TOTP code (valid ~30 seconds), and an `otpauth://` setup URL for an authenticator app.

Add the setup URL to an authenticator app (Google Authenticator, Authy, 1Password, etc.) so you can generate codes for future logins. If you miss the 30-second code, re-run the same command; it rotates both secrets again.

## Step 3 — Start the site against `.pglite`

From `C:\Users\hp\esimprove`:

```powershell
npm.cmd run dev
```

This uses `.env.local`, whose `PGLITE_DATA_DIR=.pglite`. (The `predev` setup step only seeds demo catalogue rows and the demo admin if absent; it does not modify the owner account.)

If you prefer not to use port 3000, start a one-off server instead:

```powershell
npx.cmd next dev --port 3200
```

Then use `http://localhost:3200` below. Sessions are stored per database, so the old server could not validate the new session anyway.

## Step 4 — Log in and rotate

1. Open `http://localhost:3000/login?next=%2Fadmin` (or port 3200).
2. Enter the temporary password printed in Step 2.
3. Enter the current 6-digit TOTP code, or the code from your authenticator app.
4. You are taken to `/admin/set-password`. Set your permanent password (minimum 10 characters).
5. The rotation deletes the session. Sign in again with the new password + a fresh TOTP code.
6. Confirm `/admin` (Overview) and `/admin/settings` load.

## Verified evidence

The full flow was run in a real headless Microsoft Edge browser against an isolated copy of `.pglite`, using the same app code, the same repair script, and a private Next dev server on port 3100. **37/37 checks passed**, including:

| Check | Result |
|---|---|
| Repair script on a copy of `.pglite` | PASS — backup written, one `admin` row, TOTP + rotation flag set |
| Temporary password → `/login/2fa` | PASS |
| TOTP → `/admin/set-password` | PASS |
| Direct `/admin` before rotation | PASS — redirected to `/admin/set-password` |
| Set permanent password | PASS |
| Session revoked after rotation | PASS — `/admin` redirected to `/login` |
| Old temporary password rejected | PASS |
| New password + TOTP → `/admin` | PASS |
| Admin-only `/admin/settings`, `/admin/audit` | PASS |
| Logout → anonymous `/admin` denied | PASS |
| Customer login → `/admin` denied (`/portal`) | PASS |
| Support login → overview allowed, admin-only settings denied, scoped orders allowed | PASS |
| Database state after flow | PASS — `passwordChangeRequired=false`, new hash verifies, old hash rejected, no sessions, audit events present |

Other gates:

- `npx tsc --noEmit` — exit 0.
- `npx vitest run tests/owner-first-login.test.ts` — 3/3 passed.

**Not yet verified:** the repair command against the real `.pglite`, and a login against the restarted real site. Those require the terminal-only password display and are therefore left to the owner. The existing port-3000 process was not stopped or modified.

## Troubleshooting

- **"An account already exists"** — you omitted `-- --repair`. Re-run the command with it.
- **"Refusing to provision: ... DATABASE_URL is set"** — unset `DATABASE_URL` for this shell; this script is local PGlite only.
- **"Refusing to provision: ... does not exist" / "not a PGlite data directory"** — confirm you are in `C:\Users\hp\esimprove` and that `.pglite\PG_VERSION` exists.
- **Login says the password is incorrect** — confirm the site was restarted against `.pglite` after the repair, and that you copied the password without surrounding whitespace. Re-running the repair command rotates it again.
- **"This admin account has no TOTP secret"** — the repair sets TOTP; if this appears, the site is reading a different database.
- **"That code is invalid or has expired"** — use the current code from the authenticator app or re-run the repair command.

## Files involved

- `scripts/provision-owner.ts` — create/repair script (stdin password, local PGlite only, mandatory backup, audit).
- `package.json` — adds `owner:provision`.
- `lib/auth/actions.ts` — login, TOTP, and first-login rotation actions (unchanged).
- `lib/auth/guards.ts` — `/admin` route guards (unchanged).
- `lib/db/client.ts` — target selection: `DATABASE_URL` wins; otherwise `PGLITE_DATA_DIR` or `.pglite` (unchanged).
