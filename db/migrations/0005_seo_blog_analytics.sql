-- 0005_seo_blog_analytics.sql
-- Phase 4: SEO CMS, blog/articles CMS, and privacy-conscious first-party
-- analytics. Single-site tables; IDs follow the existing app conventions.

CREATE TABLE IF NOT EXISTS seo_settings (
  id text PRIMARY KEY DEFAULT 'seo_global',
  site_name text NOT NULL DEFAULT '',
  homepage_title text NOT NULL DEFAULT '',
  homepage_description text NOT NULL DEFAULT '',
  title_template text NOT NULL DEFAULT '{title} | {site_name}',
  canonical_base text NOT NULL DEFAULT '',
  default_og_image text NOT NULL DEFAULT '',
  default_og_title text NOT NULL DEFAULT '',
  default_og_description text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '',
  favicon_url text NOT NULL DEFAULT '',
  organization_name text NOT NULL DEFAULT '',
  organization_url text NOT NULL DEFAULT '',
  organization_same_as text[] NOT NULL DEFAULT '{}',
  robots_default text NOT NULL DEFAULT 'index, follow',
  index_default boolean NOT NULL DEFAULT true,
  gsc_verification_token text,
  gsc_property text NOT NULL DEFAULT '',
  ga4_measurement_id text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blog_categories (
  id text PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_categories_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS blog_tags (
  id text PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_tags_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS blog_articles (
  id text PRIMARY KEY,
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  scheduled_at timestamptz,
  author_id text NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  category_id text REFERENCES blog_categories(id) ON DELETE SET NULL,
  featured_image text NOT NULL DEFAULT '',
  featured_alt text NOT NULL DEFAULT '',
  seo_title text NOT NULL DEFAULT '',
  seo_description text NOT NULL DEFAULT '',
  canonical_url text NOT NULL DEFAULT '',
  og_image text NOT NULL DEFAULT '',
  robots text NOT NULL DEFAULT 'index, follow',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_articles_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS blog_articles_status_idx ON blog_articles (status);
CREATE INDEX IF NOT EXISTS blog_articles_published_at_idx ON blog_articles (published_at);
CREATE INDEX IF NOT EXISTS blog_articles_category_id_idx ON blog_articles (category_id);
CREATE INDEX IF NOT EXISTS blog_articles_author_id_idx ON blog_articles (author_id);
CREATE INDEX IF NOT EXISTS blog_articles_status_published_idx ON blog_articles (status, published_at);
CREATE INDEX IF NOT EXISTS blog_articles_scheduled_idx ON blog_articles (status, scheduled_at);

CREATE TABLE IF NOT EXISTS blog_article_tags (
  article_id text NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  tag_id text NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX IF NOT EXISTS blog_article_tags_tag_id_idx ON blog_article_tags (tag_id);

-- Anonymous visitor identity. Only an HMAC hash of a client-generated random
-- value is stored; no IP address, fingerprint, or raw identifier is persisted.
CREATE TABLE IF NOT EXISTS analytics_visitors (
  id text PRIMARY KEY,
  visitor_hash text NOT NULL,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  session_count integer NOT NULL DEFAULT 0,
  is_internal boolean NOT NULL DEFAULT false,
  CONSTRAINT analytics_visitors_hash_unique UNIQUE (visitor_hash)
);

CREATE INDEX IF NOT EXISTS analytics_visitors_last_seen_idx ON analytics_visitors (last_seen);

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id text PRIMARY KEY,
  session_hash text NOT NULL,
  visitor_hash text NOT NULL DEFAULT '',
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  entry_path text NOT NULL DEFAULT '/',
  exit_path text,
  device_type text NOT NULL DEFAULT 'unknown',
  browser text NOT NULL DEFAULT 'unknown',
  os text NOT NULL DEFAULT 'unknown',
  country_code text,
  referrer text,
  source text NOT NULL DEFAULT 'direct',
  is_new boolean NOT NULL DEFAULT true,
  is_internal boolean NOT NULL DEFAULT false,
  page_views integer NOT NULL DEFAULT 0,
  events integer NOT NULL DEFAULT 0,
  CONSTRAINT analytics_sessions_hash_unique UNIQUE (session_hash)
);

CREATE INDEX IF NOT EXISTS analytics_sessions_last_seen_idx ON analytics_sessions (last_seen);
CREATE INDEX IF NOT EXISTS analytics_sessions_country_code_idx ON analytics_sessions (country_code);
CREATE INDEX IF NOT EXISTS analytics_sessions_device_type_idx ON analytics_sessions (device_type);
CREATE INDEX IF NOT EXISTS analytics_sessions_visitor_hash_idx ON analytics_sessions (visitor_hash);
CREATE INDEX IF NOT EXISTS analytics_sessions_first_seen_idx ON analytics_sessions (first_seen);

CREATE TABLE IF NOT EXISTS analytics_events (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES analytics_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  page_path text NOT NULL DEFAULT '/',
  page_title text,
  game_id text,
  country_code text,
  device_type text NOT NULL DEFAULT 'unknown',
  browser text NOT NULL DEFAULT 'unknown',
  referrer text,
  metadata jsonb NOT NULL DEFAULT '{}',
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events (created_at);
CREATE INDEX IF NOT EXISTS analytics_events_event_type_idx ON analytics_events (event_type);
CREATE INDEX IF NOT EXISTS analytics_events_session_id_idx ON analytics_events (session_id);
CREATE INDEX IF NOT EXISTS analytics_events_game_id_idx ON analytics_events (game_id);
CREATE INDEX IF NOT EXISTS analytics_events_page_path_idx ON analytics_events (page_path);
CREATE INDEX IF NOT EXISTS analytics_events_country_code_idx ON analytics_events (country_code);
CREATE INDEX IF NOT EXISTS analytics_events_internal_idx ON analytics_events (is_internal);
CREATE INDEX IF NOT EXISTS analytics_events_created_type_idx ON analytics_events (created_at, event_type);
