# Launch gates

**Status:** Checklist only. **No gate is met.** A local demo application now exists, but there is no deployment, live integration, production test result, approval, or legal review.
**Date:** 2026-10-23
**Rule:** Live money and live supplier provisioning remain disabled until every required gate has dated evidence and the owner signs the authorisation below.

> A checked box in this document is not evidence. Evidence is a test report, provider approval, signed contract, screenshot/log with a date, or a written legal opinion. “It should work” does not pass a gate.

## 1. Gate rules

- **P0** gates block any live payment or live provisioning.
- **P1** gates block a public launch but may allow a capped, invite-only pilot.
- A gate can be waived only by the owner in writing, with a named risk, compensating control, and expiry. **No P0 gate may be waived for a public launch.**
- A gate that depends on a provider or lawyer cannot be self-certified by the implementing engineer.
- Re-check gates after any material change: new supplier, new processor, new jurisdiction, new hosting region, major dependency upgrade, or security incident.
- Test-mode success is not live approval. A fixture is not a supplier integration. A staging deploy is not a launch.

## 2. Domain, brand, and entity

| ID | Gate | Evidence required | Stage | Status |
|---|---|---|---|---|
| D-01 | Domain control is proven | Registrar account screenshot/statement showing owner control, or signed transfer confirmation; public DNS resolves | P0 | **NOT MET** |
| D-02 | Production DNS and TLS work | Apex and `www` resolve to the intended site; valid certificate; `www` 301 to apex; cookies host-only | P0 | **NOT MET** |
| D-03 | Brand is cleared for use | Owner selection plus trademark/company-name search by qualified counsel; no conflicting mark found in target markets | P0 | **NOT MET** |
| D-04 | Legal entity and tax registration are verified | Registered name, number, jurisdiction, address, VAT/tax ID; evidence from registry or counsel | P0 | **NOT MET** |
| D-05 | Monitored support/security/abuse mailboxes exist | Mailboxes tested with a real message; named owner and backup; published only then | P0 | **NOT MET** |
| D-06 | Canonical origin and environment config are correct | Production `NEXT_PUBLIC_SITE_URL`, auth URL, webhook URLs, and cookie host match the verified domain | P0 | **NOT MET** |

## 3. Legal, tax, and compliance

| ID | Gate | Evidence required | Stage | Status |
|---|---|---|---|---|
| L-01 | Terms, privacy, cookie, and refund policies are reviewed | Final versions approved by qualified counsel for the entity/jurisdiction; versioned and published | P0 | **NOT MET** |
| L-02 | Consumer withdrawal/digital-content rules are addressed | Written advice on cooling-off/withdrawal and any waiver; checkout consent wording approved | P0 | **NOT MET** |
| L-03 | Tax treatment is implemented | Registration status, tax rates, invoice content, and filing process confirmed by an accountant; calculation tested | P0 | **NOT MET** |
| L-04 | Sanctions/export and restricted destinations are handled | Screening/blocking policy, country list, supplier coverage check, and legal review | P0 | **NOT MET** |
| L-05 | Resale/white-label rights are confirmed in writing | Supplier contract or written approval covering resale, branding, pricing, refunds, and data use | P0 | **NOT MET** |
| L-06 | Data processing/transfer terms are in place | DPAs with hosting, database, payment, email, and supplier providers; transfer mechanism reviewed | P0 | **NOT MET** |
| L-07 | Telecom/regulatory classification is reviewed | Written advice that the reseller model does not require a licence in target markets, or the required registration | P0 | **NOT MET** |
| L-08 | Accessibility commitment is published | Accessibility statement with known limitations and contact route; not a claim of full conformance | P1 | **NOT MET** |
| L-09 | Marketing consent/unsubscribe is lawful | Consent records, unsubscribe path, and sender identification tested | P1 | **NOT MET** |

## 4. Supplier and fulfillment

| ID | Gate | Evidence required | Stage | Status |
|---|---|---|---|---|
| S-01 | Supplier account is approved and contracted | Account approval, contract/terms, resale rights, support/escalation path | P0 | **NOT MET** |
| S-02 | Supplier credentials are stored safely | Secret-store entry, least-privilege key, rotation owner, no Git/log exposure | P0 | **NOT MET** |
| S-03 | Catalogue and price scale are verified | Real catalogue export; provenance per field; price scale confirmed; margin rules approved | P0 | **NOT MET** |
| S-04 | A funded test order succeeds | Authorised capped deposit; test order returns valid LPA/ICCID; cost recorded; test customer labelled | P0 | **NOT MET** |
| S-05 | Status, usage, top-up, and cancellation work | Dated test evidence for each operation, including supplier-credit behaviour | P0 | **NOT MET** |
| S-06 | Webhook dedupe and reconciliation work | Duplicate/out-of-order webhook test; `notifyId` dedupe; reconciliation against query API | P0 | **NOT MET** |
| S-07 | Balance reserve and top-up authority are set | Documented reserve, alert threshold, who can top up, and cap | P0 | **NOT MET** |
| S-08 | Supplier outage/delay communication is ready | Templates and admin procedure for paid-but-delayed orders; no false “delivered” claim | P1 | **NOT MET** |
| S-09 | Real-device installation is verified | Test eSIM installs and connects on at least one iPhone and one Android device in an approved test path | P0 | **NOT MET** |

