# ADR-0009: Domain and brand evidence gate before public identity

- **Status:** Proposed
- **Date:** 2026-10-23
- **Deciders:** Project owner (mandatory)
- **Related:** ADR-0010

## Context

The project is intended for `esimprove.com`, but public checks on 2026-10-23 returned NXDOMAIN and HTTP 404 from Verisign RDAP. The owner stated the domain is owned; the registrar account has not been verified. The brand is also undecided and uncleared.

Using an unverified domain would risk building on someone else's name, configuring email/DNS without authority, issuing certificates for a host we do not control, and publishing a brand that may infringe. Buying or transferring a domain requires money and explicit approval.

## Decision

- Treat `esimprove.com` as **unowned and unusable** for production until the owner provides registrar-level evidence and public DNS resolves to the intended Netlify site.
- Do not change nameservers, DNS records, MX, SPF, DKIM, DMARC, or registrar settings before that evidence.
- Do not configure production cookies, canonical URLs, webhooks, OAuth callbacks, or email senders on the unverified domain.
- Use a Netlify-provided staging hostname for any future staging deploy; mark it `noindex` and protect it.
- Keep `eSIMprove` as a working codename only. Do not present it as a registered trademark or approved brand.
- Require a formal trademark/company-name search and owner selection before public branding, paid marketing, or legal notices.
- If the domain is not owned, the owner must explicitly authorise a purchase (price and registrar) or choose a different domain. The agent will not buy it autonomously.

## Consequences

**Positive**

- Avoids building on an asset we do not control.
- Prevents email/DNS actions that could affect a third party.
- Keeps brand risk visible before expensive design or marketing.
- Staging can proceed without waiting for DNS, once hosting access exists.

**Negative / risks**

- Production-like testing of cookies, email, and webhooks is delayed.
- A staging hostname differs from production, so host-dependent bugs may appear late.
- The brand may change after design work, causing rework.
- Domain acquisition cost/timing is unknown.

**Neutral**

- The application should use a configurable canonical origin, not hardcode the domain in every module.
- `www` redirect and apex canonicalisation are designed but not configured.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| Assume ownership and configure DNS | Unauthorized and potentially harmful; evidence contradicts the claim. |
| Buy the domain immediately | Requires owner approval and payment; may already be owned elsewhere. |
| Launch on a Netlify subdomain | Acceptable for staging, not for a real brand, email, or long-term SEO. |
| Pick a new domain without clearance | Moves the problem; still needs ownership and brand checks. |

## Verification

1. Registrar account shows the domain with the owner's control, or a signed transfer confirmation exists.
2. Public DNS returns the expected Netlify records for apex and `www`.
3. TLS certificate is issued for the exact hostnames.
4. `www` 301s to apex; staging returns `noindex` and requires auth.
5. Brand clearance evidence is recorded before public use.
6. Owner signs the domain/brand section of `docs/OWNER-DECISIONS.md`.

## Revisit triggers

- Ownership is proven or the domain is purchased.
- The owner chooses a different domain or brand.
- A trademark conflict is found.
- Email deliverability requires a different sending domain.
