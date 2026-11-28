# Crypto Payments — Binance-Peg USDT (BEP-20)

Status: implemented locally, uncommitted, and **not verified against a real
blockchain transaction**. No production database writes, deployment, DNS
change, commit, or push was performed. The local `.env.local` does not contain
the crypto secrets, so the local checkout currently shows the crypto method as
disabled.

This document is the operational reference for the crypto payment option. It
describes what the code does, what must be configured before it can accept
money, and which limits still require an owner decision.

---

## 1. Scope

The checkout offers two methods in this order:

1. **Credit / Debit Card** — first and selected by default. The existing card
   provider flow is unchanged.
2. **Pay with Crypto** — second. Accepts only **Binance-Peg USDT (BEP-20)** on
   **BNB Smart Chain** (chain ID `56`).

Crypto is an additional method. It does not replace the existing global
checkout gate. In production, the storefront checkout must already be enabled
by the existing card/provider configuration; configuring crypto alone does not
make a disabled production checkout live.

The implementation never presents a mock or simulated crypto confirmation as a
real payment. A crypto order is marked paid only after independent server-side
verification on BNB Smart Chain.

---

## 2. Non-negotiable safety rules

- The receiving wallet, token contract, chain ID, and NodeReal RPC URL are
  **server-only** environment values. There are no `NEXT_PUBLIC_` crypto
  variables.
- No private key, seed phrase, or wallet signing credential is stored or used.
  The application only receives public transfers.
- Log discovery is **discovery only**. It may suggest candidate transaction
  hashes, but it can never confirm a payment.
- A payment is accepted only after the independent BNB Smart Chain RPC verifies
  the transaction, receipt, token contract, recipient, exact raw amount, block
  timestamp, and confirmation count.
- No order is marked paid and no fulfillment starts before the required
  **15 confirmations**.
- Amounts are integer base units (`BigInt`, `NUMERIC(78,0)`). No JavaScript
  floating-point arithmetic is used for money.
- Each pending order gets a globally unique exact amount. The database unique
  index on `crypto_payments.amount_raw` is the collision-safe reservation.
- A transaction hash can belong to at most one crypto payment. Duplicate hashes
  and ambiguous matching transfers go to manual review instead of fulfillment.
- Late transfers are preserved, never silently discarded, and never trigger
  automatic fulfillment.
- Confirmation reuses the existing `orders`, `payments`, outbox, fulfillment,
  eSIM supplier, and email systems exactly once. There is no parallel
  fulfillment or mock delivery path.

---

## 3. Customer flow

1. The customer reviews the cart at `/checkout`.
2. Card is selected by default. Crypto is the second radio card.
3. If crypto is not fully configured, the crypto radio is disabled and a note
   explains that crypto is unavailable. Card checkout remains usable.
4. On crypto submit, the server re-validates the cart, session/ownership,
   currency, and pricing, creates an order plus real `payments` and
   `crypto_payments` rows, and reserves a unique exact amount for 30 minutes.
5. The browser is redirected to
   `/checkout/crypto/{paymentId}?token={orderAccessToken}`.
6. The payment page shows the exact amount, reference, network, chain ID, asset,
   wallet, token contract, expiry countdown, and a real QR code containing the
   wallet address only.
7. The page polls `POST /api/orders/{orderId}/verify` every 15 seconds while the
   payment is pending, confirming, expired, or in a verification error. The
   customer can press **Check now** or paste a transaction hash manually.
8. When the server reaches 15 confirmations, the crypto payment becomes `paid`,
   the order becomes paid, an outbox event is written, and the existing
   fulfillment pipeline is invoked.
9. The page redirects to the normal success page on the next render or after a
   successful check.

The QR code intentionally contains only the receiving address. It does **not**
fill in the amount automatically. The customer must enter the exact amount
shown.

---

## 4. Required configuration

Set these only in `.env.local` or the hosting secret store. Never commit them
and never create public/browser equivalents.

| Variable | Required value | Purpose |
|---|---|---|
| `PAYMENT_WALLET` | `0xBF93e7123FfEf0973d469F6Ce39D201dC2e5Aa5E` | Public receiving wallet. The validator rejects any other address. |
| `BNB_RPC_URL` | NodeReal MegaNode **BSC Mainnet** HTTPS endpoint from https://dashboard.nodereal.io/api-key (`https://bsc-mainnet.nodereal.io/v1/<API_KEY>`) | Discovery of incoming USDT `Transfer` logs **and** authoritative transaction/confirmation verification. Contains the API key: server-only secret. |
| `PAYMENT_TOKEN_CONTRACT` | `0x55d398326f99059fF775485246999027B3197955` | Binance-Peg BSC-USD token contract. Any other contract is rejected. |
| `PAYMENT_CHAIN_ID` | `56` | BNB Smart Chain. Any other chain is rejected. |