## 5. Payments, refunds, and finance

| ID | Gate | Evidence required | Stage | Status |
|---|---|---|---|---|
| P-01 | Processor approval is granted | Written approval for the legal entity, eSIM resale model, countries, and statement descriptor | P0 | **NOT MET** |
| P-02 | Checkout and idempotency work in test mode | One order/payment for duplicate submits; price-change re-consent; no card data on our servers | P0 | **NOT MET** |
| P-03 | Webhook signature and replay protection work | Invalid signature rejected; duplicate/out-of-order events do not regress state | P0 | **NOT MET** |
| P-04 | Refunds work end to end | Test refund succeeds; UI shows pending until provider confirmation; original currency respected | P0 | **NOT MET** |
| P-05 | Disputes/chargebacks have an owner and process | Evidence checklist, deadlines, processor portal access, and named responder | P0 | **NOT MET** |
| P-06 | PCI scope is confirmed | Processor/qualified adviser confirms hosted-checkout SAQ eligibility and our responsibilities | P0 | **NOT MET** |
| P-07 | Payouts, bank account, and tax reporting are ready | Verified payout account; reconciliation owner; invoice/tax process | P0 | **NOT MET** |
| P-08 | Refund approvals and thresholds are configured | Four-eyes rule, threshold, audit trail, and test evidence | P0 | **NOT MET** |
| P-09 | Financial reconciliation is tested | Order ↔ payment ↔ supplier transaction ↔ refund report matches for test data | P0 | **NOT MET** |

## 6. Security and privacy

| ID | Gate | Evidence required | Stage | Status |
|---|---|---|---|---|
| SEC-01 | Admin 2FA and RBAC are enforced | Admin without TOTP blocked; permission matrix tested; no default admin seed | P0 | **NOT MET** |
| SEC-02 | Object-level authorization is tested | Customer A cannot read B’s order/eSIM/ticket/invoice; customer cannot reach admin | P0 | **NOT MET** |
| SEC-03 | Activation encryption and rotation are tested | Crypto/tamper tests; no plaintext in DB/logs; rotation drill; access audit | P0 | **NOT MET** |
| SEC-04 | Secret scanning and bundle checks pass | CI secret scan clean; client bundle contains no server secrets | P0 | **NOT MET** |
| SEC-05 | Dependency/vulnerability scan passes | No unresolved critical/high findings, or documented owner acceptance | P0 | **NOT MET** |
| SEC-06 | Independent penetration test is complete | Report, retest, and closure of critical/high findings | P0 | **NOT MET** |
| SEC-07 | Security headers and CSP are verified | Header scan; CSP works without blocking checkout/admin; HSTS after HTTPS | P0 | **NOT MET** |
| SEC-08 | Rate limits and abuse controls are tested | Login/reset/2FA/guest/activation/checkout limits; card-testing controls | P0 | **NOT MET** |
| SEC-09 | Backup restore is timed | Encrypted backup restored to a clean environment; RPO/RTO recorded | P0 | **NOT MET** |
| SEC-10 | Incident response and kill switches are drilled | Tabletop, disable payments/supplier, session revocation, contact tree | P0 | **NOT MET** |
| SEC-11 | Vulnerability disclosure channel exists | Monitored `security@` and `security.txt`; triage owner; no invented SLA | P1 | **NOT MET** |
| SEC-12 | Logging redaction is verified | Sample logs contain no activation data, tokens, keys, or unnecessary PII | P0 | **NOT MET** |
| SEC-13 | Upload scanning is active if attachments are enabled | Malware scan, MIME/magic checks, private storage; otherwise attachments disabled | P0 if enabled | **NOT MET** |
| SEC-14 | Privacy requests/deletion workflow is tested | Access/delete/anonymise flow with legal-hold handling | P0 | **NOT MET** |

## 7. Reliability and operations

