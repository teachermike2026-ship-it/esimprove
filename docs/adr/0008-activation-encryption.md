# ADR-0008: Envelope encryption for activation data

- **Status:** Envelope encryption implemented locally; key custody/rotation review pending
- **Date:** 2026-10-23
- **Deciders:** Project owner (pending)
- **Related:** ADR-0002, ADR-0005

## Context

An eSIM activation code (LPA string) and QR code are effectively bearer credentials. Anyone who obtains them may install or transfer the eSIM. They must be available to the paying customer and authorized support staff, but must not leak through logs, URLs, analytics, email images, error trackers, or database dumps.

A dedicated cloud KMS may be desirable but adds cost and operational complexity before revenue. The MVP needs a defensible application-level design with rotation.

## Decision

- Treat LPA/activation data as **secrets**, not ordinary personal data.
- Encrypt each activation payload with AES-256-GCM using a per-record data encryption key (DEK).
- Wrap each DEK with a versioned key encryption key (KEK) supplied through the hosting secret store; store only ciphertext, IV, auth tag, and `key_version` in Postgres.
- Never store a plaintext LPA in the database, logs, analytics, URLs, or email.
- Render QR codes server-side or locally in the browser after authorization; do not send activation data to a third-party QR image service.
- Delivery emails contain a short-lived, revocable, high-entropy link to an authenticated page, not the LPA or a QR image.
- Authorize every access against order ownership or an explicit support role; rate-limit and audit each access (actor, session, order, time, request ID, IP hash).
- Provide a key-rotation runbook: add a new KEK version, rewrap DEKs in a background job, verify, then retire the old key after a retention window.
- Support crypto-shredding for deletion where legally permitted, while retaining financial records.
- Use a dedicated KMS only if the owner approves the cost; the application interface should allow it later.

## Consequences

**Positive**

- A database dump alone does not expose activation codes.
- Key rotation is possible without re-encrypting every payload under a new master key directly.
- Access is auditable and revocable.
- No third-party QR service receives the secret.

**Negative / risks**

- Application-level key management is weaker than a dedicated HSM/KMS with audited custody.
- A compromised runtime environment with access to the KEK can decrypt records.
- Lost KEKs mean permanent loss of activation data; backup and custody procedures are critical.
- Rotation jobs add operational work and failure modes.
- Support staff can still exfiltrate data they are authorized to view; monitoring and least privilege are required.

**Neutral**

- Customer “show QR” is an authorization event, not a public link.
- Re-issuing a display link does not reissue the supplier eSIM.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| Plaintext in Postgres with disk encryption | Insufficient; backups, replicas, and queries expose it. |
| Hash only | A hash cannot be displayed to the customer. |
| Store supplier QR URL | Third-party dependency and URL may itself be a bearer secret; supplier may expire it. |
| Cloud KMS from day one | Better custody, but cost/approval unresolved; keep as a future upgrade. |
| Encrypt with a single app-wide key | Simpler, but rotation and blast radius are worse; per-record DEKs are preferred. |

## Verification

1. Unit tests prove encrypt/decrypt round-trip, tamper detection, and wrong-key failure.
2. A database inspection confirms no plaintext LPA in any column, log, or fixture.
3. Authorization tests prove another customer and an unauthenticated user cannot access activation data.
4. Access audit records are written for every view.
5. A staging key-rotation drill rewraps records and decrypts them with the new version.
6. A restore drill confirms encrypted data remains usable with the backed-up KEK.

## Revisit triggers

- A cloud KMS becomes affordable and approved.
- A security review finds the app-level design insufficient.
- Key rotation fails or takes longer than the documented window.
- Supplier changes activation payload format or adds its own encryption.
