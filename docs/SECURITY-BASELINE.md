# Security baseline

**Status:** Design baseline plus a local demo implementation. **No deployment, external scan, penetration test, or independent security review has occurred.** The demo implements some controls; most production controls remain unmet.
**Date:** 2026-10-23
**Target:** OWASP ASVS Level 2 as a design target (version to be pinned during implementation), WCAG 2.2 AA for accessibility, and the payment processor’s PCI requirements. These are targets, not certifications.

> This document describes required controls. It is not evidence that they exist. Evidence belongs in `docs/LAUNCH-GATES.md` and dated test records.

## 0. Implemented locally vs not evidenced

Implemented in the local demo:

- Integer minor-unit money with safe-integer guards and captured order snapshots.
- AES-256-GCM envelope encryption for demo activation data; per-record DEK wrapped by a versioned KEK.
- Guest order access tokens stored as SHA-256 hashes with expiry and revocation field.
- Scrypt password hashing and hashed database session tokens.
- Admin TOTP gate and server-side `requireAdmin` checks at both the layout and page level, so a
  layout redirect cannot leave page data in a streamed RSC response.
- Signed mock payment webhooks with replay dedupe and amount/currency validation.
- Fulfillment retry/backoff and a delivered-job retry guard.
- Basic HTTP security headers in `next.config.ts`.
- Redaction of guest access tokens from stored mock email bodies.
- Demo-mode `noindex`, no third-party analytics, and no card-data collection.

Not implemented or not evidenced:

- Independent security review, penetration test, SAST/DAST, dependency-risk acceptance, or CSP
  with script/style hardening.
- Email verification, password reset, account recovery, backup codes, session revocation on
  password change, full RBAC, admin re-authentication, or four-eyes approvals.
- Managed-Postgres security, backups/restore, key custody/rotation drill, secret-manager
  integration, WAF/rate limiting at the edge, monitoring, or incident response.
- Real payment/supplier/email controls, PCI scope validation, refund/dispute handling, or
  production fraud controls.
- Browser accessibility audit (axe/manual) or load testing.
- Dependency-risk acceptance: `npm audit --omit=dev` is clean, but a full audit reports 5 high
  advisories in the dev-only ESLint toolchain. No remediation or CI scanning is configured.



## 1. What we are protecting

| Asset | Why it matters | Worst credible harm |
|---|---|---|
| eSIM activation data (LPA/QR) | Bearer credential that can install/transfer an eSIM | Theft of service, customer inability to connect, privacy harm |
| Customer personal data | Names, emails, order history, support content | Phishing, account takeover, regulatory exposure |
| Payment and refund state | Money movement and dispute evidence | Double charge, wrongful refund, chargeback loss |
| Supplier credentials and balance | Ability to provision and prepaid funds | Fraudulent orders, balance depletion, supplier account suspension |
| Admin accounts | Power to refund, price, and view customer data | Fraud, data exfiltration, reputational damage |
| Legal/consent records | Proof of terms, privacy, and marketing consent | Unenforceable contracts, regulatory penalties |
| Audit and financial records | Investigation and reconciliation | Inability to prove what happened |

## 2. Trust boundaries and actors

```text
Internet
  ├─ anonymous customer / crawler
  ├─ authenticated customer
  ├─ attacker (credential stuffing, card testing, scraping, webhook forgery)
  └─ payment/supplier/email providers (webhooks)
        |
        v
Netlify edge / Next.js runtime  ← trust boundary: authenticate + authorize every request
        |
        ├─ PostgreSQL (private network / TLS, least-privilege role)
        ├─ supplier API (server-to-server, secret)
        ├─ payment API (server-to-server, secret)
        └─ email API (server-to-server, secret)

Administrator
  └─ browser → admin routes (TOTP, RBAC, re-auth, audit)
```

**Rules**

- The browser is untrusted. Prices, roles, order ownership, and payment status are never accepted from client input.
- Webhooks are untrusted until signature/token verification and durable dedupe.
- Supplier responses are untrusted until schema validation and reconciliation.
- Support staff are trusted only within their role and only through audited tools.
- Third-party scripts are untrusted and minimized; no analytics receives activation data.

## 3. Control baseline

