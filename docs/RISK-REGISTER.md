# Risk register

**Status:** Phase 0 baseline. No control below has been implemented or tested unless explicitly stated.
**Date:** 2026-10-23
**Owner:** Project owner (business risks) and implementing engineer (technical controls). Named individuals are not yet assigned.
**Review cadence:** At every phase gate, after any security incident, and whenever a blocked dependency changes.

> This register is a planning artifact, not evidence of control effectiveness. Scores are qualitative judgements made without production data, legal advice, or live integrations. They must be re-scored once real evidence exists.

## 1. Scoring

| Score | Likelihood | Impact |
|---|---|---|
| 1 | Rare / not expected in the next 12 months | Negligible; no customer or financial effect |
| 2 | Unlikely | Minor; contained internal rework |
| 3 | Possible | Moderate; customer-visible failure, support cost, or limited refunds |
| 4 | Likely | Major; lost revenue, regulatory exposure, or prolonged outage |
| 5 | Almost certain / already true | Severe; insolvency, systemic data breach, or unlawful trading |

**Priority:** Critical = 20–25, High = 12–19, Medium = 6–11, Low = 1–5.
**Residual score** is the expected score *after* the listed controls exist and are verified. Until then, treat residual as aspirational.

## 2. Register

| ID | Risk | Category | L | I | Score | Mitigation / required controls | Residual | Status |
|---|---|---|---|---|---|---|---|---|
| R-01 | `esimprove.com` is not owned or controlled; launch, TLS, cookies, email, and webhooks cannot use it | Business / domain | 5 | 5 | 25 | Treat as unowned until registrar evidence and resolving DNS exist. No DNS changes. Fallback staging hostname only. Domain/brand gate (ADR-0009). | 2×4=8 after verified control | **Open — blocking** |
| R-02 | Chosen brand infringes an existing trademark or is unavailable in target markets | Legal / brand | 3 | 4 | 12 | Working codename only; formal trademark and company-name search before public use; owner selects name; counsel review. | 2×3=6 | **Open — blocking for launch** |
| R-03 | Payment processor declines or restricts eSIM resale after underwriting | Commercial / payments | 4 | 5 | 20 | Apply before building checkout; disclose business model accurately; keep provider-neutral adapter; no live money until written approval; alternate processor research. | 2×4=8 | **Open — blocking** |
| R-04 | Supplier has no free sandbox; testing consumes a deposit that may be lost or hard to recover | Financial / supplier | 4 | 3 | 12 | No deposit without written cap; use documented test path; reconcile balance; record every test cost; start with smallest viable top-up. | 2×2=4 | **Open — owner decision** |
| R-05 | eSIM Access webhooks are unsigned; forged or replayed events could corrupt order state | Security / supplier | 3 | 4 | 12 | Random unguessable webhook path, IP allowlist where stable, `notifyId` dedupe, event validation, reconcile every state change against supplier query API, never fulfill on webhook alone. Document residual risk. | 2×3=6 | **Open — design only** |
| R-06 | Uncertain supplier order outcome leads to duplicate eSIM purchase or double charge to our balance | Financial / operations | 3 | 5 | 15 | Caller `transactionId` idempotency, local unique constraint, no blind retry, `under_investigation` state, reconcile by transaction/order reference before retry, alerting. | 2×3=6 | **Open — must be proven in Phase 1** |
| R-07 | Supplier price scale, FX, rounding, or tax error produces incorrect charges | Financial / data | 3 | 5 | 15 | Integer minor units, explicit supplier scale, versioned FX snapshots, single money library, property/unit tests, server-side recalculation, price-change re-consent, reconciliation reports. | 1×4=4 | **Open — no code** |
| R-08 | Operating without verified legal entity, jurisdiction, tax, telecom, or consumer-law review | Legal / compliance | 5 | 5 | 25 | Keep launch blocked; no invented company details; professional review before trading; configurable policies marked draft; jurisdiction-specific withdrawal/refund handling. | 2×4=8 | **Open — blocking** |
| R-09 | Activation data (LPA/QR) exfiltrated through logs, URLs, email, analytics, or a third-party QR service | Security / privacy | 3 | 5 | 15 | Envelope encryption, no third-party QR rendering, authenticated access, tokenised delivery links, log redaction, access audit, CSP, secret scanning, penetration test before launch. | 2×3=6 | **Open — no code** |
| R-10 | Admin account takeover leads to refund fraud, price manipulation, or bulk data access | Security | 3 | 5 | 15 | Mandatory TOTP, short admin sessions, RBAC, four-eyes approvals, re-authentication for sensitive actions, rate limits, audit alerts, no production admin seed. | 2×3=6 | **Open — no code** |
| R-11 | Card testing, stolen cards, refund abuse, or chargebacks make the business unprofitable | Fraud / payments | 4 | 4 | 16 | Provider Radar/rules, velocity limits, high-risk review queue, refund evidence, 3DS where appropriate, chargeback monitoring, supplier cancellation rules. | 3×3=9 | **Open** |
| R-12 | Mock data, fixtures, demo payments, or disabled integrations are mistaken for production functionality | Integrity / trust | 3 | 4 | 12 | Environment-separated fixtures, production boot checks, feature flags default off, explicit “not connected” admin states, no fake QR/reviews/prices, launch-gate evidence review. | 1×3=3 | **Open — policy only** |
| R-13 | Netlify plan limits (function duration, credits, bandwidth, build minutes) cause outages or unexpected cost | Platform / cost | 3 | 3 | 9 | Measure usage in staging, budget alerts, background/scheduled function limits designed in, fallback static/edge caching, owner approval before paid tier. | 2×3=6 | **Open** |
| R-14 | Transactional email is spoofed, lands in spam, or leaks activation links | Email / security | 3 | 4 | 12 | Verified sending subdomain, SPF/DKIM/DMARC, link tokens not credentials, bounce/complaint handling, suppression list, no QR images in email. | 2×3=6 | **Open — no domain** |
| R-15 | Managed Postgres limits, regional outage, or untested backups cause data loss | Data / availability | 3 | 5 | 15 | Provider PITR, encrypted logical backups, restore drill with measured RPO/RTO, connection pooling, migration rollback plan, no production data in staging. | 2×4=8 | **Open** |
| R-16 | Secret leakage through Git, logs, build output, or client bundles | Security | 3 | 5 | 15 | Secret store only, `.env*` ignored, secret scanning in CI, client-bundle checks, least-privilege keys, rotation runbook, no secrets in error messages. | 1×4=4 | **Open** |
| R-17 | Accessibility, SEO, or performance failures exclude customers and violate the WCAG 2.2 AA target | Product / compliance | 4 | 3 | 12 | Accessible components, axe CI, manual keyboard/screen-reader tests, server-rendered content, Core Web Vitals budgets, no thin programmatic pages. | 2×2=4 | **Open — no UI** |
| R-18 | Sale or provisioning in sanctioned, restricted, or unsupported destinations | Legal / sanctions | 3 | 5 | 15 | Restricted-destination configuration, sanctions screening, supplier coverage checks, block before payment where required, legal review, audit trail. | 2×3=6 | **Open** |
| R-19 | Supplier prepaid balance runs out, blocking fulfillment for paid orders | Operations / supplier | 4 | 4 | 16 | Balance monitoring, reserve threshold, alert before depletion, block new live orders below reserve, daily reconciliation, documented top-up authority. | 2×3=6 | **Open** |
| R-20 | Supplier credits a cancellation to our balance while the customer expects a card refund | Financial / customer | 4 | 4 | 16 | Separate supplier-credit and customer-refund workflows; never describe a supplier credit as a card refund; refund only after provider confirmation; clear policy. | 2×3=6 | **Open** |
| R-21 | PGlite test behaviour diverges from managed Postgres, allowing production-only failures | Engineering | 3 | 3 | 9 | SQL portability rules, migration tests on real Postgres before release, integration suite in CI against a managed test branch, no PGlite in production. | 2×2=4 | **Open** |
| R-22 | Observability gaps leave failed payments or stuck provisioning undiscovered | Operations | 4 | 4 | 16 | Structured logs, error tracking, uptime checks, job backlog and stuck-order alerts, supplier health page, on-call routing owned by a named person. | 2×3=6 | **Open — no service** |
| R-23 | Staging is indexed or accessed publicly because free-plan password protection is unavailable | Security / SEO | 3 | 4 | 12 | Edge Function Basic Auth, `noindex` headers, robots disallow, non-guessable hostname, no production data, access review. Custom auth is weaker than SSO. | 2×2=4 | **Open — design only** |
| R-24 | Scope creep (multi-supplier, apps, loyalty, B2B) delays a safe launch | Delivery | 4 | 3 | 12 | MVP non-goals documented, phase gates, change control, owner approval for scope changes, single supplier for MVP. | 2×2=4 | **Open** |
| R-25 | Third-party licence or API terms prohibit our intended use or require attribution | Legal / supplier | 2 | 4 | 8 | Review supplier contract, payment terms, font/image/software licences; record evidence; no copied competitor content or assets. | 1×3=3 | **Open** |

