-- 0013_crypto_amount_release.sql
-- Payable crypto amounts (price + random 4-decimal suffix) were unique across
-- ALL rows forever, so each price could only ever be used ~9,999 times before
-- checkout failed. Amounts are now reserved while a payment can still receive
-- a transfer and released afterwards (24 h after it was paid or expired; see
-- monitorCryptoPayments). Payments in manual review / late payment are never
-- released automatically. Existing rows are preserved.

ALTER TABLE crypto_payments ADD COLUMN IF NOT EXISTS amount_released_at timestamptz;

DROP INDEX IF EXISTS crypto_payments_amount_raw_unique;

CREATE UNIQUE INDEX IF NOT EXISTS crypto_payments_amount_raw_active_unique
  ON crypto_payments (amount_raw)
  WHERE amount_released_at IS NULL;

-- Release amounts that are already past the 24-hour late window.
UPDATE crypto_payments
   SET amount_released_at = now()
 WHERE amount_released_at IS NULL
   AND (
     (status = 'paid' AND paid_at IS NOT NULL AND paid_at < now() - interval '24 hours')
     OR (status = 'expired' AND expires_at < now() - interval '24 hours')
   );
