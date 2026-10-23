-- 0001_initial.sql
-- Initial schema for the eSIMprove Phase 1-3 demo build.
-- All data created by the seed is demo data. No live supplier or payment data.

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'customer',
  email_verified_at timestamptz,
  totp_enabled boolean NOT NULL DEFAULT false,
  totp_secret_encrypted jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  pending_two_factor boolean NOT NULL DEFAULT false,
  ip_hash text,
  user_agent text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_unique ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS regions (
  id text PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  accent text NOT NULL DEFAULT 'teal',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS regions_slug_unique ON regions (slug);

CREATE TABLE IF NOT EXISTS destinations (
  id text PRIMARY KEY,
  region_id text NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
  slug text NOT NULL,
  country_code text NOT NULL,
  name text NOT NULL,
  summary text NOT NULL,
  description text NOT NULL,
  popular boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS destinations_slug_unique ON destinations (slug);
CREATE INDEX IF NOT EXISTS destinations_region_id_idx ON destinations (region_id);

CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY,
  destination_id text NOT NULL REFERENCES destinations(id) ON DELETE RESTRICT,
  slug text NOT NULL,
  name text NOT NULL,
  supplier_key text NOT NULL,
  supplier_product_id text NOT NULL,
  data_mb integer NOT NULL CHECK (data_mb > 0),
  validity_days integer NOT NULL CHECK (validity_days > 0),
  cost_minor bigint NOT NULL CHECK (cost_minor >= 0),
  markup_bps integer NOT NULL CHECK (markup_bps >= 0),
  price_minor bigint NOT NULL CHECK (price_minor >= 0),
  currency text NOT NULL DEFAULT 'USD',
  tax_bps integer NOT NULL DEFAULT 0 CHECK (tax_bps >= 0),
  coverage_summary text NOT NULL,
  network_summary text NOT NULL,
  description text NOT NULL,
  features jsonb NOT NULL,
  status text NOT NULL DEFAULT 'published',
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS plans_slug_unique ON plans (slug);
CREATE INDEX IF NOT EXISTS plans_destination_id_idx ON plans (destination_id);
CREATE INDEX IF NOT EXISTS plans_status_idx ON plans (status);

CREATE TABLE IF NOT EXISTS carts (
  id text PRIMARY KEY,
  token text NOT NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS carts_token_unique ON carts (token);

CREATE TABLE IF NOT EXISTS cart_items (
  id text PRIMARY KEY,
  cart_id text NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_plan_unique ON cart_items (cart_id, plan_id);
CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx ON cart_items (cart_id);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  order_number text NOT NULL,
  email text NOT NULL,
  customer_name text NOT NULL,
  country text NOT NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_payment',
  payment_status text NOT NULL DEFAULT 'pending',
  fulfillment_status text NOT NULL DEFAULT 'not_started',
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  tax_minor bigint NOT NULL CHECK (tax_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  currency text NOT NULL,
  idempotency_key text NOT NULL,
  terms_version text NOT NULL,
  is_demo boolean NOT NULL DEFAULT true,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_total_check CHECK (total_minor = subtotal_minor + tax_minor)
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_unique ON orders (order_number);
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_unique ON orders (idempotency_key);
CREATE INDEX IF NOT EXISTS orders_email_idx ON orders (email);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  plan_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  cost_minor bigint NOT NULL CHECK (cost_minor >= 0),
  supplier_key text NOT NULL,
  supplier_product_id text NOT NULL,
  data_mb integer NOT NULL,
  validity_days integer NOT NULL,
  currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);

CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_payment_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL,
  checkout_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_unique ON payments (provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments (order_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  id text PRIMARY KEY,
  provider text NOT NULL,
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_external_unique ON webhook_events (provider, external_event_id);

CREATE TABLE IF NOT EXISTS fulfillment_jobs (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id text NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  last_error text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fulfillment_jobs_order_item_unique ON fulfillment_jobs (order_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS fulfillment_jobs_idempotency_unique ON fulfillment_jobs (idempotency_key);
CREATE INDEX IF NOT EXISTS fulfillment_jobs_status_next_idx ON fulfillment_jobs (status, next_attempt_at);

CREATE TABLE IF NOT EXISTS esims (
  id text PRIMARY KEY,
  order_item_id text NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  supplier_key text NOT NULL,
  supplier_esim_id text NOT NULL,
  iccid text,
  lpa_ciphertext text NOT NULL,
  lpa_iv text NOT NULL,
  lpa_tag text NOT NULL,
  dek_wrapped text NOT NULL,
  dek_iv text NOT NULL,
  dek_tag text NOT NULL,
  key_version integer NOT NULL CHECK (key_version > 0),
  status text NOT NULL DEFAULT 'ready_to_install',
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS esims_order_item_unique ON esims (order_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS esims_iccid_unique ON esims (iccid);

CREATE TABLE IF NOT EXISTS supplier_transactions (
  id text PRIMARY KEY,
  supplier_key text NOT NULL,
  client_transaction_id text NOT NULL,
  supplier_order_id text NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_transactions_client_unique ON supplier_transactions (supplier_key, client_transaction_id);

CREATE TABLE IF NOT EXISTS order_events (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order_id_idx ON order_events (order_id);

CREATE TABLE IF NOT EXISTS order_access_tokens (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS order_access_tokens_hash_unique ON order_access_tokens (token_hash);
CREATE INDEX IF NOT EXISTS order_access_tokens_order_id_idx ON order_access_tokens (order_id);

CREATE TABLE IF NOT EXISTS email_events (
  id text PRIMARY KEY,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  template text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  body_text text NOT NULL,
  status text NOT NULL DEFAULT 'logged',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS email_events_order_id_idx ON email_events (order_id);

CREATE TABLE IF NOT EXISTS outbox_events (
  id text PRIMARY KEY,
  topic text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_events_status_next_idx ON outbox_events (status, next_attempt_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  actor_type text NOT NULL,
  actor_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);

CREATE TABLE IF NOT EXISTS activation_access_logs (
  id text PRIMARY KEY,
  esim_id text NOT NULL REFERENCES esims(id) ON DELETE CASCADE,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_type text NOT NULL,
  actor_id text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activation_access_logs_esim_id_idx ON activation_access_logs (esim_id);

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL
);