Checksum casing of the wallet is accepted; the configured address must match
the documented wallet case-insensitively.

Do not set `PAYMENT_PROVIDER` to a crypto value. `PAYMENT_PROVIDER` continues to
select the card provider (`mock` or `whop`). Crypto is selected per checkout
request through the `paymentMethod: "crypto"` field.

### Internal constants

These are fixed in `lib/payments/crypto/config.ts`:

| Constant | Value |
|---|---|
| Network | BNB Smart Chain |
| Standard | BEP-20 |
| Chain ID | 56 |
| Token decimals | 18 |
| Asset label | Binance-Peg USDT (BEP-20) |
| Asset symbol | USDT |
| Confirmations required | 15 |
| Payment window | 30 minutes |
| Browser polling interval | 15 seconds |
| Late-payment auto-scan window | 24 hours after expiry |
| Chain provider | NodeReal MegaNode (standard JSON-RPC; no explorer API key) |
| BscScan transaction URL | `https://bscscan.com/tx/` |

### Fail-closed behavior

`loadCryptoPaymentConfig()` returns `null` unless every required value is
present and valid. When it returns `null`:

- the checkout shows crypto as unavailable and disables its radio input;
- `createCheckout` rejects a crypto request with a user-facing configuration
  error;
- the payment page returns 404;
- `POST /api/orders/:id/verify` returns `503 verification_unavailable`;
- `POST /api/jobs/run` skips the crypto monitor but still runs card fulfillment,
  outbox, scheduled articles, retention, and rate-limit cleanup.

A partial configuration therefore cannot silently accept funds.

---

## 5. Enabling and operating it

### 5.1 Local setup

Add the five variables to `.env.local`, then restart the dev server. The
checkout should show the crypto method enabled. Do not use real production
credentials in a local file that may be shared.

### 5.2 Database migration

Local PGlite runs migrations automatically. A deployed PostgreSQL database must
apply them explicitly:

```bash
npm run db:migrate
```

Migrations added for crypto:

- `db/migrations/0010_crypto_payments.sql` — creates `crypto_payments` and its
  indexes.
- `db/migrations/0011_crypto_payment_order_unique.sql` — replaces the
  non-unique order index with a unique one so an order cannot have two payable
  crypto requests under a double-submit race.

Existing orders, payments, eSIMs, and users are not modified or backfilled.

### 5.3 Schedule the server-side worker

Browser polling is not a substitute for the server worker. The worker must run
even when no customer has the page open.

Schedule an authenticated `POST` to:

```text
https://<your-site>/api/jobs/run
```

with either header:

```text
x-internal-job-secret: <INTERNAL_JOB_SECRET>
```

or:

```text
Authorization: Bearer <INTERNAL_JOB_SECRET>
```

Example:

```bash
curl -fsS -X POST "https://<your-site>/api/jobs/run" \
  -H "x-internal-job-secret: $INTERNAL_JOB_SECRET"
```

Run it at least once per minute. If the scheduler supports 15-second
intervals, use 15 seconds to match the browser polling interval. The handler is
also responsible for outbox delivery and fulfillment jobs, so do not create a
crypto-only cron that skips `/api/jobs/run`.

Each call processes up to 25 crypto payments. If the store can have more than
25 active crypto payments at once, run the job more frequently or increase the
limit in `monitorCryptoPayments`.

**On Netlify this is already wired:** `netlify/functions/crypto-payment-monitor.ts`
is a Scheduled Function (`schedule: "*/15 * * * *"`; the open payment page verifies every few seconds itself) that POSTs to
`/api/jobs/run` with `INTERNAL_JOB_SECRET`. It runs only on published
production deploys; locally, call the endpoint manually with curl.

`INTERNAL_JOB_SECRET` must be set in every deployed environment. The route
fails closed in production when it is missing.

### 5.4 Pre-launch smoke test

After owner approval and with a real, small transfer:

1. Place a crypto order and confirm the displayed amount is exact.
2. Send the exact amount from a wallet on BNB Smart Chain.
3. Confirm the panel reports `confirming` before 15 confirmations.
4. Confirm it does **not** report `paid` or deliver an eSIM before 15
   confirmations.
5. Confirm it reports `paid` at 15 confirmations and that exactly one eSIM and
   one email event are produced.
