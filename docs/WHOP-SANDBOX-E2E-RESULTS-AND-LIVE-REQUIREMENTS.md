# Whop card checkout: sandbox end-to-end results and live activation requirements

Date: 2026-11-27. Environment: localhost + Whop **sandbox** (`sandbox-api.whop.com`) + a temporary Cloudflare tunnel.

- **Not done:** no deployment, commit or push. No live credential was used, and no live object (product, plan, checkout or webhook) was created.
- **No real money:** no real payment was made, and no real eSIM was bought for these tests.
- **Live checkout:** not activated.

## 1. Sandbox-only safety: how it was enforced

- **Separate variables.** Sandbox values live only in a new, git-ignored file, `.env.development.local`. It's loaded only by `next dev`, and ahead of `.env.local`. They use separate names: `WHOP_SANDBOX_API_KEY`, `WHOP_SANDBOX_COMPANY_ID`, `WHOP_SANDBOX_PRODUCT_ID`, `WHOP_SANDBOX_WEBHOOK_SECRET`.
- **One resolver.** A single function, `whopCredentials()` in `lib/config.ts`, uses the sandbox variables only when `WHOP_SANDBOX=true`. Live mode never reads them.
- **Preflight before every test.** 13 checks passed each time:
  - `WHOP_SANDBOX=true`, and the live-payment and live-supplier switches are off;
  - the API key, business, product and webhook secret all come from `WHOP_SANDBOX_*`;
  - none of them equals the live value in `.env.local`;
  - the key is accepted by `sandbox-api.whop.com`, and the product exists in the sandbox.
- **Runtime evidence.**
  - The server log showed `Environments: .env.development.local, .env.local`.
  - The payment page's security policy allowed `connect-src … https://sandbox-api.whop.com` only.
  - Our payment page showed the "SANDBOX: TEST PAYMENTS ONLY" badge.
- **Live configuration unchanged.** `.env.local` has the same SHA-256 before and after (`692ac71bcd2311d2…`). Every live value was checked individually as UNCHANGED: `WHOP_COMPANY_API_KEY`, `WHOP_ACCOUNT_ID`, `WHOP_PRODUCT_ID`, `WHOP_WEBHOOK_SECRET`, `APP_URL`, the live switches, and so on.

## 2. Test results

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | Real eSIM blocked while live supplier is off | **PASS** | Checkout for the real Türkiye plan showed "These eSIMs are temporarily unavailable… No payment can be started"; both payment options were disabled |
| 2 | Successful payment, card 4242 4242 4242 4242 | **PASS** | Order ES-261127-5E8D48: the webhook `payment.succeeded` (HTTP 200) → paid → fulfilment → **delivered**, with the QR code shown on the order page. Payment `pay_…` stored, $4.28 USD matched |
| 3 | Declined payment, 4000 0000 0000 0002 | **PASS** | Whop declined it in the form. Webhook `payment.failed` (200) → order **failed**, 0 eSIMs, no fulfilment. The page says "This store has not marked the order as paid" |
| 4 | 3-D Secure, 5385 3083 6013 5181 + `Checkout1!` | **PASS** | The Checkout.com 3DS simulator challenge appeared inside the embedded form. Order ES-261127-E21106: `payment.succeeded` → **delivered**, with the QR code shown |
| 5 | Refund (full refund of test 2) | **FAIL, safely** | Whop refund `rf_yghGpaAyeIUP1Lr` succeeded, and repeating the request with the same idempotency key did **not** refund twice. But Whop refunded **$4.71** against a **$4.28** order, and our rule "refund larger than order price → manual review" held it: the order stayed `paid`, the eSIM wasn't flagged, and an admin alert was raised. See the fix in section 3 |
| 6 | Duplicate webhook delivery | **PASS** | Whop replayed `payment.succeeded` with the **same** `webhook-id`, then with a **new** one; both returned `{"received":true,"duplicate":true}`. Each paid order has exactly 1 eSIM, and the database recorded 2 `payment.succeeded` (one per order), 1 `payment.failed` and 1 `refund.created` |
| 7 | Fulfilment safeguards | **PASS** | Test orders used only the mock supplier. No eSIM Access order came from these tests; the one eSIM Access transaction today is the crypto purchase you approved earlier (ES-261127-5F90D3). The QR code appears only after fulfilment is confirmed |
| 8 | Unsigned or forged webhook | **PASS** | An unsigned POST through the tunnel was rejected with 400 "Invalid signature" |
| 9 | Return page never fulfils | **PASS** | The orders were paid by the verified webhook (timeline shows `payment.succeeded`); Whop's `?status=success` redirect only displays status |

