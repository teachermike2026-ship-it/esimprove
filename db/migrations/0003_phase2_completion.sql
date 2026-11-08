-- 0003_phase2_completion.sql
-- Phase 2 completion additions: order status history, payment events, and
-- operational settings/health tracking tables.

CREATE TABLE IF NOT EXISTS order_status_history (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_status_history_order_id_idx ON order_status_history (order_id);

CREATE TABLE IF NOT EXISTS payment_events (
  id text PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_events_payment_id_idx ON payment_events (payment_id);

CREATE TABLE IF NOT EXISTS admin_settings (
  id text PRIMARY KEY,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_settings_key_unique ON admin_settings (key);

CREATE TABLE IF NOT EXISTS system_settings (
  id text PRIMARY KEY,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_key_unique ON system_settings (key);

CREATE TABLE IF NOT EXISTS api_health_checks (
  id text PRIMARY KEY,
  target text NOT NULL,
  method text NOT NULL,
  status text NOT NULL,
  response_code integer,
  latency_ms integer,
  message text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_health_checks_checked_at_idx ON api_health_checks (checked_at);

CREATE TABLE IF NOT EXISTS provider_sync_jobs (
  id text PRIMARY KEY,
  provider_key text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_sync_jobs_provider_key_idx ON provider_sync_jobs (provider_key);

CREATE TABLE IF NOT EXISTS provider_balance_snapshots (
  id text PRIMARY KEY,
  provider_key text NOT NULL,
  balance_minor bigint,
  currency text NOT NULL DEFAULT 'USD',
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_balance_snapshots_provider_key_idx ON provider_balance_snapshots (provider_key);
