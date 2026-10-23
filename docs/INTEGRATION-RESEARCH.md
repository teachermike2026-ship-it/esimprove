# Integration research log

**Research date:** 2026-10-23 (UTC)
**Rule:** Only official documentation is treated as a source. No endpoint, field, webhook format, fee, or approval is inferred from memory. Anything not observed is marked “unverified”.

## 1. eSIM Access

**Official pages read:**
- API documentation: <https://docs.esimaccess.com/>
- Public product page: <https://esimaccess.com/>
- API documentation collection (Postman Documenter): <https://docs.esimaccess.com/api/collections/11154627/2s93mBxf3q?environment=11154627-1a6283c8-0422-49ea-adea-0919cf18c0cc&segregateAuth=true&versionTag=latest>
- Terms of service: <https://esimaccess.com/docs/terms-of-service/> (not accepted or reviewed as a contract)
- Status page: <https://esimaccess.statuspage.io/>

**Documented capabilities observed**
- Catalogue: `POST /api/v1/open/package/list`
- Order profiles: `POST /api/v1/open/esim/order`
- Query allocated profiles: `POST /api/v1/open/esim/query`
- Cancel profile: `POST /api/v1/open/esim/cancel`
- Suspend, unsuspend, revoke: `POST /api/v1/open/esim/{suspend|unsuspend|revoke}`
- Balance query: `POST /api/v1/open/balance/query`
- Top-up: `POST /api/v1/open/esim/topup`
- Create/update webhook: `POST /api/v1/open/webhook/save`
- Send SMS: `POST /api/v1/open/esim/sendSms`
- Usage query: `POST /api/v1/open/esim/usage/query`
- Supported regions: `POST /api/v1/open/location/list`
- Pricing/discount rules: `POST /api/v1/open/discountRule/list`

All documented API examples use the base `https://api.esimaccess.com`. No test/sandbox base URL was found in the public documentation reviewed. The docs instruct partners to create an account and **deposit funds for testing and refunding**. This is not a free sandbox.

**Authentication**
- `RT-AccessCode` header.
- The collection also documents optional HMAC-SHA256 request signing using `RT-Timestamp`, `RT-RequestID`, `RT-AccessCode`, `RT-Signature`, and a secret key.
- The signing formula in the docs: `HMAC-SHA256(timestamp + requestId + accessCode + requestBody, secretKey)`, lowercase hex.
- Neither a credential nor an account has been created or tested.

**Order idempotency**
- Order request contains a caller-generated `transactionId` (max 50 chars) and a `packageInfoList` with `packageCode`/slug and count.
- Documentation states: “Duplicate transactionId will be identified as the same request” and “If the request is retried, it needs to be contained; otherwise, a new transaction will be created.” This is the documented idempotency mechanism.
- Must be proven with a real supplier account. Until then, a timeout after an order call remains an uncertain outcome requiring reconciliation, not blind retry.

**Lifecycle and webhook facts**
- The order response returns `orderNo`; profiles are allocated asynchronously.
- Query by `orderNo` may return error `200010` while SM-DP+ is still allocating. The docs say to expect waits of up to 30 seconds.
- Webhooks include `notifyType`, `notifyId`, `eventGenerateTime`, and `content`.
- Event types documented: `ORDER_STATUS`, `ESIM_STATUS`, `SMDP_EVENT`, `DATA_USAGE`, `VALIDITY_USAGE`, `CHECK_HEALTH`.
- `ORDER_STATUS` (`GOT_RESOURCE`) signals allocation; the app must then query for the ICCID/LPA/QR.
- Deduplication is by `notifyId`. The documentation lists optional source-IP allowlisting.
- **No HMAC/webhook signature is documented.** The endpoint URL is therefore a bearer secret. The app must use a random webhook path, IP allowlisting where practical, dedupe, out-of-order handling, and supplier reconciliation. This is a documented security gap, not something to paper over.
- `DATA_USAGE` updates are delayed by roughly 2–3 hours. Do not label usage as real-time.
- `ESIM_STATUS` can include installation/activation-related SM-DP+ states. We may only show “activated” when the supplier state supports it; we must not infer it from payment.

**Money**
- Catalogue examples show prices as integers, e.g. `112500`, with `currencyCode: "USD"`. Balance documentation says the balance is expressed ×10000 (`100000 = $10.00`). The catalogue price scale must be confirmed with the supplier account before selling. The adapter must preserve the raw integer/scale and convert to our integer minor units deliberately. Never treat `112500` as cents.
- No tax treatment, invoice currency, refund mechanics, or wholesale contract terms were verified.

**Cancellation/refund limitations**
- Cancellation is documented only for inactive, unused profiles, before download/installation.
- The eSIM price is returned to the **supplier balance**, not to the customer’s card.
- Once data is used, cancellation is unavailable.
- Customer refunds must be handled through the payment processor and the published refund policy; supplier balance credits are not customer refunds.