6. Confirm a second check does not duplicate fulfillment.
7. Confirm the BscScan link opens the same transaction hash.

### 5.5 Existing launch gates still apply

Crypto does not bypass the repository's existing production safety rules,
payment-provider gate, supplier gate, email gate, or owner approval process.
Read `docs/LAUNCH-GATES.md` and the current deployment documentation before
enabling live money.

---

## 6. Amount model

### 6.1 USD-only peg

Crypto checkout supports **USD-priced orders only**, at a 1:1 BSC-USD peg. A
non-USD order is rejected rather than converted with an invented exchange rate.

`baseAmountRaw` converts USD cents to 18-decimal base units:

```text
28.58 USD = 2,858 cents -> 28.58 * 10^18 = 28,580,000,000,000,000,000 raw
```

No floating-point value is used at any point.

### 6.2 Unique exact amount

A cryptographically secure random suffix from **1 to 9999** is added in the
fourth decimal place:

```text
amount_raw = base_raw + suffix * 10^14
amount_usdt = exact decimal string, e.g. 28.5801
```

The suffix makes the payable amount unique and is the reconciliation
identifier. The original order price is stored separately in
`original_amount_minor` / `original_currency`; it is not overwritten.

Important commercial consequence: the suffix can add up to **0.9999 USDT** to
the cart total. The customer always sees the exact amount before paying, and
the suffix is not a fee, but the owner must confirm that this reconciliation
policy is acceptable and reflect it in support/refund procedures. The customer
must not round the amount.

### 6.3 Collision safety and capacity

- `crypto_payments.amount_raw` has a unique index.
- Creation retries up to 16 times with a new secure suffix on a unique
  violation.
- If a concurrent request already created a payment for the same order, the
  service returns that existing payment instead of creating a second amount.
- The unique reservation applies to all statuses and is retained after expiry.
  For one exact base total, at most 9,999 distinct crypto orders can be
  reserved over the lifetime of the table. Monitor this ceiling and plan a new
  suffix strategy before a high-volume total approaches it.

### 6.4 Reference and expiry

- Reference format: `ESIM-` plus 8 uppercase hexadecimal characters, e.g.
  `ESIM-7F3A9C21`. It has a unique index.
- Payment window: 30 minutes from creation.
- Expiry is computed from the same instant stored as `created_at`, so the
  window is exactly 30 minutes rather than a few milliseconds short.
- Expired amounts remain reserved. A late transfer is still detected by the
  worker for up to 24 hours after expiry.

---

## 7. Verification model

### 7.1 Discovery (NodeReal BSC RPC logs)

`lib/payments/crypto/rpc-log-provider.ts` discovers candidates with standard
JSON-RPC calls against `BNB_RPC_URL` (NodeReal MegaNode):

```text
eth_getLogs {
  address:   <PAYMENT_TOKEN_CONTRACT>,
  topics:    [Transfer(address,address,uint256), null, <PAYMENT_WALLET as topic>],
  fromBlock: <start>, toBlock: <latest>
}
```

- **Start block:** the first scan estimates the block at the payment/order
  creation time minus two minutes and corrects the estimate against real block
  timestamps. Later scans resume from a per-payment cursor
  (`metadata.scanCursorBlock`) minus a 200-block reorg margin, so the worker
  does not rescan the whole window every minute and NodeReal free-plan quota is
  preserved.
- **Block window:** starts at 5,000 blocks and halves automatically if the RPC
  refuses the range (free plans limit `eth_getLogs` ranges). A scan is capped at
  200 `eth_getLogs` calls; if the cap is reached with no candidate, the result
  is a verification error, never a false "not paid".
- **Errors:** HTTP 429 / quota messages, network failure, invalid JSON and RPC
  errors are classified and never treated as an empty wallet. Provider error
  text is not echoed, because the endpoint URL contains the API key.

Only logs matching all of the following become candidates:

- emitted by the configured Binance-Peg USDT contract (fake tokens are ignored);
- recipient equals the configured wallet;
- raw value equals the reserved exact amount.

`lib/payments/crypto/explorer-provider.ts` still contains an optional Etherscan
V2 adapter behind the same interface, but it is not used by default and no
`EXPLORER_API_KEY` is required.

### 7.2 Independent RPC verification

For each candidate, the server checks the following against `BNB_RPC_URL`:

