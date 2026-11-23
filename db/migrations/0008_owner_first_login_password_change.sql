-- Owner first-login password change support.
-- Adds a local-first flag used by the mandatory owner password rotation flow.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_required boolean NOT NULL DEFAULT false;
