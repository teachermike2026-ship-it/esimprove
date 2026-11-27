-- 0012_payment_provider_cases.sql
-- Persistent record of provider-side refunds and disputes (for example Whop
-- refund.created / refund.updated / dispute.created / dispute.updated).
-- Adds a new table only; existing orders, payments, and refunds are not
-- modified or backfilled. These rows never queue fulfillment.

CREATE TABLE IF NOT EXISTS payment_provider_cases (
  id text PRIMARY KEY,
  provider text NOT NULL,
  -- 'refund' or 'dispute'
  kind text NOT NULL,
  -- Provider identifier of the refund or dispute (for example dspt_...).
  provider_case_id text NOT NULL,
  -- Provider payment the case belongs to (for example pay_...).
  provider_payment_id text,
  payment_id text REFERENCES payments(id) ON DELETE SET NULL,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  -- Exact amount in minor units of `currency`; null when it could not be
  -- represented exactly (the case is then flagged for review).
  amount_minor bigint,
  currency text NOT NULL,
  provider_status text NOT NULL,
  reason text,
  needs_review boolean NOT NULL DEFAULT false,
  review_reason text,
  last_webhook_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_cases_unique
  ON payment_provider_cases (provider, kind, provider_case_id);

CREATE INDEX IF NOT EXISTS payment_provider_cases_payment_idx
  ON payment_provider_cases (payment_id);

CREATE INDEX IF NOT EXISTS payment_provider_cases_order_idx
  ON payment_provider_cases (order_id);