1. `eth_chainId` equals 56.
2. `eth_getTransactionByHash` returns a transaction with the same hash.
3. `eth_getTransactionReceipt` exists.
4. Receipt status is `0x1` (successful).
5. Exactly one log matches all of:
   - log contract address equals the configured token contract;
   - topic 0 equals the ERC-20/BEP-20 `Transfer` event topic;
   - topic 2 (recipient) equals the configured wallet;
   - data (raw value) equals the reserved exact amount.
6. The block timestamp is available.
7. `eth_blockNumber` gives the latest block; confirmations are
   `latest - receipt.blockNumber + 1`.

Outcomes:

- **verified** — at least 15 confirmations;
- **confirming** — a valid transfer with fewer than 15 confirmations;
- **rejected** — wrong network, missing transaction, pending receipt, failed
  receipt, no matching transfer, or more than one matching transfer.

The RPC call has a 12-second timeout. RPC failures produce
`verification_error` and never promote, expire, or fulfill a payment.

### 7.3 Transaction-hash fallback

The customer may paste a `0x` + 64-hex transaction hash. That path verifies the
hash directly through the BNB RPC and **does not require the explorer**. An
explorer outage therefore does not block a customer who already has the hash.

A hash that does not match this payment (wrong recipient, wrong contract, wrong
amount, failed receipt) returns a transaction-failed message and does not
change the payment to paid.

### 7.4 Re-verification of an assigned hash

Once a transaction hash is stored in `confirming`, later checks re-verify that
same hash directly by RPC. Explorer discovery is skipped. If the assigned
transaction later fails or no longer contains the expected transfer, the
payment goes to `manual_review`, not back to paid.

### 7.5 Duplicate, ambiguous, and late transfers

- **Ambiguous discovery:** more than one matching transaction with the exact
  amount goes to `manual_review` with no hash assigned.
- **Duplicate hash:** a hash already assigned to another crypto payment is not
  claimed. The second payment goes to `manual_review`; the unique index on
  `tx_hash` is the final database guard.
- **Before order creation:** a block timestamp earlier than the order creation
  time goes to `manual_review`.
- **After expiry:** a transfer whose block timestamp is later than
  `expires_at` becomes `late_payment`. It is preserved with its hash and amount
  for support review and is not fulfilled automatically.
- **Overpayment / second transfer after paid:** once a payment is `paid`, later
  transfers to the same amount are not automatically reconciled. Support must
  investigate and refund or credit them manually.

### 7.6 Concurrency

- Status changes use conditional `UPDATE ... WHERE status IN (...) AND
  (tx_hash IS NULL OR tx_hash = ...) RETURNING`.
- Unique indexes enforce one payment per order, one row per `payment_id`, one
  row per reference, one row per amount, and one owner per transaction hash.
- The winning verification transaction marks the payment/order paid and writes
  the outbox event atomically.
- If fulfillment dispatch fails after commit, the outbox row remains and the
  scheduled worker retries. The payment stays paid.

---

## 8. Statuses

| Status | Meaning | Automatic fulfillment? | Terminal for auto-verification? |
|---|---|---|---|
| `pending` | Waiting for a matching transfer. | No | No |
| `confirming` | Matching transfer detected, fewer than 15 confirmations. | No | No |
| `paid` | At least 15 confirmations; order paid and fulfillment queued. | Yes | Yes |
| `expired` | No matching transfer by the 30-minute deadline. | No | No; worker may still detect a late transfer for 24 hours. |
| `late_payment` | Transfer arrived after expiry. Hash and amount preserved. | No | Yes; manual review required. |
| `manual_review` | Ambiguous transfer, duplicate hash, pre-order timestamp, or an assigned transaction that no longer verifies. | No | Yes; manual review required. |
| `verification_error` | Explorer/RPC/network failure. No paid/expired transition was made. | No | No; retried by polling/worker. |

`verification_error` does not mean the customer did not pay. It means the
server could not prove the result. The worker retries.

---

## 9. APIs

### 9.1 `POST /api/orders/{orderId}/verify`

Purpose: let the authorized customer page request one verification pass.

Authorization:

- signed-in order owner, administrator, or a valid order access token in the
  JSON body `token` field;
- an unknown or unauthorized order returns `404` to avoid leaking existence.

Request:

```json
{
  "token": "optional order access token for guests",
  "txHash": "optional 0x-prefixed 64-hex transaction hash"
}
```

Limits and protections:

- body capped at 4 KiB;
- `Origin`, when present, must match the request host or `SITE_URL`;
- per-IP limit: 30 requests per 60 seconds (`cryptoVerify` scope);
- per-order + per-IP limit: 12 requests per 60 seconds;
- `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`;
- `GET` returns 405.

