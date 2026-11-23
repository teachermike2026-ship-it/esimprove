# Recovery status

Status as investigated on 2026-11-10: **recovery incomplete**. Do not use the port-3000 instance as evidence of access to the preserved database. No real owner login or verified database backup has been established.

| Environment | Database type | Actual target identified | Connection verified | Schema status | Owner account |
|---|---|---|---|---|---|
| Local, configured default | PGlite | `C:\Users\hp\esimprove\.pglite`, when no process override or `DATABASE_URL` applies; whether this is the intended live data is unconfirmed | UNKNOWN | UNKNOWN; startup can apply pending migrations | UNKNOWN |
| Local, port 3000 | PGlite suggested by launch ancestry | An ancestor references the disposable `esimprove-verify-20261110` directory; effective environment and target are not verified | UNKNOWN | UNKNOWN | UNKNOWN |
| Production | PostgreSQL required by deployed configuration | UNKNOWN; Netlify configuration exists but does not establish an actual deployment or provider | UNKNOWN | UNKNOWN | UNKNOWN |

The preserved directory exists; its contents have not been queried because exclusive access and a consistent, verified backup have not been established. No production environment values or connections have been inspected. Local and production must never be assumed identical.

The owner-only boundary is not implemented: `admin` and `super_admin` currently share all listed permissions. First-login password rotation exists and has isolated tests, but it is not proof of a real owner login. The former token-login work is not connected to authentication; no token provisioning is requested.
