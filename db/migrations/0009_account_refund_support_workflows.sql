-- Account, refund, and support workflow additions.
-- This migration is additive and idempotent. It does not rewrite or delete
-- existing rows. Apply it to a working copy first and review the output before
-- running it against any preserved database.

-- Refund review outcome (who decided, when, and why).
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS resolution_note text NOT NULL DEFAULT '';
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS resolved_by text REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- Support conversation routing and lifecycle.
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_to text REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- One-time account tokens now cover both password reset and email verification.
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'password_reset';
CREATE INDEX IF NOT EXISTS password_resets_purpose_idx ON password_resets (purpose);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets (status, updated_at);
CREATE INDEX IF NOT EXISTS support_tickets_assigned_idx ON support_tickets (assigned_to);