Success response:

```json
{
  "ok": true,
  "result": {
    "status": "pending",
    "messageCode": "waiting_for_payment",
    "confirmations": 0,
    "requiredConfirmations": 15,
    "txHash": null,
    "amountUsdt": "28.5801",
    "amountRaw": "28580100000000000000",
    "reference": "ESIM-7F3A9C21",
    "expiresAt": "2026-11-25T12:30:00.000Z",
    "serverNow": "2026-11-25T12:00:00.000Z",
    "paidAt": null
  }
}
```

Error responses:

| Status | Error | Meaning |
|---|---|---|
| 400 | `invalid_json`, `invalid_payload`, `invalid_tx_hash` | Malformed request. |
| 403 | `forbidden` | Origin mismatch. |
| 404 | `not_found` | Unknown/unauthorized order or no crypto payment. |
| 413 | `payload_too_large` | Body over 4 KiB. |
| 429 | `rate_limited` | Retry after 60 seconds. |
| 500 | `verification_failed` | Unexpected server failure. |
| 503 | `verification_unavailable` | Crypto config or rate-limit store unavailable. |

The browser can request a check, but it cannot set `paid`. Only the server-side
verifier can do that.

### 9.2 `POST /api/jobs/run`

Purpose: scheduled server-side sweep and existing outbox/job processing.

Authorization: `x-internal-job-secret` or `Authorization: Bearer` equal to
`INTERNAL_JOB_SECRET`.

Order of work:

1. load crypto config; if absent, skip monitor but continue;
2. `monitorCryptoPayments` over up to 25 active/expired-within-24h payments;
3. `runOutboxAndJobs` for fulfillment, emails, and other jobs;
4. scheduled articles, analytics retention, rate-limit cleanup;
5. audit the batch, including a `cryptoMonitor` summary.

A crypto monitor failure is logged and reported as
`{"configured":true,"error":"monitor_failed"}` but does not block card
fulfillment or the other jobs.

---

## 10. Database and events

### 10.1 Table

`crypto_payments` stores the payment request independently from the generic
`payments` row:

- `payment_id` — one-to-one with `payments.id`;
- `order_id` — one-to-one with `orders.id` (unique since migration 0011);
- `reference` — customer/support reference;
- `chain_id`, `token_contract`, `receiving_address`;
- `amount_raw` (`NUMERIC(78,0)`), `amount_usdt`;
- `original_amount_minor`, `original_currency` — the untransformed order price;
- `status`, `tx_hash`, `from_address`, `block_number`, `confirmations`;
- `expires_at`, `detected_at`, `paid_at`, `last_verified_at`;
- `verification_attempts`, `last_error`, `metadata`;
- timestamps.

### 10.2 Indexes

- unique `payment_id`;
- unique `reference`;
- unique `amount_raw` — amount reservation;
- unique `tx_hash` — one order per blockchain transaction (NULLs are distinct);
- unique `order_id` — one crypto request per order;
- `(status, expires_at)` — worker selection;
- `last_verified_at` — fairness/ordering.

### 10.3 Events and audit

Every meaningful transition writes:

- a `payment_events` row (e.g. `crypto.payment.created`,
  `crypto.payment.confirming`, `crypto.payment.confirmed`,
  `crypto.payment.expired`, `crypto.payment.late`,
  `crypto.payment.manual_review`, `crypto.verification.error`);
- an `order_events` row for customer/support-visible history;
- an `audit_logs` row for creation, confirmation, expiry, late payment, and
  manual review.

Secrets and API keys are not written to these events. Error messages are
redacted for URLs and `apikey` values and truncated.

---

## 11. Fulfillment and email reuse

When `verifyBnbTransfer` returns `verified` at 15+ confirmations,
`markPaid` performs one transaction that:

1. conditionally updates `crypto_payments` to `paid` with the hash and
   confirmations;
2. updates the generic `payments` row to `paid`;
3. updates `orders.payment_status = 'paid'`, `status = 'processing'`, and
   `paid_at`;
4. writes payment/order events;
5. inserts an outbox event `fulfillment.requested` for the order.

After commit, it calls the existing `runOutboxAndJobs`. That path uses the
existing per-item fulfillment jobs, idempotency keys, supplier abstraction,
eSIM storage, and email/outbox system. A failure after commit does not roll
back the paid state; the scheduled worker retries the outbox.

There is no second fulfillment implementation and no mock delivery in the
crypto path.

The real supplier transport remains environment-dependent. Crypto payment
confirmation does not create a supplier integration that is otherwise missing.