| Area | Required baseline | Phase | Evidence required |
|---|---|---|---|
| Authentication | Custom DB sessions + scrypt (interim demo); email verification still required; admin TOTP; secure cookies in production; rate limits | Implementation | Auth unit/integration tests; local admin 2FA smoke test |
| Authorization | Server-side RBAC + object ownership on every read/write | Implementation | Object-level authorization test matrix |
| Secrets | Netlify secret store only; no secrets in Git/client/logs; rotation runbook | Implementation | Secret scan; bundle scan; rotation drill |
| Activation data | AES-256-GCM envelope encryption; authorized display only; audit | Implementation | Crypto tests; DB inspection; access audit |
| Payments | Hosted checkout; signature verification; idempotency; no card data | Implementation | Test-mode checkout/refund/webhook evidence |
| Supplier | Signed/internal job auth; idempotent orders; reconciliation; no blind retry | Implementation | Contract tests; funded test evidence |
| Webhooks | Raw-body verification; unique event ID; 2xx after durable record | Implementation | Replay/duplicate/invalid-signature tests |
| Input/output | Zod validation; React escaping; sanitisation for rich text; upload controls | Implementation | Fuzz/validation tests; XSS review |
| Headers | CSP, HSTS, nosniff, frame deny, referrer/permissions policy | Implementation | Header scan on staging/production |
| Abuse | Rate limits, velocity checks, high-risk review, card-testing controls | Implementation | Rate-limit and fraud-rule tests |
| Logging | Structured, redacted, correlation IDs; no activation data/PII | Implementation | Log sample review; redaction tests |
| Backups | Encrypted, access-controlled, restore tested | Operations | Timed restore record |
| SDLC | Lockfile, pinned toolchain, dependency/secret scans, review | Implementation | CI results |
| Incident response | Runbooks, contacts, kill switches, breach assessment | Operations | Tabletop/drill record |

## 4. Identity and sessions

- The local demo uses custom database-backed sessions; session tokens are high-entropy and stored
  as hashes. Better Auth was proposed in ADR-0005 but is not installed. A production auth decision
  remains open (ADR-0012).
- Cookies: `Secure` when the public origin is HTTPS, `HttpOnly`, `SameSite=Lax`, host-only (no
  `Domain`), path scoped; `__Host-` prefix where feasible.
- Separate customer and admin session policies; admin sessions shorter and re-authenticated for sensitive actions.
- Mandatory TOTP for admins; backup codes hashed, single-use, shown once. No production admin seeded with a default password.
- Email verification before account features that expose orders or eSIMs.
- Password reset: hashed single-use token, short expiry, invalidated on password change, no account enumeration.
- Login/reset/2FA/guest-lookup rate limits and lockout/backoff; alert on credential-stuffing patterns.
- Session revocation on password change, role change, suspected compromise, and admin action.
- CSRF: framework protections plus Origin/Host checks on mutations; webhooks excluded from cookie auth and verified separately.
- No silent impersonation. Any break-glass access is explicit, time-bounded, and audited.

## 5. Authorization

- Every customer read/write checks ownership against the authenticated subject, not an ID from the URL alone.
- Every admin action checks a specific permission, not merely “is admin”.
- Four-eyes approval for refunds above threshold, bulk price changes, supplier credential changes, and role changes; self-approval rejected in a transaction.
- Guest order access requires order reference plus email verification (one-time code), not just an email address.
- Activation data access is a distinct permission and is audited.
- Tests must cover horizontal (another customer) and vertical (customer → admin) escalation for orders, eSIMs, tickets, invoices, and activation data.

## 6. Secrets and key management

- All secrets in Netlify’s environment/secret store; never in Git, `netlify.toml`, build output, client bundles, or screenshots.
- `.env*` ignored except `.env.example` with empty placeholders.
- Separate secrets per environment; no production secret in preview/staging.
- Least-privilege provider keys; restrict supplier/payment keys to required operations where supported.
- Rotation runbook for auth secret, activation KEK, internal job secret, cron secret, supplier keys, payment keys, email keys, and database credentials.
- Secret scanning in CI (e.g. Gitleaks) and a client-bundle check for accidental `NEXT_PUBLIC_*` secrets.
- If a secret is exposed: revoke/rotate first, then investigate; do not rely on deleting a commit.

