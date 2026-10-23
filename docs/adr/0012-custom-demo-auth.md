# ADR-0012: Custom database sessions + scrypt + TOTP for the local demo

- **Status:** Accepted for the local demo; production review pending
- **Date:** 2026-10-23
- **Deciders:** Implementation decision (owner production decision still open)
- **Related:** ADR-0005, ADR-0010

## Context

Phase 0 proposed Better Auth with database sessions and mandatory admin TOTP. The local build
needed a self-contained auth path that worked with the existing Drizzle schema and PGlite without
adding an unverified vendor integration. No legal entity, identity provider, sending domain, or
production security review exists.

## Decision

For the local/demo implementation only:

- Store users in the existing `users` table with scrypt password hashes.
- Use opaque, high-entropy session tokens; store only their SHA-256 hashes in `sessions`.
- Set host-only `HttpOnly`, `SameSite=Lax` cookies; `Secure` when `SITE_URL` is HTTPS.
- Require TOTP for the seeded demo admin before an admin session is promoted.
- Rate-limit login, registration, and 2FA attempts in the database.
- Audit login, logout, registration, and 2FA events.
- Use server-side guards (`requireUser`, `requireAdmin`) and object-level order/eSIM checks.

This is **not** a production auth platform. Email verification, password reset, backup codes,
session revocation on password change, account recovery, full RBAC, admin re-authentication, and
independent security review are not implemented.

## Consequences

**Positive**

- No external identity vendor or credential is required for the demo.
- Sessions are revocable centrally; passwords and session tokens are not stored in plaintext.
- The admin flow demonstrates mandatory TOTP and server-side authorization.

**Negative / risks**

- We own auth security and recovery; a bug can lock users out or expose accounts.
- No email verification means an address is not proven to belong to the registrant.
- No password reset means a real customer could be permanently locked out.
- No backup codes or admin recovery process.
- The implementation has not been penetration-tested or reviewed by an independent expert.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| Better Auth | Proposed in ADR-0005, but not installed or verified in this build; production decision still open. |
| Auth0/Clerk | Adds a vendor, cost, and separate user store; no account or approval. |
| Supabase Auth | Couples identity to a database vendor not selected. |
| NextAuth/Auth.js | Viable, but not evaluated against the current schema. |

## Verification

- Unit tests cover scrypt hash/verify, TOTP generation/verification, and crypto primitives.
- Integration tests cover session-gated order access and admin-guarded actions indirectly.
- `requireAdmin` redirects unauthenticated, pending-2FA, and non-admin sessions.
- No test yet covers CSRF/origin behavior, session revocation, cookie flags in a browser, or
  brute-force limits under concurrency.

## Revisit triggers

- A production launch is proposed.
- A security review finds a flaw.
- Email verification, password reset, or account recovery becomes required.
- The owner selects a managed identity provider or requires SSO/hardware keys.
- Better Auth is actually integrated and tested.