## 3. Current critical and high risks

The following are both high-scoring and currently unmitigated. They are the reason Phase 1 and launch remain blocked:

1. **R-01 domain control** — cannot build a trustworthy production identity on an unverified domain.
2. **R-08 legal/tax/consumer framework** — cannot lawfully publish final policies, prices, or refund terms without it.
3. **R-03 payment approval** — cannot take money without an approved entity and business model.
4. **R-19/R-20 supplier balance and refund mechanics** — paid customers could be left without delivery or refund.
5. **R-09/R-10 activation and admin security** — the highest-harm technical failure modes.

## 4. Risk treatment rules

- **Avoid** where possible: do not launch a feature whose legality, supplier support, or payment path is unverified.
- **Reduce** with the controls above and record evidence in `docs/LAUNCH-GATES.md`.
- **Transfer** only through real contracts/insurance; none exists today.
- **Accept** only with a named owner, written rationale, expiry date, and compensating controls. No critical risk may be accepted for launch.
- A risk is not “closed” because a document says it is mitigated. Closure requires a dated test, screenshot/log, or signed approval referenced in the register.

## 5. Change log

| Date | Change | By |
|---|---|---|
| 2026-10-23 | Initial Phase 0 register created from discovery findings. All items open. | Phase 0 discovery |