Whop's delivery log shows every event was delivered successfully: `payment.succeeded` ×2, `payment.failed` ×1, `refund.created` ×1.

## 3. Bugs found and fixed during the test

1. **Every checkout was rejected by Whop (400).** Whop requires `payment_method_configuration.disabled` whenever the setting is sent. **Fixed**, and confirmed against the sandbox.
2. **The embedded form was blocked by our own security policy.** The policy applies per page load, and the app reaches the payment page by in-app navigation, so the payment page kept checkout's stricter rules. **Fixed**: Whop's sources are now allowed on `/checkout` pages only. Re-tested: the form loads after in-app navigation.
3. **Whop's form offered its own "Pay with Crypto".** That breaks the separate-gates rule. **Fixed** with `disabled: ["crypto"]`; re-tested and the option is gone, while card stays available.
4. **Local database incident (my error).** My scripts opened the database while the dev server still held it, and it was damaged. It was restored from the backup taken at the start of this test, with all 9 orders, including your real crypto purchase. The damaged copies are kept in `.audit/backups/`. From now on, database scripts run only while the server is stopped.

**Not yet fixed (needs your OK): refund amount above the order price.** Whop refunds what the buyer was actually charged. That can exceed our USD order price because of Whop's currency conversion or buyer fees: the sandbox buyer saw ₫124,092 for a $4.28 order and was refunded $4.71. The proposed change:
- A succeeded refund that is **equal to or larger than** the order price is treated as a full refund: the order is marked refunded and the eSIM flagged, with a note.
- Currency mismatches and inexact amounts stay on manual review.

This changes one existing test assertion ("excess refund → review"), so I'll only do it with your approval, then repeat the refund test.

**Automated checks after the fixes:** type check clean, lint clean, **480/480 tests** in 48 files. Two new tests prove that sandbox mode uses only `WHOP_SANDBOX_*` and live mode never reads them.

## 4. Other observations

- **Buyer currency.** Whop shows the buyer their local currency; here that was dong, because the tester is in Vietnam. The payment webhook still reported USD $4.28, so payment matching works.
- **Wallets.** Apple Pay and PayPal scripts were blocked by our security policy, which is card-only. Card works. If you want wallets on the live site, their sources must be added.
- **Whop's sign-in prompt.** Whop's form offers sign-in with an emailed code; "Continue without signing in" works.
- **No pending events.** No `payment.pending` or `payment.requires_action` webhooks arrived during the 3-D Secure test, only `payment.succeeded`. The handlers for them are covered by automated tests.

## 5. Live activation requirements

### 5.1 Live API key (whop.com → Dashboard → Developer → API keys, live business `biz_cxE…`)
Create a **new** company API key named, for example, "ESIMPROVE checkout (live)". The existing live key is missing `developer:manage_webhook`, and its other permissions are unverified. After switching over, revoke the old key.

| Permission | Needed for | Mandatory? |
|---|---|---|
| `checkout_configuration:create` | Create the checkout for each order | **Yes** |
| `plan:create` | Create the hidden one-time plan priced at the order total | **Yes** |
| `plan:basic:read` | Read the plan back to check the price | **Yes** |
| `access_pass:basic:read` | Read the product | **Yes** |
| `payment:basic:read` | Read payments (support, checks) | **Yes** |
| `payment:manage` | "Refund via Whop" from admin | **Yes**, for refunds |
| `webhook_receive:payments` | Receive `payment.*` (delivery depends on it) | **Yes** |
| `webhook_receive:refunds` | Receive `refund.*` | **Yes** |
| `webhook_receive:disputes` | Receive `dispute.*` | **Yes** |
| `developer:manage_webhook` | Only if I create or replay the webhook through the API | Optional (not needed if you create the webhook in the dashboard) |
| `checkout_configuration:basic:read` | Listing checkouts | Optional |
| `access_pass:create` | Only if a new product must be created | Optional (not needed when reusing the product) |

These match exactly the set verified on the sandbox key.

