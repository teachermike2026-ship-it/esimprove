# ADR-0005: Better Auth, database sessions, mandatory admin TOTP

- **Status:** Superseded by ADR-0012 for the local demo; production auth choice remains open
- **Date:** 2026-10-23
- **Deciders:** Project owner (pending)
- **Related:** ADR-0002, ADR-0010, ADR-0012

> **Implementation note:** the local demo does **not** use Better Auth. It uses a small custom
> database-session implementation with scrypt password hashes and TOTP. See
> [ADR-0012](0012-custom-demo-auth.md). This ADR is retained as the Phase 0 proposal and should
> not be read as evidence that Better Auth is installed or approved.

## Context

Customers need optional accounts and guest-order access. Administrators need strong authentication because they can view orders, issue refunds, change prices, and potentially access activation data. No identity provider is selected, and the legal entity that would contract with one is unknown.

Better Auth documents email/password, a Drizzle adapter, database-backed sessions, and a TOTP plugin with backup codes. It keeps identity data in our Postgres rather than a separate vendor.

## Decision

- Use **Better Auth** with the Drizzle adapter and database sessions.
- Require email verification before account features that expose order or eSIM data.
- Store session tokens hashed where the library supports it; cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, host-only, with no `Domain` attribute.
- Require **TOTP 2FA for every administrator**, with backup codes stored hashed and shown once.
- Block admin sessions until TOTP enrolment is complete; do not allow a “skip for now” path in production.
- Use short admin session lifetimes and re-authentication for sensitive actions (refunds above threshold, credential changes, role changes).
- Enforce RBAC and object-level authorization server-side, independent of the UI.
- Do not seed a production admin account with a default password.
- Rate-limit login, registration, password reset, email verification, 2FA, and guest lookup.

## Consequences

**Positive**

- Identity data stays in our database; no per-user auth vendor fee at low volume.
- Database sessions can be revoked centrally.
- Mandatory TOTP materially reduces admin account takeover risk.
- Drizzle integration keeps the stack coherent.

**Negative / risks**

- We own auth security, migration, and availability; a bug can lock everyone out.
- TOTP enrolment and recovery add support burden.
- Better Auth is younger than established providers; API changes are possible.
- Database sessions add a query to authenticated requests; caching must not weaken revocation.
- No enterprise SSO, SCIM, or hardware-key requirement in the MVP.

**Neutral**

- Customers may optionally enable 2FA later; admins cannot disable it.
- Passkeys/WebAuthn are a possible future addition, not an MVP dependency.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| Auth0/Clerk | Strong managed offering, but adds cost/vendor dependency and a separate user store. |
| Supabase Auth | Convenient with Supabase, but couples identity to a database vendor we have not selected. |
| NextAuth/Auth.js | Viable, but database session and 2FA ergonomics were less clear in the reviewed docs. |
| Custom auth | Unacceptable security and maintenance burden. |

## Verification

1. Integration tests prove session revocation, expiry, cookie flags, and CSRF/origin checks.
2. An admin without TOTP cannot reach any admin route or action.
3. Backup-code use is single-use and audited.
4. Password reset tokens are hashed, single-use, short-lived, and invalidated on password change.
5. Object-level authorization tests cover orders, eSIMs, tickets, invoices, and activation data.
6. Rate limits are exercised in staging.

## Revisit triggers

- Better Auth has a critical vulnerability or breaks on a framework upgrade.
- The owner requires SSO, SCIM, or hardware security keys.
- Support burden from TOTP recovery becomes material.
- A managed identity provider becomes cheaper than the operational risk.
