# Netlify Deployment Blockers — Esimprove

**Status:** Evidence-based blocker register as of 2026-11-05. No Netlify deploy, production
database, domain, DNS change, or live provider operation has occurred.

Severity meanings:

- **Deploy preview** — prevents a functioning deploy preview.
- **Production** — prevents a safe public production deployment.
- **Live operation** — prevents real money, real eSIM fulfillment, or real email even after the
  site is deployed.
- **Verification** — prevents an honest claim that a check passed.

| ID | Severity | Blocker | Owner/action required |
| --- | --- | --- | --- |
| B-01 | Deploy preview / production | No Netlify site, deploy access, or environment configuration exists | Owner creates the site and sets context-scoped variables |
| B-02 | Deploy preview / production | No PostgreSQL provider or database credentials exist | Owner selects a provider, provisions preview and production databases, provides URLs |
| B-03 | Production | Domain/DNS/HTTPS origin not owned or configured | Owner acquires the domain, configures DNS in Netlify, sets `SITE_URL` |
| B-04 | Live operation / production commerce | No live payment provider exists; production checkout is intentionally disabled | Owner/provider approval, implementation, sandbox tests, and explicit launch authorization |
| B-05 | Live operation / production | No live email provider or verified sending domain; password-reset email is unavailable | Owner selects a provider, verifies domain/DNS, implements and tests the adapter |
| B-06 | Live operation | No live supplier integration; N-07 transport controls are not implemented | Owner/provider approval plus a reviewed outbound transport satisfying N-07 |
| B-07 | Live operation / production | Legal entity, terms, privacy, refunds, cookies, tax, and support contacts are not finalized | Owner/legal/tax review |
| B-08 | Verification | No browser E2E, responsive, console/hydration, or accessibility suite has been executed | Establish and run a browser suite; record evidence |
| B-09 | Production operations | No scheduler/queue is configured; `/api/jobs/run` requires an external caller | Provide a scheduler or queue and document retry/ownership |
| B-10 | Production operations | No production backup/restore rehearsal, monitoring, or alerting has been verified | Provider backup/PITR, restore test, monitoring owner |
| B-11 | Verification | No actual Netlify build/function/deploy has been run; local build is not deployment evidence | Owner performs the deploy preview and records results |
| B-12 | Deploy preview / production | No preview/production secrets or KEKs have been generated and stored | Owner generates unique values per context |
| B-13 | Production / verification | Google Search Console ownership, sitemap submission, and indexing are external actions and have not occurred | Owner verifies the property in GSC, submits `/sitemap.xml`, and records evidence |
| B-14 | Verification | First-party analytics has no production evidence; consent, DNT/GPC, internal exclusion, and report accuracy are proven only by local tests | Deploy with a production database, collect consented traffic, and reconcile reports against stored rows |
| B-15 | Production content operations | Blog media must be hosted on an external HTTPS origin; Netlify does not persist local filesystem uploads | Owner provides a media host/CDN and a documented upload process |

---

## B-01 — No Netlify site or deploy access

**Exact issue:** The repository contains configuration and documentation, but no Netlify site,
team, deploy, or environment variable exists. No deploy has been attempted.

**Why it blocks:** Netlify's OpenNext adapter, Node 22 runtime, function limits, proxy, and
environment scoping cannot be verified without a real deploy.

**What is needed:** The owner creates a Netlify site, imports the repository, sets the
context-scoped variables, and performs a deploy preview. This task does not connect to or modify
the owner's account.

**Owner provides:** Netlify account access and deploy authorization.

---

## B-02 — No PostgreSQL provider or credentials

**Exact issue:** No preview or production PostgreSQL database is provisioned. `DATABASE_URL`,
`DATABASE_MIGRATION_URL`, and `DATABASE_ENV` have no real values in any deployed context. No
migration has run against a remote database.

**Why it blocks:** Deployed contexts refuse PGlite. Without a database URL the app fails the
preflight and cannot serve data. Preview and production must be separate databases.

