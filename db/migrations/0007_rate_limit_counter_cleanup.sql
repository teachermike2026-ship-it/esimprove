-- 0007_rate_limit_counter_cleanup.sql
-- Supports bounded cleanup of expired fixed-window rate-limit counters.
-- Keys are HMAC pseudonyms, never raw IP addresses. Cleanup deletes only rows
-- whose window is older than the configured safety TTL, so active windows are
-- never removed. The DELETE is idempotent and safe to run concurrently.

CREATE INDEX IF NOT EXISTS rate_limit_counters_window_start_idx
  ON rate_limit_counters (window_start);
