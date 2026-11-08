-- 0002_phase2_foundation.sql
-- Phase 2 foundation additions: password resets, invoicing, refunds, support
-- queues, notifications, consent/preference tracking, coupons, pricing rules,
-- and supplier integration tracking tables.

CREATE TABLE IF NOT EXISTS password_resets (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets (user_id);

CREATE TABLE IF NOT EXISTS invoices (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  number text NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  subtotal_minor bigint NOT NULL,
  tax_minor bigint NOT NULL,
  total_minor bigint NOT NULL,
  currency text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_total_check CHECK (total_minor = subtotal_minor + tax_minor)
);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_order_unique ON invoices (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_unique ON invoices (number);

CREATE TABLE IF NOT EXISTS refunds (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id text REFERENCES payments(id) ON DELETE SET NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  provider_refund_id text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS refunds_idempotency_unique ON refunds (idempotency_key);
CREATE INDEX IF NOT EXISTS refunds_order_id_idx ON refunds (order_id);

CREATE TABLE IF NOT EXISTS support_tickets (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON support_tickets (user_id);

CREATE TABLE IF NOT EXISTS support_messages (
  id text PRIMARY KEY,
  ticket_id text NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type text NOT NULL,
  author_id text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_id_idx ON support_messages (ticket_id);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'en',
  marketing_opt_in boolean NOT NULL DEFAULT false,
  product_updates_opt_in boolean NOT NULL DEFAULT true,
  order_updates_opt_in boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON user_preferences (user_id);

CREATE TABLE IF NOT EXISTS user_consents (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  version text NOT NULL,
  accepted boolean NOT NULL,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_consents_user_purpose_version_unique ON user_consents (user_id, purpose, version);

CREATE TABLE IF NOT EXISTS coupons (
  id text PRIMARY KEY,
  code text NOT NULL,
  kind text NOT NULL,
  value integer NOT NULL,
  status text NOT NULL DEFAULT 'disabled',
  valid_from timestamptz,
  valid_to timestamptz,
  max_redemptions integer,
  redeemed_count integer NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT true,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_unique ON coupons (code);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id text PRIMARY KEY,
  coupon_id text NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  code text NOT NULL,
  discount_minor bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_id_idx ON coupon_redemptions (coupon_id);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id text PRIMARY KEY,
  code text NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL,
  value integer NOT NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pricing_rules_code_unique ON pricing_rules (code);

CREATE TABLE IF NOT EXISTS providers (
  id text PRIMARY KEY,
  key text NOT NULL,
  mode text NOT NULL DEFAULT 'sandbox',
  is_mock boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS providers_key_unique ON providers (key);

CREATE TABLE IF NOT EXISTS provider_plans (
  id text PRIMARY KEY,
  provider_key text NOT NULL,
  supplier_product_id text NOT NULL,
  plan_name text NOT NULL,
  data_mb integer NOT NULL,
  validity_days integer NOT NULL,
  cost_minor bigint NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  coverage_summary text NOT NULL,
  network_summary text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS provider_plans_provider_product_unique ON provider_plans (provider_key, supplier_product_id);

CREATE TABLE IF NOT EXISTS plan_price_history (
  id text PRIMARY KEY,
  supplier_key text NOT NULL,
  supplier_product_id text NOT NULL,
  price_minor bigint NOT NULL,
  cost_minor bigint NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_price_history_supplier_product_idx ON plan_price_history (supplier_key, supplier_product_id);

CREATE TABLE IF NOT EXISTS plan_availability_snapshots (
  id text PRIMARY KEY,
  supplier_key text NOT NULL,
  supplier_product_id text NOT NULL,
  available boolean NOT NULL DEFAULT false,
  data_mb integer,
  validity_days integer,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS plan_availability_supplier_product_unique ON plan_availability_snapshots (supplier_key, supplier_product_id);