**Phase 1 questions for the supplier**
1. Is there a true sandbox or only a funded production account?
2. What is the exact integer price scale and settlement currency?
3. Is there a test package and a documented test-deposit minimum?
4. Are reseller/white-label rights granted in writing? Any country restrictions?
5. Does cancellation restore supplier balance, and under exactly which states?
6. Is webhook signing available beyond IP allowlisting?
7. What SLA, rate limits, and maintenance windows apply?
8. What are the reinstall and deletion policies?
9. Is top-up supported for the plans we intend to sell?
10. What evidence/fields support a refund for failed provisioning?
11. How are supplier plan price changes and plan retirements communicated?
12. Which legal entity and contracting terms govern the reseller account?

**Status:** interface planning only. No account, no credentials, no API call, no order, no money.

---

## 2. eSIM Go (fallback candidate)

**Official pages read:**
- Developer docs: <https://docs.esim-go.com/>
- Quick start: <https://docs.esim-go.com/quick_start/>
- Account setup: <https://docs.esim-go.com/guides/setup_esimgo_account/>
- Going-live checklist: <https://docs.esim-go.com/guides/going_live/>
- API overview: <https://docs.esim-go.com/api/v2_5/>

**Observed facts**
- API base examples use `https://api.esim-go.com/v2.5`.
- Authentication: `X-API-Key`.
- Catalogue, validate-order (`type: "validate"`), transaction order, and QR ZIP download are documented.
- Orders support `type`, `quantity`, `item`, `assign`, and `iccid`.
- Webhooks: documentation requires HMAC signature verification for callback version V3 (`docs.esim-go.com/guides/webhooks`). This is stronger than eSIM Access's documented webhook controls.
- Usage/status, top-up, suspend/unsuspend, balance, rate limits, and IP allowlisting are documented.
- The account setup guide states the service is prepaid and that the **minimum top-up is $1,000**, with daily top-up limits. This is a material budget blocker.
- No free sandbox was identified in the docs reviewed. The quick start assumes a positive account balance.

**Status:** fallback only. A $1,000 minimum deposit cannot be approved under the “free/low tiers only” default. No account or credentials.

---

## 3. Airalo Partner API

- Attempted official documentation URL: <https://partners-docs.airalo.com/>
- On 2026-10-23 the hostname did not resolve from this environment; the fetch failed.
- No Airalo endpoints, fields, sandbox rules, or webhook formats were recorded or assumed.
- Do not integrate against Airalo until the official documentation is reachable and current terms, credentials, and approval are confirmed.

**Status:** unverified.

---

## 4. Stripe (proposed payment adapter)

**Official pages read:**
- Prohibited and restricted businesses: <https://stripe.com/legal/restricted-businesses> (page last updated 2026-09-22)
- Stripe legal index: <https://stripe.com/legal>
- Stripe API/webhook documentation index: <https://docs.stripe.com/>

**Observed facts**
- The restricted-business page lists “Travel reservation services and clubs”, “In-flight purchases”, and related travel categories as requiring additional due diligence.
- The page describes the list as representative, not exhaustive, and states that approval is specific to each service offer and can be modified or revoked.
- eSIM resale is not expressly identified in the reviewed sections; it may be assessed as telecom resale, digital goods, or another category. **No conclusion about acceptance is made.**
- High-risk jurisdictions and prohibited businesses remain prohibited.
- Stripe's public page is not an approval. The owner must apply and disclose the real business model, legal entity, and markets. Underwriting may refuse or restrict it.
- Technical integration will use hosted Checkout or approved tokenised components. Card data never touches our servers.
- Server-side payment confirmation must use signed webhooks or the provider API; redirects are not proof of payment.

**Status:** proposed, not approved, not connected. No keys.

---

## 5. Netlify

**Official pages read:**
- Next.js on Netlify: <https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/>
- Background Functions: <https://docs.netlify.com/build/functions/background-functions/>
- Scheduled Functions: <https://docs.netlify.com/build/functions/scheduled-functions/>
- External DNS configuration: <https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/>
- Password protection / project visibility: <https://docs.netlify.com/manage/security/secure-access-to-sites/password-protection/>

**Observed facts**
- Netlify documents full Next.js App Router support through the OpenNext adapter, including SSR, Server Actions, route handlers, middleware, ISR, and image optimisation.
- Do not pin the adapter version according to current guidance; let Netlify select it.
- Background Functions: up to 15 minutes; available on credit-based plans including Free; asynchronous invocation returns 202.
- Scheduled Functions: 30-second execution limit; run only for published deploys; cron runs in UTC.
- Credit-based Free/Personal plans do not include built-in password protection. A private project restricts visibility, but a shared-password staging site is not available on Free. We will implement a custom Edge Function Basic Auth gate plus `noindex` if the site must be publicly reachable on staging.
- External DNS apex options: ALIAS/ANAME to `apex-loadbalancer.netlify.com`, or fallback A record `75.2.60.5`. Subdomains use a CNAME to the site's Netlify hostname. Exact records should be copied from the Netlify domain-verification panel after site creation.
- TLS is managed by Netlify. HSTS should be enabled only after HTTPS is confirmed on all hostnames.
- Netlify account access and plan limits were not verified against the owner's account.

