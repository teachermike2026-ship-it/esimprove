-- 0017_email_provider_ids.sql
-- Email Center: keep the email provider's message ID (Resend `id`) and a
-- sanitized provider response for each logged email. Additive only: two
-- nullable columns; existing rows are not modified.

ALTER TABLE email_events ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS provider_response text;
