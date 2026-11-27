-- 0015_multi_esim_per_item.sql
-- An order line with quantity N receives N eSIM profiles. Previously a unique
-- index allowed only one eSIM per order item, so quantity > 1 could never be
-- delivered. eSIM Access also documents that ICCIDs are reused over time, so
-- ICCID cannot be globally unique. The supplier's eSIM transaction number is
-- the stable identity and makes profile inserts idempotent.
-- Existing eSIM rows are preserved.

DROP INDEX IF EXISTS esims_order_item_unique;
CREATE INDEX IF NOT EXISTS esims_order_item_idx ON esims (order_item_id);

DROP INDEX IF EXISTS esims_iccid_unique;
CREATE INDEX IF NOT EXISTS esims_iccid_idx ON esims (iccid);

CREATE UNIQUE INDEX IF NOT EXISTS esims_supplier_esim_unique
  ON esims (supplier_key, supplier_esim_id);