## 7. Cryptography and activation data

- TLS 1.2+ in transit; HSTS after verification.
- Activation payloads: AES-256-GCM with per-record DEK wrapped by a versioned KEK (ADR-0008).
- Store ciphertext, IV, auth tag, and key version; never plaintext LPA.
- Keys are not stored in the database or client; KEKs live in the secret store.
- QR rendered server-side or locally after authorization; no third-party QR image service.
- No activation data in URLs, analytics, error messages, ordinary logs, or email bodies/images.
- Access audited with actor, session, order, time, request ID, and hashed IP.
- Key rotation and crypto-shredding procedures documented and drilled before launch.

## 8. Payments

- Hosted Checkout or tokenised components only; card numbers/CVV never touch our servers.
- Verify webhook signatures against the raw body before any state change.
- Unique provider event ID for replay protection; duplicate events are no-ops with 2xx.
- Payment state changes only from verified provider events/API results, never a browser redirect.
- Idempotency key per payment attempt and refund; unique provider payment/refund IDs.
- Refunds require authorization, idempotency, and four-eyes approval above threshold; customer is told “pending” until provider confirmation.
- Disputes tracked separately; evidence collection and deadlines assigned.
- PCI scope: confirm eligibility for the processor’s hosted-checkout SAQ with the processor and a qualified adviser. Do not claim SAQ A without confirmation.
- Fraud controls: provider rules/Radar, velocity limits, high-risk review, card-testing detection, chargeback monitoring.

## 9. Supplier and webhooks

- Supplier credentials server-side only; no supplier calls from the browser.
- Validate every supplier response with Zod; reject malformed LPA/ICCID rather than store it.
- Preserve supplier price scale explicitly; reject unexpected scales.
- Caller-generated `transactionId` plus local unique constraint; no blind retry after an uncertain create.
- `under_investigation` state and reconciliation by supplier transaction/order reference before retry.
- eSIM Access webhooks: random path token, optional IP allowlist, `notifyId` dedupe, schema validation, reconciliation. Document that the lack of a documented HMAC is a residual risk.
- Webhook handlers must be idempotent and safe under concurrent delivery.
- Internal job endpoints require a secret/HMAC and are not browser-reachable.

## 10. Input, output, and browser hardening

- Zod validation at every trust boundary (forms, route handlers, webhooks, supplier responses, env).
- Output encoding via React; sanitise any rich text/user content with an allowlist.
- Uploads: MIME + magic-byte allowlist, size cap, random keys, private storage, no execution, malware scan before customer-facing download. If scanning is unavailable, attachments stay disabled.
- CSP with nonces/hashes for scripts; no `unsafe-inline` in production unless documented and risk-accepted.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, frame ancestors `'none'`.
- HSTS only after HTTPS is verified; start short and increase.
- No stack traces or raw provider errors to customers; correlation ID only.
- Disable directory listings, source maps in production where feasible, and verbose framework banners.
- Dependency lockfile and pinned toolchain; review transitive dependencies.

## 11. Abuse, fraud, and rate limiting

- Rate limits by IP hash, account, email, and order for login, registration, reset, verification, 2FA, guest lookup, coupon redemption, activation access, and checkout.
- Velocity limits and a manual-review queue for high-value or suspicious orders.
- Disposable-email signals are a review input, not an automatic denial.
- Coupon limits enforced transactionally; no race-condition double redemption.
- Card-testing protection via provider rules and a block/alert path.
- Sanctions/restricted-destination screening before provisioning where legally required.
- Human appeal/support path; no permanent silent block without review.

## 12. Logging, monitoring, and privacy

- Structured JSON logs with request/correlation ID, route, status, duration, and redacted references.
- Never log passwords, session tokens, API keys, activation data, full card data, or unnecessary PII.
- Hash IPs/emails where used for rate limiting or analytics; use a dedicated HMAC key.
- Error tracking with PII scrubbing; review before enabling.
- Alerts: payment webhook failures, stuck jobs, supplier errors, low balance, auth anomalies, backup failures, certificate expiry, high error rate.
- Audit log append-only; access restricted; retention per policy and legal hold.
- Health endpoint reveals no secrets and is rate-limited/protected as appropriate.
- Privacy: data minimisation, purpose limitation, consent records, deletion/anonymisation workflow, processor agreements, and transfer review. Legal review required.

