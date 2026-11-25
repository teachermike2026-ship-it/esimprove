-- 0011_crypto_payment_order_unique.sql
-- One crypto payment request per order. The service already returns an
-- existing request before inserting, but this unique index makes a concurrent
-- double-submit safe at the database level. Existing crypto rows are not
-- modified.

DROP INDEX IF EXISTS crypto_payments_order_id_idx;

CREATE UNIQUE INDEX IF NOT EXISTS crypto_payments_order_id_unique
  ON crypto_payments (order_id);
