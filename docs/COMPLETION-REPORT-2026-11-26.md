# ESIMPROVE — Completion Report (2026-11-26)

Branch `feat/nodereal-crypto-checkout`, **all work uncommitted** (per instructions). Nothing was deployed, published, committed or pushed. Whop was not contacted. No crypto was sent, and nothing was bought from eSIM Access.

## 1. What is implemented

| Area | Status |
|---|---|
| USDT (BEP-20) checkout on BNB Smart Chain | Done. Unique amount per order, 30-minute expiry, 15 confirmations, NodeReal `eth_getLogs` detection, failover RPC client, single-flight verification lease, amounts released after 24 h (migration 0013), page refreshes itself, "Continue crypto payment" link on the order page |
| Background monitor | Netlify scheduled function every minute → `POST /api/jobs/run` (crypto monitor + fulfillment + daily catalog sync) |
| eSIM Access catalog | 3,300 real packages imported locally. Daily read-only sync job (`scripts/catalog-sync.ts`, `lib/supplier-catalog/*`) |
| Pricing | `price = ceil((cost + $3.00 + $0.30) / (1 − 4.2%))`, so every plan earns at least $3 net after the card fee. Configured with `ESIMPROVE_*` env vars |
| eSIM Access ordering | Real adapter (`lib/integrations/supplier/esimaccess-orders.ts`): signed requests, idempotent `transactionId`, price check, waits for allocation, checks LPA/ICCID, N eSIMs for quantity N. **Off unless `SUPPLIER_LIVE_ENABLED=true`** |
| Fulfillment safety | Re-uses an existing supplier order instead of buying twice. Supplier errors that a retry can't fix (balance, price, stock) → `manual_review` with "Your payment is safe…". Admin can retry from the jobs and order pages |
| Customer / admin views | Order page shows the crypto payment and one activation link per eSIM. Admin retry covers `manual_review` |
| Whop | Code only (signed webhooks with dedup, dynamic checkout, card-availability check). Never contacted |

## 2. Tests

| Kind | Result |
|---|---|
| Unit/integration (vitest) | **391 / 391 passed** (40 files) |
| TypeScript / ESLint | Clean |
| Production build (Turbopack, isolated copy) | OK |
| Browser smoke (local dev) | Plan page, cart → crypto checkout (2 × Spain 3 GB = $10.24 → 10.5617 USDT), auto-verification call, mobile layout |
| Read-only mainnet RPC (NodeReal) | Detection path verified against BSC |
| **Simulated, not real** | eSIM Access ordering (mocked HTTP; real purchase declined by owner). Payment confirmation (no real USDT sent) |

## 3. Production changes made

### Neon (production database)
1. **Backup first** (read-only, REPEATABLE READ snapshot): `.audit/backups/neon-2026-11-26T00-51-08-250Z/` — 65 tables, 91 rows, migrations 0001–0009.
2. **Applied migrations 0010–0015** using the direct (non-pooled) URL and `scripts/migrate.ts`.
3. **After-backup / check**: `.audit/backups/neon-2026-11-26T00-54-14-126Z/` — 67 tables, 15 migrations. The only row change is `schema_migrations` (9 → 15). New empty tables: `crypto_payments`, `payment_provider_cases`. Users and other data are unchanged (1 user, 0 orders, 0 plans).

4. **Catalog sync (owner-approved, 2026-11-26)**: a fresh backup was taken first (`.audit/backups/neon-2026-11-26T01-31-55-925Z/`). Then the 8 storefront regions from the seed data were inserted (no demo destinations or plans) and `runEsimAccessCatalogSync` was run (read-only `package/list` call). Result: **3,300 published real plans**, 244 destinations, 0 excluded, 0 demo. Net profit on every plan is $3.00–$3.01 after the 4.2% + $0.30 fee (Spain 3 GB 30 days = $5.12). Users are unchanged and there are no orders. The sync took **70 s**.

Caveat: Netlify keeps `DATABASE_URL` as a secret that can't be read back. The URL used was taken from `.env.netlify.production`. It points at the Neon production pooler host, but I couldn't compare it with the value stored on Netlify.

### Netlify (production context, env vars only — no deploy triggered)
Set: `PAYMENT_WALLET`, `PAYMENT_TOKEN_CONTRACT`, `PAYMENT_CHAIN_ID=56`, `BNB_RPC_URL` (secret), `ESIM_ACCESS_CODE` (secret), `ESIM_SECRET_KEY` (secret), `ESIMPROVE_TARGET_NET_PROFIT_USD=3.00`, `ESIMPROVE_CARD_FEE_PERCENT=4.2`, `ESIMPROVE_CARD_FEE_FIXED_USD=0.30`, `CATALOGUE_SYNC_ENABLED=true`.
Kept off: `SUPPLIER_LIVE_ENABLED=false`, `PAYMENTS_LIVE_ENABLED=false`. Whop variables were not touched.

## 4. What still blocks a real launch