**What is needed:** Select a provider; create isolated preview/staging and production databases;
enable TLS, backups/PITR, and a connection limit suitable for serverless; provide pooled runtime
URLs and direct/session migration URLs. Do not share one database across contexts.

**Owner provides:** Provider account, database URLs, and backup policy.

---

## B-03 — Domain, DNS, and HTTPS are not configured

**Exact issue:** No custom domain is owned or connected. No DNS record or certificate exists.
`SITE_URL` remains the local default until the owner sets it.

**Why it blocks:** A production deploy without a verified HTTPS origin fails configuration
validation. A deploy preview can use a Netlify-provided HTTPS URL, but production cannot claim a
custom domain.

**What is needed:** Add the domain in Netlify, configure the shown DNS records at the owner's DNS
provider, wait for the managed certificate, set `SITE_URL` to the final `https://` origin, and
redeploy.

**Owner provides:** Domain ownership, DNS access, and approval. This task does not change DNS.

---

## B-04 — No live payment provider; production checkout disabled

**Exact issue:** The only payment adapter in the current build is the mock sandbox. Production
uses a fail-closed disabled provider, the mock webhook returns 404, and `/checkout` shows an
unavailable state. No processor approval, live credentials, or sandbox test account exists.

**Why it blocks:** A production site cannot take real orders. This is intentional: the code must
not present a fake successful payment as real.

**What is needed:** Select a processor, obtain approval and credentials, implement the live
adapter with signature verification and idempotency, test in the provider sandbox, complete
finance/refund/chargeback procedures, then authorize live payments. Do not enable
`PAYMENTS_LIVE_ENABLED` for this build; the adapter is not implemented.

**Owner provides:** Provider account, approval, credentials, sandbox evidence, and written launch
authorization.

---

## B-05 — No live email provider; password reset email unavailable

**Exact issue:** Outside production the app uses a local logging transport that explicitly says
no email was sent. In production it uses a disabled transport that throws. No verified sending
domain, DNS records, or provider credentials exist.

**Why it blocks:** Production password reset and order-delivery email cannot be delivered. The UI
now states that password reset email is unavailable rather than claiming delivery.

**What is needed:** Select a transactional email provider, verify the sending domain (SPF/DKIM/
DMARC), implement and test the adapter, add bounce/complaint handling, and obtain approval. Do not
enable `EMAIL_LIVE_ENABLED` for this build.

**Owner provides:** Provider account, domain DNS access, credentials, and delivery test evidence.

---

## B-06 — No live supplier integration; N-07 remains open

**Exact issue:** No live supplier adapter or outbound HTTP client is wired in. Production uses a
disabled supplier adapter so mock eSIMs cannot be recorded as delivered. N-07 was not closed in
Phase 2 and must not be closed with a fake transport.

**Why it blocks live operation:** Real eSIM provisioning and fulfillment cannot occur. N-07 is a
security blocker for any live supplier traffic until the actual outbound transport enforces:

1. DNS and destination validation immediately before connecting.
2. Resolved-address binding, or equivalent connection-time revalidation, to prevent DNS
   rebinding/SSRF.
3. Redirect restrictions (no redirects, or an explicit allowlist with revalidation).
4. Connection and response timeouts.
5. Response-size limits.
6. Safe error handling and logging that never exposes credentials, internal hosts, or metadata
   endpoints.

The transport must also respect Netlify's 60-second synchronous function limit and must not rely
on a persistent process or local filesystem. Do not test against internal services or cloud
metadata endpoints.

**What is needed:** Supplier commercial approval, credentials, a funded test account, a reviewed
transport meeting N-07, sandbox order/activation/refund tests, and explicit authorization. Keep
`SUPPLIER_LIVE_ENABLED=false` until then.

**Owner provides:** Supplier account/approval, credentials, and security review.

---