### 5.2 Live Whop configuration
- **Business (company) ID:** `biz_cxE…`, the existing `WHOP_ACCOUNT_ID` in `.env.local`.
- **Product:** reuse `prod_Fsw55cZw0Qn4w` "ESIMPROVE eSIM Plans", but **set it to hidden**; it's currently visible. Each order creates its own hidden one-time plan, and a hidden product works, as shown by the hidden sandbox product. Keep crypto wording out of the product.
- **Webhook URL:** `https://<live domain>/api/webhooks/whop`. The domain must be the final one (`esimprove.com` once it's connected, otherwise `esimprove.netlify.app`).
- **Webhook API version:** `v1`, pinned to `2026-11-23-3`.
- **Webhook events:**
  - `payment.succeeded`, `payment.failed`, `payment.pending`, `payment.requires_action`, `payment.canceled`;
  - `refund.created`, `refund.updated`;
  - `dispute.created`, `dispute.updated`.
- **Webhook secret:** copy the `ws_…` signing secret it gives you into Netlify.

### 5.3 Netlify (production) environment variables
**Secrets you must provide:**
- `WHOP_API_KEY`: the new live key;
- `WHOP_WEBHOOK_SECRET`: the live `ws_…` secret;
- `INTERNAL_JOB_SECRET`: a random value, for the scheduled job runner;
- the eSIM Access credentials;
- `BNB_RPC_URL`: NodeReal, if crypto is enabled too.

| Variable | Value |
|---|---|
| `PAYMENT_PROVIDER` | `whop` |
| `WHOP_SANDBOX` | `false` |
| `WHOP_API_KEY` | live key (secret) |
| `WHOP_COMPANY_ID` | `biz_cxE…` |
| `WHOP_PRODUCT_ID` | `prod_Fsw55cZw0Qn4w` |
| `WHOP_WEBHOOK_SECRET` | live `ws_…` (secret) |
| `APP_URL` | `https://<live domain>` (public HTTPS; otherwise card checkout stays off) |
| `ADMIN_ALERT_EMAIL` | where "needs attention" alerts go |
| `INTERNAL_JOB_SECRET` | secret, plus a schedule calling `POST /api/jobs/run` about every minute |

**Must stay disabled until your final approval:**
- `PAYMENTS_LIVE_ENABLED=false`: card checkout can't take real payments while this is false.
- `SUPPLIER_LIVE_ENABLED=false`: no real eSIM orders.
- `EMAIL_LIVE_ENABLED=false`: optional channel.

**Never set in production:** any `WHOP_SANDBOX_*` variable.

### 5.4 Production readiness
- **One code path.** The same checkout code runs sandbox and live; only the environment differs. `WHOP_SANDBOX` selects the API host (`sandbox-api.whop.com` or `api.whop.com`) and the matching security-policy sources, and `whopCredentials()` picks the matching variable family. Production refuses sandbox mode, so the first live check has to be one small real payment.
- **Remaining blockers:**
  1. Your decision on the refund-amount fix (section 3), then a re-test.
  2. Deploying this work. Nothing is committed or deployed yet.
  3. The new live key with the permissions in 5.1.
  4. The live product set to hidden.
  5. The final domain.
  6. Confirming your Whop business is approved for live payments and payouts. I can't read that without a balance-read permission.
  7. The supplier: live ordering is still off, and the balance was about $49.70 earlier.
  8. Scheduling `/api/jobs/run`.
  9. Optional: decide whether to allow wallets (Apple Pay or PayPal).

### 5.5 Step-by-step checklist for real card payments
1. Approve and apply the refund fix, then re-run the sandbox refund test.
2. In whop.com, create the live key with the permissions in 5.1, set `prod_Fsw55cZw0Qn4w` to hidden, and confirm the business can take live payments.
3. Decide the live domain and connect it in Netlify.
4. Commit and deploy (only with your approval), with `PAYMENTS_LIVE_ENABLED=false` and `SUPPLIER_LIVE_ENABLED=false`.
5. Create the live webhook (section 5.2) and put its secret in Netlify.
6. Set the remaining Netlify variables (section 5.3), and schedule `/api/jobs/run`.
7. On final approval, set `SUPPLIER_LIVE_ENABLED=true` and `PAYMENTS_LIVE_ENABLED=true`.
8. Make one small real purchase with your own card, the cheapest plan, and confirm:
   - the webhook arrives and the order is marked paid;
   - the eSIM is issued and its QR code shows on the order page.
9. Refund it from admin with "Refund via Whop", and confirm the order shows refunded and the eSIM is flagged.
10. Revoke the old live key.

## 6. Left in place locally
- **`.env.development.local`:** sandbox-only and git-ignored. Its `APP_URL` points to the closed tunnel, so local card checkout needs a new tunnel URL, or the file can be removed.
- **Sandbox Whop objects:**
  - product `prod_Mm8y3i60CFTnv` (hidden);
  - webhook `hook_ZO935TLEnWRzn` (now **disabled**);
  - a few unused sandbox checkout configurations from the diagnostics.
- **Tunnel:** stopped. `cloudflared` remains in `C:\Users\hp\tools\cloudflared\`.
- **Demo plan:** archived again.
- **Local database:** 4 sandbox test orders added (2 delivered, 1 failed, 1 left unpaid).
- **Backups:** in `.audit/backups/`.
