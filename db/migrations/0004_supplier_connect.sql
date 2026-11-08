-- 0004_supplier_connect.sql
-- Supplier connection and capability tables. These were present in the Drizzle
-- schema but missing from the migration history, so a fresh database could not
-- use any supplier-integration page or store.

CREATE TABLE IF NOT EXISTS supplier_connections (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  adapter_type text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  base_url text NOT NULL,
  auth_method text NOT NULL DEFAULT 'api_key',
  enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'disconnected',
  last_test_at timestamptz,
  last_sync_at timestamptz,
  last_error_safe text,
  credential_encrypted jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_connections_display_unique
  ON supplier_connections (display_name);
CREATE INDEX IF NOT EXISTS supplier_connections_adapter_idx
  ON supplier_connections (adapter_type);
CREATE INDEX IF NOT EXISTS supplier_connections_env_idx
  ON supplier_connections (environment);

CREATE TABLE IF NOT EXISTS supplier_capabilities (
  id text PRIMARY KEY,
  supplier_key text NOT NULL,
  connection_id text NOT NULL REFERENCES supplier_connections(id) ON DELETE CASCADE,
  capability text NOT NULL,
  status text NOT NULL DEFAULT 'unknown',
  verified_at timestamptz,
  verified_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_caps_connection_capability_unique
  ON supplier_capabilities (connection_id, capability);
CREATE INDEX IF NOT EXISTS supplier_caps_status_idx
  ON supplier_capabilities (status);