**Status:** platform selected provisionally. No site, no deploy, no DNS.

---

## 6. Better Auth

**Official pages read:**
- Introduction: <https://www.better-auth.com/docs/introduction>
- Drizzle adapter: <https://www.better-auth.com/docs/adapters/drizzle>
- Two-factor plugin: <https://www.better-auth.com/docs/plugins/2fa>

**Observed facts**
- Framework-agnostic TypeScript auth framework.
- Supports email/password, database sessions, Drizzle adapter, and a 2FA plugin with TOTP, OTP, backup codes, trusted devices, and account lockout.
- The 2FA plugin's default enforcement applies to credential sign-in. Our admin policy must therefore prevent admin accounts from using unmigrated passwordless paths, or add explicit hooks.
- No integration has been built or tested.

**Status:** proposed. Not installed. Security review required before production.

---

## 7. Resend

**Official pages read:**
- Introduction: <https://resend.com/docs/introduction>

**Observed facts**
- Requires a verified sending domain and an API key.
- Supports transactional email and marketing broadcasts/webhooks.
- No domain has been verified, no API key exists, and no email has been sent.
- SPF, DKIM, and DMARC records will be taken from the provider's verification panel after the domain is under owner control. They are not invented here.

**Status:** proposed only.

---

## 8. Domain registration and DNS

**Checks performed 2026-10-23**
- Public DNS (Google resolver 8.8.8.8): NXDOMAIN for `esimprove.com`.
- Verisign RDAP: HTTP 404.
- rdap.org: HTTP 404.
- No NS/A/AAAA/MX/TXT records returned.

**Interpretation:** the domain is not verified as owned. It may be unregistered, expired, or not yet propagated. Only the registrar account can prove control.

**No changes made:** no registration, purchase, renewal, nameserver change, DNS record, TLS certificate, or mailbox.

**Planned records after ownership and Netlify site exist** (to be confirmed against the Netlify panel, not guessed):
- Apex `esimprove.com`: ALIAS/ANAME to `apex-loadbalancer.netlify.com` if the registrar supports it; otherwise A `75.2.60.5`.
- `www`: CNAME to the Netlify site hostname.
- `staging`: CNAME to the staging Netlify site hostname.
- Email: provider-issued SPF/DKIM records on `mail.esimprove.com`; DMARC TXT at `_dmarc.esimprove.com` starting at `p=none` after a working mailbox exists.
- Security contact: `security@esimprove.com` only after a monitored mailbox exists; `/.well-known/security.txt` must not invent a contact.

Do not copy these records blindly. Netlify's High-Performance Edge and custom domains can use different targets shown in the domain panel.

---

## 9. Credentials and secret handling

Required production secrets (all empty/disabled today):

| Integration | Environment variables | Where it belongs |
|---|---|---|
| Database | `DATABASE_URL` | Netlify environment secret |
| Auth | `BETTER_AUTH_SECRET` (or equivalent) | Netlify environment secret |
| Activation encryption | `ACTIVATION_KEK_V1` (32-byte base64) | Netlify environment secret; versioned |
| Job authentication | `INTERNAL_JOB_SECRET` | Netlify environment secret |
| Cron authentication | `CRON_SECRET` | Netlify environment secret |
| eSIM Access | `ESIM_ACCESS_CODE`, optional `ESIM_ACCESS_SECRET` | Netlify environment secret |
| eSIM Go | `ESIM_GO_API_KEY`, `ESIM_GO_WEBHOOK_SECRET` | Netlify environment secret |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Netlify environment secret |
| Email | `RESEND_API_KEY` | Netlify environment secret |
| Monitoring | `SENTRY_DSN` | Netlify environment secret or public DSN separately |
| Staging Basic Auth | `STAGING_BASIC_AUTH_USER`, `STAGING_BASIC_AUTH_PASSWORD_HASH` | Netlify environment secret |

No secret values are stored in this repository. `.env.example` contains names and comments only.

---

## 10. Items that must never be called “connected” until tested

- Supplier catalogue sync
- Supplier order creation
- LPA/QR retrieval
- Webhook receipt and deduplication
- Payment confirmation
- Refund execution
- Transactional email delivery
- Domain/TLS
- Database backups
- Uptime/error monitoring
- Admin 2FA

Each requires real evidence and a dated test result.