| ID | Gate | Evidence required | Stage | Status |
|---|---|---|---|---|
| O-01 | Staging deploy is verified | Build, SSR, Server Action, Route Handler, middleware, images, DB connectivity | P0 | **NOT MET** |
| O-02 | Background/scheduled functions are verified | >30s job completes; scheduled sweep enqueues work on a published deploy | P0 | **NOT MET** |
| O-03 | Monitoring and alerts are live | Error tracking, uptime, job backlog, stuck orders, low balance, webhook failures; test alert received | P0 | **NOT MET** |
| O-04 | Rollback is tested | Previous deploy restored; flags disabled; no data corruption | P0 | **NOT MET** |
| O-05 | Load/latency test is complete | Catalogue/search/checkout under realistic latency; no claim beyond measured capacity | P1 | **NOT MET** |
| O-06 | Runbooks exist | Deploy, rollback, restore, rotate keys, recover order, disable payments/supplier, resend delivery | P0 | **NOT MET** |
| O-07 | Support is staffed | Named owner/backup, hours, response target the team can meet, escalation path | P0 | **NOT MET** |
| O-08 | Incident/status communication is ready | Customer banner/templates; who publishes; no fake status page | P1 | **NOT MET** |
| O-09 | Migration and backup procedure is rehearsed | Expand/contract migration, snapshot before destructive change, restore verified | P0 | **NOT MET** |

## 8. Product, UX, accessibility, and SEO

| ID | Gate | Evidence required | Stage | Status |
|---|---|---|---|---|
| U-01 | End-to-end purchase works in test mode | Search → plan → cart → checkout → webhook → provisioning fixture → portal/email; no live money | P0 | **NOT MET** |
| U-02 | Failure paths are honest | Supplier timeout, malformed LPA, email failure, refund failure: customer sees accurate status and next step | P0 | **NOT MET** |
| U-03 | Accessibility audit is complete | axe clean for critical pages; manual keyboard/screen-reader test of checkout, QR, admin; WCAG 2.2 AA gaps recorded | P0 | **NOT MET** |
| U-04 | Mobile performance is measured | Representative p75 LCP/INP/CLS recorded; targets met or gaps accepted | P1 | **NOT MET** |
| U-05 | SEO/canonical/sitemap/robots are correct | Apex canonical, `www` 301, staging noindex, sitemap only published pages, no fake ratings | P0 | **NOT MET** |
| U-06 | No mock/demo content reaches production | Production build check; fixtures excluded; no fake reviews/prices/coverage/QR | P0 | **NOT MET** |
| U-07 | Email deliverability is verified | SPF/DKIM/DMARC pass; inbox test; bounce/complaint webhook; activation link only | P0 | **NOT MET** |
| U-08 | Legal pages are published and linked | Terms/privacy/cookies/refunds/contact live, versioned, and accepted at checkout | P0 | **NOT MET** |
| U-09 | Guest access and portal are secure | Token expiry/revocation; email verification; no LPA in URL; access audited | P0 | **NOT MET** |
| U-10 | Error/empty/loading states are usable | No dead ends; retry/support path; accessible announcements | P1 | **NOT MET** |

## 9. Launch authorisation

| ID | Gate | Evidence required | Stage | Status |
|---|---|---|---|---|
| G-01 | Every P0 gate is met | This document with linked evidence and dates | P0 | **NOT MET** |
| G-02 | Owner signs live authorisation | Written approval naming deploy/commit, scope, markets, caps, and date | P0 | **NOT MET** |
| G-03 | Pilot cap and rollback are defined | Max orders/day, max supplier spend, manual review rule, disable procedure | P0 for pilot | **NOT MET** |
| G-04 | Public launch comms are accurate | No unverified coverage/speed/review claims; support and legal details correct | P1 | **NOT MET** |
| G-05 | Post-launch monitoring window is staffed | Named person watching errors/orders/balance for an agreed period | P0 | **NOT MET** |

## 10. Evidence standard

Each gate record must include:

- Gate ID and requirement.
- Date/time (UTC) and environment (staging/production/test account).
- Who performed it and who reviewed it.
- Command, test name, or document reference.
- Actual result, including failures and screenshots/log excerpts where safe.
- Link to the commit/deploy tested.
- Residual risk and expiry, if any.

Do not attach secrets, full card data, activation codes, or unnecessary personal data as evidence. Redact.

## 11. Sign-off

| Role | Name | Decision | Date | Evidence / conditions |
|---|---|---|---|---|
| Owner (business) | | Approve / reject | | |
| Legal counsel | | Approve / reject | | |
| Tax adviser | | Approve / reject | | |
| Payment processor | | Approved / declined | | |
| Supplier | | Approved / declined | | |
| Security reviewer | | Pass / fail | | |
| Implementing engineer | | Ready / not ready | | |

**Current decision: NOT READY. Do not enable live payments or live supplier provisioning.**

## 12. Prohibited shortcuts

- Calling test mode “live” or a fixture “integrated”.
- Using a real customer card to test without approval.
- Skipping 2FA because “it is only staging”.
- Publishing policies copied from another company without review.
- Inventing reviews, ratings, coverage, speeds, certifications, or company details.
- Disabling a failing test to make a gate look green.
- Turning on live flags in the Netlify UI without a recorded change and sign-off.
- Launching on an unverified domain because DNS “will probably propagate”.

## 13. Change log

| Date | Change |
|---|---|
| 2026-10-23 | Initial gate checklist. All gates unmet; launch blocked. |