---

## 12. Security notes

- The payment page requires the same order ownership/access token as the normal
  order view. A crypto payment ID is not an authorization credential.
- The customer-supplied transaction hash is untrusted input; it is format
  checked and then independently verified.
- The NodeReal RPC URL (which embeds the API key) never leaves the server.
- The QR code contains only the public wallet address, not a private key,
  payment link, or amount.
- The UI displays the exact amount, contract, chain, and wallet so the customer
  can reject a tampered page.
- Amounts, addresses, and hashes are rendered left-to-right with bidi isolation
  inside Arabic RTL pages.
- Rate limiting fails closed with 503 when the counter store is unavailable.
- Do not add a `NEXT_PUBLIC_PAYMENT_WALLET` or similar variable. The browser
  receives the wallet from the authorized server-rendered payment row.

---

## 13. Internationalization and accessibility

New production crypto copy is present in:

- English (`lib/i18n/dictionaries/en.ts`);
- Spanish (`lib/i18n/dictionaries/es/account.ts`);
- Arabic (`lib/i18n/dictionaries/ar/account.ts`);
- French (`lib/i18n/dictionaries/fr/account.ts`).

The payment panel and checkout method selector include:

- a labelled radio group with card first and crypto second;
- a disabled crypto option with an accessible explanation when unconfigured;
- keyboard-operable copy buttons with screen-reader status messages;
- a countdown that uses server time and an ARIA status/live region;
- a confirmations progress bar with `role="progressbar"` and values;
- visible alerts for rate limits, verification failures, expired requests,
  late payments, and manual review;
- `dir="ltr"` on amounts, addresses, contract, transaction hashes, and chain
  IDs, with CSS `unicode-bidi: isolate` where needed;
- responsive layout at tablet and mobile widths.

---

## 14. Support and manual review

Useful identifiers:

- order number (`orders.order_number`);
- payment reference (`crypto_payments.reference`);
- transaction hash (`crypto_payments.tx_hash`);
- exact amount (`crypto_payments.amount_usdt` / `amount_raw`);
- original order price (`original_amount_minor` / `original_currency`).

Common manual-review reasons:

- multiple transactions match the exact amount;
- the transaction hash is already assigned to another order;
- the block timestamp is before the order was created;
- the assigned transaction later fails or no longer contains the expected
  transfer.

Safe handling:

1. Do not mark an order paid based only on a customer screenshot or message.
2. Confirm the hash on BscScan and independently against a BNB Smart Chain RPC.
3. Confirm the recipient, token contract, raw amount, success status, block
   time, and confirmations.
4. Check that the hash is not already attached to another order.
5. Record the decision and evidence in the audit trail.
6. Only then use a reviewed operational procedure to reconcile the payment and
   release fulfillment.

Late payments are preserved and must not be silently deleted or re-sent. The
customer should not send again.

There is currently **no admin UI for crypto payments**. Manual review,
overpayment reconciliation, and refunds require a reviewed database/operations
procedure. Do not use ad-hoc status edits without an audit record.

---

## 15. Testing and verification performed

Commands:

```bash
npm run typecheck
npm test
npx vitest run tests/crypto-payment.test.ts
npx vitest run tests/migration-upgrade.test.ts tests/checkout-payment-preview.test.ts
npm run lint
npm run build
```

Results at the time of this document:

- TypeScript check: passed.
- Full test suite: **36 files, 322 tests passed**.
- Crypto suite: **22 tests passed**.
- Migration + checkout preview: **12 tests passed**.
- No real blockchain transaction was executed.
- No production database, deployment, DNS, commit, or push was touched.

Coverage includes:

- exact 18-decimal amount conversion without floating point;
- 4-decimal suffix generation and round-trip parsing;
- fail-closed configuration, wrong chain/token/wallet/RPC rejection;
- case-insensitive address comparison;
- NodeReal/RPC log discovery (fake-token rejection, range shrinking, rate limits) and the optional Etherscan adapter;
- chain ID, transaction, receipt, contract, recipient, raw amount, timestamp,
  and confirmation checks;
- 14 vs 15 confirmation gating;
- expired requests;
- late payments;
- ambiguous matching transfers;
- duplicate transaction hashes;
- customer-supplied hash fallback with the explorer unavailable;
- reuse of existing fulfillment exactly once;
- all four locales.

---

## 16. Known limitations and launch gates

These are real limits, not reasons to present the integration as live before
they are addressed.

1. **No live credentials in this build.** `BNB_RPC_URL` (NodeReal)
   are absent locally. Live discovery and live RPC verification have not been
   exercised. A real small-value test is required before launch.
