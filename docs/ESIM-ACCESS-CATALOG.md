# eSIM Access catalog integration

Source: https://docs.esimaccess.com ("Get All Data Packages").

## What it does

`POST https://api.esimaccess.com/api/v1/open/package/list` with
`{"locationCode":"","type":"BASE",...}` returns every BASE package (countries,
regional and global) in one response; the endpoint has no pagination. Requests
are signed: `RT-AccessCode`, `RT-RequestID`, `RT-Timestamp` (ms) and
`RT-Signature = lowercase hex HMAC-SHA256(Timestamp + RequestID + AccessCode + body, SecretKey)`
(verified against the documentation's worked example in
`tests/esimaccess-catalog.test.ts`).

`lib/integrations/supplier/esimaccess.ts` implements **only** this endpoint.
There is no order, top-up, cancel, balance or profile function in the catalog
code, so syncing cannot create a supplier charge.

## Mapping

| Supplier field | ESIMPROVE |
|---|---|
| `packageCode` | `plans.supplier_product_id` (stable identifier, unique for `esimaccess`) |
| `slug` | plan URL `esim-<slug>` on first import; never changed afterwards |
| `price` (1/10,000 USD) | `cost_minor` = price / 100 (cents) |
| `ceil((cost + $3 profit + $0.30) / (1 − 4.2%))` | `price_minor` (target net profit after card fee; see `lib/pricing-config.ts`) |
| `volume` (bytes) | `data_mb` |
| `duration` (DAY) | `validity_days` (day-pass plans: 1 day, data per day) |
| `location` / `locationCode` | country destination (existing destinations reused by country code) or one multi-country destination per code (EU-42, AS-12, GL-120 …) |
| operators | `network_summary` |
| speed, top-up, FUP, activation, SMS, IP exit, retail price | `features` + `supplier_metadata` |

Packages are only sold when the cost is a positive whole-cent USD amount with a
valid volume and validity; others are excluded and reported.

## Running it

- Local: stop the servers on ports 3000/3001 (PGlite allows one process), then
  `npm run catalog:sync`, then start the server again. The script refuses to
  run while a server holds the local database.
- Deployed: migrate (`0014_esimaccess_catalog.sql`), set `ESIM_ACCESS_CODE`,
  `ESIM_SECRET_KEY`, `ESIMPROVE_TARGET_NET_PROFIT_USD=3.00` (and card fee
  variables if your Whop rates differ) and `CATALOGUE_SYNC_ENABLED=true`;
  `/api/jobs/run` then refreshes the catalog at most once every 24 h.

## Safety

- Fetch + validation happen before any write; failure, an empty list, or a
  list where most packages are invalid changes nothing.
- One transaction for all writes; upsert by package code; price recomputed
  from cost every time (no compounding).
- Packages that disappear or become invalid are archived, never deleted.
- After a successful import, plans from other suppliers (demo/sample data) are
  archived; destinations without a published plan are hidden; archived plan
  pages return 404. Historical orders and eSIM records are untouched.

## Ordering and fulfillment

`lib/integrations/supplier/esimaccess-orders.ts` (POST /esim/order, POST
/esim/query) and `lib/fulfillment.ts`:

1. After a payment is confirmed, one fulfillment job per order line runs.
2. The plan's supplier fulfils it (`getSupplierAdapterFor`). eSIM Access plans
   are ordered only when `SUPPLIER_LIVE_ENABLED=true` and credentials are set;
   otherwise the job goes to manual review. A real package is never fulfilled
   with mock data.
3. `transactionId = "esp-" + sha256(job key)[0..40]` (≤ 50 chars) is sent with
   every attempt, so the supplier deduplicates retries; the returned `orderNo`
   is stored in `supplier_transactions` and reused on later attempts.
4. The order sends `price`/`amount` (the cost the customer price was based on)
   and `periodNum` for day passes; a supplier price change fails safely.
5. Profiles are fetched with /esim/query; `200010` (allocating) re-checks after
   20 s without consuming an attempt.
6. The response must contain exactly `quantity` profiles with a valid
   `LPA:1$…$…` activation code, ICCID and `esimTranNo`; each is stored once
   (unique supplier + esimTranNo, encrypted activation code) and must belong to
   this order line, otherwise the job goes to manual review.
7. Insufficient balance (200007), price mismatch (200005/6), no stock (200011),
   unavailable package, ordering disabled or invalid responses go to manual
   review (no automatic retry; the payment stays recorded). Admins can retry
   from /admin/jobs or the order page after fixing the cause.
8. The customer gets the delivery email; QR codes are generated from the
   decrypted activation code on the order / account eSIM pages.

Tested with simulated supplier responses only (`tests/esim-fulfillment.test.ts`).
No real supplier order has been placed.