## 13. Data protection, retention, and backups

- Encryption in transit and at rest (provider-managed plus application-level activation encryption).
- Separate production/staging data; no production data in previews.
- Backups encrypted, access-controlled, and tested with a timed restore before launch.
- Retention is a draft pending legal/tax review (`docs/DATA-MODEL.md`); legal holds override deletion.
- Deletion requests anonymise identity while retaining legally required financial records; do not delete audit/legal-hold data blindly.
- Database roles least privilege; migrations use a separate role where possible.
- No ad-hoc production SQL without review and audit.

## 14. Secure development and supply chain

- Protected main branch, reviewed pull requests, required CI checks.
- CI: lint, typecheck, unit/integration tests, build, dependency audit/OSV, secret scan, license check.
- Pin Node and package manager versions; commit lockfile.
- No production deploy from an uncommitted working tree.
- Dependency updates reviewed; critical vulnerabilities patched or mitigated with a recorded decision.
- Test fixtures must not contain real personal data or live credentials.
- Security tests: object authorization, CSRF/origin, webhook forgery/replay, rate limits, CSP, upload abuse, secret leakage, dependency scan.
- Independent penetration test before launch (scope and provider not selected).

## 15. Infrastructure and Netlify-specific controls

- Netlify account 2FA; least-privilege team roles; revocable deploy tokens.
- Environment scoping so previews cannot access production secrets.
- Staging Basic Auth Edge Function + `noindex`; documented as weaker than SSO.
- Function secrets not exposed to the client; no secrets in build logs.
- Pooled database connections; no per-request migrations.
- WAF/rate limiting at the edge where available; application-level limits otherwise.
- Domain/TLS only after ownership verification; monitor certificate expiry.
- Netlify access logs retained per plan limits; export what is needed for incidents.

## 16. Incident response

1. **Detect** via alerts, provider notice, customer report, or staff observation.
2. **Contain** using kill switches (payments, supplier, email), session revocation, key rotation, and deploy rollback.
3. **Assess** scope, data involved, legal/contractual notification duties, and customer impact.
4. **Eradicate** the cause; patch, rotate, and verify.
5. **Recover** service with monitoring; reconcile orders/payments.
6. **Review** blameless post-incident report, update risks/tests, and record actions.

Contacts, escalation times, and regulatory notification duties are **not defined** and must be before launch. Do not promise a response time that is not staffed.

## 17. Vulnerability disclosure

- A `security.txt` and `security@` mailbox will be published **only after a monitored mailbox exists**.
- Do not invent a security contact, PGP key, bug bounty, or response SLA.
- A private disclosure channel and triage process are launch gates.

## 18. Verification and security gates

This baseline is not satisfied by writing it. Before launch:

- [ ] Threat model reviewed and updated.
- [ ] Auth/session/2FA tests pass.
- [ ] Object-level authorization matrix passes.
- [ ] Activation encryption/rotation/access-audit tests pass.
- [ ] Payment webhook/refund/replay tests pass.
- [ ] Supplier reconciliation and uncertain-outcome tests pass.
- [ ] Secret/dependency/bundle scans pass.
- [ ] Security headers/CSP verified.
- [ ] Rate-limit and abuse tests pass.
- [ ] Backup restore timed and documented.
- [ ] Incident tabletop and kill-switch drill completed.
- [ ] Independent penetration test completed; critical/high findings fixed or risk-accepted by the owner.
- [ ] Legal/privacy review of data flows completed.

## 19. Open items

- Legal entity, jurisdiction, data residency, and processor agreements.
- KMS vs application-level KEK custody and budget.
- File storage/malware scanning provider.
- Error tracking/uptime providers and PII scrubbing configuration.
- Penetration-test provider and scope.
- Security contact, disclosure policy, and incident contacts.
- PCI SAQ eligibility confirmation.
- Whether customer 2FA/passkeys are offered at launch.

## 20. Change log

| Date | Change |
|---|---|
| 2026-10-23 | Initial security baseline. No controls implemented or tested. |