2. **Global checkout must already be enabled.** Crypto is additive. In
   production, `onlineCheckoutAvailable()` must be true through the existing
   provider configuration; otherwise the checkout page is unavailable before
   the crypto method is reached.
3. **Scheduler required.** No production cron is configured in this repository.
   The owner must schedule `/api/jobs/run` and monitor failures.
4. **Supplier transport is environment-dependent.** Confirmation hands off to
   the existing fulfillment path; it cannot make a missing supplier integration
   real.
5. **USD only.** Non-USD carts are rejected rather than converted.
6. **15-confirmation finality assumption.** A deeper reorg after 15
   confirmations is treated as final. This threshold is a policy decision and
   should be reviewed for the expected order values.
7. **Amount capacity.** A given base total has at most 9,999 unique suffixes
   over the lifetime of the table because expired amounts remain reserved.
8. **Reconciliation suffix.** The exact payable amount can exceed the cart total
   by up to 0.9999 USDT. This is intentional uniqueness behavior, not a fee, but
   it needs owner approval and support/refund handling.
9. **No automatic overpayment/refund handling.** A second transfer after `paid`
   is not reconciled automatically.
10. **No admin crypto UI.** Manual review and refunds require a reviewed
    operational procedure.
11. **NodeReal free-plan limits.** Discovery can fail under rate/quota limits; the
    customer-supplied-hash fallback remains available, and the worker retries.
12. **Browser polling is not authoritative.** Closing the page does not stop
    server verification, but the worker must be scheduled.
13. **No webhook.** Verification is polling/discovery based; there is no
    provider webhook to push confirmations.
14. **One active request per order.** A customer cannot regenerate a fresh
    amount for an existing crypto order through the normal flow; support must
    handle an expired request under the current policy.

---

## 17. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Crypto radio is disabled | One or more config values missing/invalid, or `PAYMENT_WALLET` is not the documented address | Check server logs/config validation; restart after fixing. |
| Checkout rejects crypto with a configuration message | `loadCryptoPaymentConfig()` returned null at request time | Fix the environment; do not bypass the check. |
| Payment page 404 | Wrong payment ID, missing/invalid access token, or crypto config absent | Use the order's access link; verify config. |
| Stays `pending` after sending | Wrong network, wrong token contract, wrong amount, or explorer delay | Check the transaction on BscScan; verify exact amount and BEP-20 contract; use the hash fallback. |
| Stays `confirming` | Fewer than 15 confirmations or RPC cannot see the latest block | Wait; check worker/RPC health. Do not fulfill manually. |
| `verification_error` | Explorer/RPC/network outage or malformed response | Retry; check `BNB_RPC_URL` (NodeReal key active, BSC Mainnet); the worker retries. |
| `expired` | No matching transfer by the deadline | Do not send to the expired request; support must decide whether to create a new order. |
| `late_payment` | Transfer arrived after expiry | Preserve it; manual review; do not resend. |
| `manual_review` | Ambiguous/duplicate/pre-order transaction | Support investigates with the hash and reference. |
| Paid but no eSIM | Outbox/fulfillment failure or missing supplier transport | Run `/api/jobs/run`; inspect outbox jobs and logs. Do not create a parallel delivery path. |
| Rate limited (429) | Too many checks from one IP/order | Wait 60 seconds. |

---

## 18. File map

| Path | Responsibility |
|---|---|
| `lib/payments/crypto/config.ts` | Server env validation, constants, public projection. |
| `lib/payments/crypto/amount.ts` | BigInt amount, suffix, reference, address comparison. |
| `lib/payments/crypto/rpc-log-provider.ts` | Default discovery: NodeReal BSC `eth_getLogs`. |
| `lib/payments/crypto/explorer-provider.ts` | Discovery interface + optional Etherscan V2 adapter (unused by default). |
| `netlify/functions/crypto-payment-monitor.ts` | Netlify scheduled function: calls `/api/jobs/run` every 15 minutes (lets the database sleep between runs). |
| `lib/payments/crypto/bnb-verifier.ts` | Independent RPC verification and confirmations. |
| `lib/payments/crypto/payment-service.ts` | Creation, reservation, verification state machine, duplicate/late handling, paid transition, worker. |
| `lib/payments/crypto/access.ts` | Order-owner/access-token authorization. |
| `lib/checkout.ts` | Card/crypto checkout branching and idempotency. |
| `app/checkout/actions.ts` | Server action validation for the payment method. |
| `components/checkout-form.tsx` | Card-first accessible method selector. |
| `app/checkout/page.tsx` | Server-side crypto availability. |
| `app/checkout/crypto/[paymentId]/page.tsx` | Authorized payment page and real address QR. |
| `components/crypto-payment-panel.tsx` | Countdown, polling, check now, hash fallback, statuses, copy, BscScan link. |
| `app/api/orders/[id]/verify/route.ts` | Authenticated, rate-limited verification endpoint. |
| `app/api/jobs/run/route.ts` | Scheduled crypto monitor plus existing outbox/jobs. |
| `lib/db/schema.ts` | `crypto_payments` table and indexes. |
| `db/migrations/0010_crypto_payments.sql` | Table and indexes. |
| `db/migrations/0011_crypto_payment_order_unique.sql` | One crypto payment per order. |
| `tests/crypto-payment.test.ts` | Unit/integration coverage for the crypto path. |
| `.env.example` | Server-only crypto variable documentation. |