## B-07 — Legal, tax, entity, and policy content not finalized

**Exact issue:** Legal entity name, registration number, country, address, VAT ID, support/
security/abuse contacts, tax mode, and final policy review are placeholders. The legal pages are
demo copy, not reviewed terms for a live commerce service. The privacy and cookie policies do not
yet reflect first-party analytics collection, consent, retention, or the optional GA4 tag.

**Why it blocks production:** A public paid service needs accurate seller identity, terms,
privacy, refunds, cookies, tax treatment, and support routes. Analytics collection without a
reviewed lawful basis and consent flow creates a privacy/compliance risk. The code must not
invent these.

**What is needed:** Owner/legal/tax review and approved content, including the analytics data
inventory, consent mechanism, retention period, and opt-out behaviour. Do not invent a company or
rates.

**Owner provides:** Legal entity details and written approval.

---

## B-08 — Browser, responsive, and accessibility checks not executed

**Exact issue:** The available verification is typecheck, lint, unit/integration tests, the
production build, migration tests, and HTTP route smoke tests. No Playwright, Puppeteer, or
Cypress suite is installed. Browser console, hydration, 375/768/1280 responsive, keyboard, focus,
screen-reader, contrast, and dialog checks were not executed.

**Why it blocks verification:** A route returning HTTP 200 does not prove layout, hydration, or
accessibility correctness. The report must not claim those checks passed.

**What is needed:** Establish a browser suite (or perform a documented manual browser pass),
cover the listed viewports and interactions, record console/hydration errors, and record
accessibility evidence.

**Owner provides:** Approval/access for browser tooling or a manual test window.

---

## B-09 — No scheduler or queue for background work

**Exact issue:** `/api/jobs/run` is authenticated but nothing calls it automatically. No Netlify
scheduled function, external cron, queue, or worker is configured. Payment webhooks run
outbox/job processing inline. Phase 4 scheduled blog publication and analytics retention cleanup
also depend on this endpoint.

**Why it blocks production operations:** Abandoned jobs will not retry, scheduled articles will
not publish, and expired analytics rows will not be deleted without an external caller. Netlify
Functions are not a durable worker service and do not schedule this endpoint automatically.

**What is needed:** Configure a scheduler/queue with the internal job secret, define retry,
frequency, and ownership semantics, monitor failures, and document that Netlify does not run this
automatically. Keep request duration within the 60-second synchronous limit or move long work to
an approved queue/background service. Scheduled publishing must not be claimed until the scheduler
is live and observed.

**Owner provides:** Scheduler/queue infrastructure and operational ownership.

---

## B-10 — Production backup, restore, monitoring, and alerting not verified

**Exact issue:** No provider backup/PITR has been configured or restore-tested. No production
monitoring/alerting destination exists. `/api/health` provides status only; it is not a complete
observability system.

**Why it blocks production operations:** A failed migration or bad deploy needs a tested restore
path. Function errors and database exhaustion need alerts.

**What is needed:** Enable provider backups/PITR, rehearse a restore, configure uptime and error
alerts, define an on-call owner, and record evidence.

**Owner provides:** Provider features, monitoring account, and on-call ownership.

---

## B-11 — No actual Netlify deploy verification

**Exact issue:** The local build passes, but no Netlify build, OpenNext function, proxy, image,
font, header, environment-scope, or cold-start behavior has been observed on Netlify.

**Why it blocks production confidence:** Local `next build` success is not Netlify deployment
evidence. The OpenNext adapter and function runtime can behave differently.

**What is needed:** Perform a deploy preview, run the post-deploy smoke and manual checks, inspect
function logs and durations, and record the results. Only then can production deployment be
considered.

**Owner provides:** Deploy authorization and access.

---

## B-12 — No preview/production secrets generated

**Exact issue:** No deployed secret or KEK exists. Local `.env.local` values are demo-only and
must not be reused. Preview and production require distinct values.

