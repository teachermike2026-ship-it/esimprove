# ADR-0011: Provider-neutral transactional email, disabled by default

- **Status:** Interface and local logger implemented; live email disabled
- **Date:** 2026-10-23
- **Deciders:** Project owner (pending)
- **Related:** ADR-0006, ADR-0008

## Context

Customers need order confirmation, delivery notices, receipts, security alerts, and support replies. Email is also a phishing and data-leak surface: an activation link or QR code in an email can be forwarded, indexed, or intercepted. No sending domain, mailbox, or provider exists, and the domain is unverified.

Resend is a candidate because it documents a straightforward API and domain verification. No account or DNS record exists.

## Decision

- Define a small `EmailTransport` interface (send template, idempotency key, tags, reply-to).
- Implement Resend as the first adapter, disabled behind `EMAIL_LIVE_ENABLED=false` and `EMAIL_PROVIDER`.
- Require a verified sending subdomain (planned `mail.esimprove.com`) with SPF, DKIM, and a DMARC policy before any real send.
- Use provider webhooks for bounces, complaints, and suppressions; maintain an internal suppression list.
- Send activation **links**, never LPA strings or QR images. Links are short-lived, revocable, and require authentication or a high-entropy token.
- Template all user-facing email; no hardcoded HTML in business logic.
- Record email events and idempotency keys so retries do not duplicate messages.
- Do not send marketing email without consent and a working unsubscribe path.
- In development, use a local capture transport or a provider test mode; never send to real addresses without approval.

## Consequences

**Positive**

- Provider replacement does not touch order or notification logic.
- Domain authentication reduces spoofing and spam placement.
- Activation secrets do not travel in email bodies.
- Bounce/complaint handling protects sender reputation.

**Negative / risks**

- Email is not guaranteed delivery; the portal must remain the source of truth.
- Domain/DNS setup depends on ADR-0009.
- Provider webhooks add another integration to secure.
- A compromised email account or API key could send phishing; least privilege and rotation are required.
- Transactional email may still be marked promotional if content is careless.

**Neutral**

- No marketing automation in the MVP.
- Support replies may use the provider or a helpdesk later; the transport interface covers transactional mail only.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| SMTP from the app | Deliverability and IP reputation are hard; no mail server exists. |
| Postmark/SES | Viable alternatives; Resend is the proposed first adapter, not a final commitment. |
| Send activation QR as an email image | Leaks the credential and is often blocked by image proxies. |
| No email, portal only | Poor UX for guest buyers and receipts; email is still useful for non-secret notices. |

## Verification

1. Domain verification, SPF, DKIM, and DMARC are confirmed with real DNS lookups.
2. A test send reaches a controlled inbox and passes authentication checks.
3. Bounce/complaint webhooks update suppression state.
4. Duplicate job retries produce one email.
5. No email body, log, or analytics event contains an LPA or QR payload.
6. `EMAIL_LIVE_ENABLED=false` prevents real sends in development and staging.

## Revisit triggers

- The domain or provider changes.
- Deliverability or complaint rates are unacceptable.
- A helpdesk/CRM becomes the system of record for support email.
- Marketing email is added and requires consent/unsubscribe infrastructure.
