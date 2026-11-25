-- 0010_crypto_payments.sql
-- Production crypto payment requests for Binance-Peg USDT (BEP-20) on BNB
-- Smart Chain. Adds a new table only; existing orders and payments are not
-- modified or backfilled.

CREATE TABLE IF NOT EXISTS crypto_payments (
  id text PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reference text NOT NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  payment_method text NOT NULL DEFAULT 'crypto',
  payment_asset text NOT NULL DEFAULT 'Binance-Peg USDT (BEP-20)',
  chain_id integer NOT NULL,
  token_contract text NOT NULL,
  receiving_address text NOT NULL,
  -- Exact token amount in base units (18 decimals). Never a floating value.
  amount_raw numeric(78, 0) NOT NULL,
  amount_usdt text NOT NULL,
  original_amount_minor bigint NOT NULL,
  original_currency text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text,
  from_address text,
  block_number bigint,
  confirmations integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  detected_at timestamptz,
  paid_at timestamptz,
  last_verified_at timestamptz,
  verification_lease_until timestamptz,
  verification_attempts integer NOT NULL DEFAULT 0,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One crypto payment request per internal payment row.
CREATE UNIQUE INDEX IF NOT EXISTS crypto_payments_payment_id_unique
  ON crypto_payments (payment_id);

-- Human-readable reference shown to the customer and support.
CREATE UNIQUE INDEX IF NOT EXISTS crypto_payments_reference_unique
  ON crypto_payments (reference);

-- Concurrency-safe unique amount reservation. PostgreSQL treats every NULL as
-- distinct, so this unique index also permits many unassigned transaction rows.
CREATE UNIQUE INDEX IF NOT EXISTS crypto_payments_amount_raw_unique
  ON crypto_payments (amount_raw);

-- A blockchain transaction can be claimed by at most one order.
CREATE UNIQUE INDEX IF NOT EXISTS crypto_payments_tx_hash_unique
  ON crypto_payments (tx_hash);

CREATE INDEX IF NOT EXISTS crypto_payments_order_id_idx
  ON crypto_payments (order_id);

CREATE INDEX IF NOT EXISTS crypto_payments_status_expires_idx
  ON crypto_payments (status, expires_at);

CREATE INDEX IF NOT EXISTS crypto_payments_last_verified_idx
  ON crypto_payments (last_verified_at);