---

## 19. Quick checklist before accepting real money

- [ ] `PAYMENT_WALLET` is exactly the documented address.
- [ ] `PAYMENT_TOKEN_CONTRACT` is exactly the documented BSC-USD contract.
- [ ] `PAYMENT_CHAIN_ID=56`.
- [ ] `BNB_RPC_URL` is the NodeReal BSC **Mainnet** HTTPS endpoint (server-only).
- [ ] No crypto secret exists in a `NEXT_PUBLIC_` variable or client bundle.
- [ ] `npm run db:migrate` has run on the deployed database.
- [ ] `/api/jobs/run` is scheduled at least every minute (15 seconds preferred)
      with `INTERNAL_JOB_SECRET`.
- [ ] A real small-value transfer reached exactly 15 confirmations and produced
      exactly one eSIM/email.
- [ ] A second verification did not duplicate fulfillment.
- [ ] A failed/ambiguous/late transfer did not fulfill.
- [ ] The owner has approved the suffix/reconciliation policy and refund
      process.
- [ ] Existing launch gates and supplier/email gates are satisfied.

---

## 20. Mainnet readiness update (2026-11-25)

Verified read-only on BNB Smart Chain mainnet through NodeReal
(`npm run crypto:check`, never sends a transaction or prints the key):
chain ID 56, token contract has code, `symbol()` = USDT, `decimals()` = 18,
receiving wallet is an EOA, wallet-filtered `eth_getLogs` accepted ranges up to
50,000 blocks, average block time ~0.45 s. A real third-party USDT transfer was
discovered and **verified** by ESIMPROVE's code, and the same transaction was
**rejected** for a wrong amount, wallet, token, and chain.

Fixes in this round:

| Problem | Fix |
|---|---|
| `BNB_RPC_URL` in `.env.local` contained the NodeReal prefix twice, so every RPC call failed | Repaired locally (backup in `.env.local.bak-rpcfix`); config validation now rejects a duplicated URL |
| Worker batch included every expired payment ever; after ~25 expired rows, active payments were never checked | Expired rows are only scanned inside the 24 h late window |
| `amount_raw` was unique forever: each price allowed only ~9,999 orders in total | Migration `0013`: unique only while reserved; the worker releases amounts 24 h after paid/expired. Manual-review and late-payment rows stay reserved |
| Wrong amounts (rounded/under/over payments) were silently ignored until expiry | Policy below; customer sees a dedicated "amount does not match" message (4 languages) |
| Block-time estimate 0.75 s, 5,000-block windows | 0.45 s estimate, 50,000-block windows (auto-shrinks if refused) |
| Single RPC | Optional `BNB_RPC_FALLBACK_URL` for verification reads; fails over only on transport/provider errors, never overrides a definite answer |

### Wrong-amount policy

- Only a transfer whose raw value **exactly** equals the order's reserved amount
  can pay an order.
- A transfer to the wallet, after the order was created, whose value is within
  max(1 USDT, 10%) of exactly **one** reserved order (and does not exactly match
  another order, and whose hash is not assigned elsewhere) moves that order to
  `manual_review` with `metadata.amountMismatch` = {kind underpaid|overpaid,
  txHash, receivedRaw, expectedRaw}. It is never paid or fulfilled
  automatically; support refunds the difference or requests the remainder.
- If the value is close to several reserved orders, nothing is guessed.

### Not verified (requires a real payment)

A real customer transfer to the ESIMPROVE wallet reaching 15 confirmations and
producing exactly one eSIM; BNB testnet transactions (no funded test wallet was
used or requested).

