-- 0016_user_identities.sql
-- Google / Apple sign-in. Links one verified provider identity (provider +
-- the provider's stable subject id) to exactly one ESIMPROVE account, so the
-- same person can never get duplicate accounts. Adds a new table only;
-- existing users, sessions and orders are not modified or backfilled.

CREATE TABLE IF NOT EXISTS user_identities (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'google' or 'apple'
  provider text NOT NULL,
  -- The provider's stable account id (OpenID Connect "sub").
  subject text NOT NULL,
  -- Email the provider reported as verified at the last sign-in.
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_identities_provider_subject_unique
  ON user_identities (provider, subject);

CREATE UNIQUE INDEX IF NOT EXISTS user_identities_user_provider_unique
  ON user_identities (user_id, provider);

CREATE INDEX IF NOT EXISTS user_identities_user_idx
  ON user_identities (user_id);
