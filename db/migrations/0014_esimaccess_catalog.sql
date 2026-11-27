-- 0014_esimaccess_catalog.sql
-- Real supplier catalog (eSIM Access). Adds supplier metadata to plans and a
-- uniqueness guarantee for supplier package codes. Existing plans, orders and
-- eSIM records are not modified.

ALTER TABLE plans ADD COLUMN IF NOT EXISTS supplier_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS supplier_synced_at timestamptz;

-- One plan per eSIM Access package code (the supplier's stable identifier).
CREATE UNIQUE INDEX IF NOT EXISTS plans_esimaccess_package_unique
  ON plans (supplier_key, supplier_product_id)
  WHERE supplier_key = 'esimaccess';