**Why it blocks deployment:** The preflight requires `AUTH_SECRET`, `ACTIVATION_KEK_V1`,
`SUPPLIER_CREDENTIAL_KEK` (production), `INTERNAL_JOB_SECRET`, `RATE_LIMIT_HASH_SECRET`, and the
context-appropriate mock webhook secret.

**What is needed:** Generate random values per context, store them as Netlify secrets, keep
`DATABASE_MIGRATION_URL` and admin-bootstrap values out of the Functions runtime, and document
rotation/backup. Never commit them.

**Owner provides:** Secret generation/storage and rotation authority.

---

## B-13 — Google Search Console and indexing are external

**Exact issue:** The application can render a verification meta tag and a database-driven sitemap,
but no Google Search Console property has been verified, no sitemap has been submitted, and no
indexing has been observed. `SITE_URL` and the canonical base are not yet set to a real domain.

**Why it blocks verification:** Saving a token does not prove ownership. Publishing an article does
not guarantee indexing. Claiming either without external evidence would be false.

**What is needed:** Deploy to the final HTTPS origin, save the GSC verification token in
**Admin → SEO & CMS**, verify ownership in Google Search Console, submit `/sitemap.xml`, and record
the verification and indexing dates. Google's crawl and indexing decisions remain outside the
application's control.

**Owner provides:** Domain control, GSC account access, and verification authorization.

---

## B-14 — First-party analytics lacks production evidence

**Exact issue:** Automated tests prove payload validation, HMAC storage, consent/DNT/GPC handling,
internal exclusion, report queries, empty states, and retention cleanup against test databases. No
production deploy, production database, consenting visitor, or real traffic exists, so dashboard
accuracy and legal sufficiency are not demonstrated in production.

**Why it blocks verification:** A dashboard that renders locally is not evidence that production
collection, geography headers, consent, and retention work end to end. Analytics claims must be
based on observed rows, not fabricated demo numbers.

**What is needed:** Deploy with the production database and `ANALYTICS_HASH_SECRET`, confirm the
consent banner and opt-out behaviour in a browser, collect a small amount of consented real
traffic, compare dashboard totals with stored rows, confirm internal/admin traffic is excluded,
and verify that `/api/jobs/run` retention cleanup deletes old rows. Complete privacy/legal review
(B-07).

**Owner provides:** Production deployment, real traffic window, and privacy approval.

---

## B-15 — Blog media must be hosted externally

**Exact issue:** The blog CMS accepts HTTPS image URLs; it intentionally has no persistent local
upload storage. Netlify Functions have a read-only/ephemeral filesystem. No external media host or
CDN has been selected.

**Why it blocks content operations:** Authors cannot upload images through the CMS, and storing
files locally would be lost on redeploy. The current workflow requires an already-hosted URL.

**What is needed:** Choose an HTTPS media host/CDN (or object storage), define the upload and
naming workflow, confirm public caching and alt-text entry, and document it for editors. Do not
add local filesystem uploads that appear to work only on a developer machine.

**Owner provides:** Media host/CDN account and editorial workflow approval.

---

## Blocker status summary

- **Code/config blockers for a safe deploy preview:** none known after the Phase 4 changes.
  The preview cannot run until the owner provides B-01, B-02, B-12, and a preview `SITE_URL`.
- **Production deployment blockers:** B-01, B-02, B-03, B-07, B-10, B-11, B-12, B-13, B-15, plus
  the live-operation blockers B-04, B-05, B-06, and B-09.
- **Verification blockers:** B-08 (browser/accessibility), B-11 (actual Netlify deploy), and B-14
  (production analytics evidence).
- **N-07:** remains open for live supplier traffic. It is not closed by the disabled adapter.

**Final deployment decision:** see `ESIMPROVE_NETLIFY_DEPLOYMENT_READINESS_REPORT.md` and
`ESIMPROVE_PHASE4_SEO_BLOG_ANALYTICS_REPORT.md`.