1. **Not deployed** (forbidden in this mission). Netlify env changes take effect on the next deploy.
2. ~~Daily catalog refresh may time out in production~~ **Fixed (2026-11-26).** The sync now writes only plans whose supplier data changed, in batched upserts. Unchanged plans get their sync time bumped in one statement, and new destinations and archives are batched too. A full refresh against production Neon takes **7 s** (3.3 s of it is the supplier download), down from per-row writes. The refresh now runs after payments and fulfillment, so it can't delay an order. An atomic claim stops two workers from syncing at once, and a failure waits 1 h before retrying instead of calling eSIM Access every minute. Tests: 394/394.
3. **`PAYMENTS_LIVE_ENABLED=false` on Netlify.** Checkout stays off until you switch it on.
4. **`SUPPLIER_LIVE_ENABLED=false`.** Paid orders go to manual review instead of buying eSIMs. Turn it on only after one real test purchase that you authorize, and after checking the eSIM Access balance.
5. **No real end-to-end payment yet.** You need to send one small USDT payment yourself. I can then check detection, confirmation and fulfillment.
6. Smaller items: the admin plan editor still uses the old `markupBps` field (catalog prices come from the $3-net formula). Order access tokens appear in dev request logs. `/destinations` is slow in dev mode only.
7. `BNB_RPC_URL` in `.env.local` was found duplicated twice after manual edits. Validation now rejects that form. Avoid hand-editing that line.

## 5. Testing locally

```powershell
npm run dev
```
```powershell
npx vitest run
```
```powershell
npx tsx scripts/crypto-rpc-check.ts
```
Open http://localhost:3000, pick a plan, then **Checkout → Pay with USDT (BEP-20)**. Admin: `/admin/jobs`, `/admin/orders`.

## 6. Helper scripts created (in `.audit/`, not part of the app)
- `neon-backup.ts` / `neon-backup-lib.ts`: read-only logical backup, prints counts only.
- `neon-migrate.ts`: runs the project migrator against the direct Neon URL.
- `netlify-set-env.cjs`: sets the approved env vars from `.env.local` and never prints values.

---

## 7. Final completion pass (2026-11-26, later) — no deploy

The owner said **"no deploy"**, which overrides the deployment authorization in the pasted mission. Nothing was deployed, committed or pushed. Whop was not contacted.

### New: customers cannot pay for an order that cannot be fulfilled
`lib/fulfillment-readiness.ts`, enforced in `lib/checkout.ts` (server side, covers card and crypto) and shown on `/checkout` (notice in EN/FR/ES/AR; card and crypto options disabled).
- eSIM Access plans need live ordering enabled (`SUPPLIER_LIVE_ENABLED=true` + credentials) **and** a supplier balance ≥ this order's supplier cost **plus** the cost of every order already paid or waiting for a crypto payment that hasn't been issued yet (so two customers can't both pay against the same balance).
- Fails closed: if the balance can't be read, checkout is refused. The message says "No payment was taken."
- Balance comes from eSIM Access `POST /api/v1/open/balance/query` (read-only), cached for 60 s.
- Demo/mock plans can't be bought in production.

### Supplier funding requirement (live read-only query, 2026-11-26)
- **eSIM Access balance: $0.00.** While the balance is zero, every checkout is refused (by design).
- Supplier cost per eSIM across the 3,300 published plans: min **$0.30**, median **$4.00**, 90th percentile **$25.97**, max **$314.58**. 1,942 plans cost ≤ $5 and 2,855 cost ≤ $20.
- Required: balance ≥ the supplier cost of the orders you want to accept at the same time. **$0.30** allows one test purchase of the cheapest plan (e.g. Peru 100 MB / 7 days, sold at $3.76). About **$50–100** covers normal launch traffic for mid-range plans. Top up in the eSIM Access dashboard. The site checks the balance automatically, so no code change is needed.

### Real-chain verification (read-only, `npm run crypto:check`)
- Configuration is valid and NodeReal BSC mainnet is reachable.
- A real third-party USDT transfer was discovered and verified (220 confirmations). Wrong amount, wallet, token and chain were each rejected.
- Your wallet received 0 USDT transfers in the last 24 h, so no real payment of yours could be replayed.

### QA results
| Check | Result |
|---|---|
| TypeScript | clean |
| ESLint (whole project) | clean |
| Tests | **400 / 400** (41 files), incl. 6 new readiness tests and the updated payment→fulfillment tests |
| Crypto lifecycle (tests) | under/overpayment → manual review, expiry, late payment, 15-confirmation threshold, RPC failover/recovery, single-flight lease, amount release |
| Production build (isolated copy) | OK |
| Browser (local) | `/checkout` with a real Spain 3 GB plan shows the unavailable notice; card and crypto are disabled; no mobile overflow |

### Not verified live (and why)
- **Live website:** not deployed (owner instruction). No live-domain checks were possible.
- **Real eSIM purchase:** balance is $0.
- **Real USDT payment end-to-end:** needs a payment from you. Detection is verified on real chain data.
- **Customer email notifications:** no email provider is configured (`EMAIL_LIVE_ENABLED` isn't implemented in this build). Customers get eSIM details and QR codes on their order page through the secure order link shown after checkout and in their account.

### What you need to do to launch
1. Top up eSIM Access (see above).
2. On Netlify, set `SUPPLIER_LIVE_ENABLED=true`. It's safe now: checkout stays blocked until the balance covers the order.
3. Deploy (when you decide to).
4. Make one small USDT payment for the cheapest plan to confirm the full flow live.
