-- 0006_legal_compliance.sql
-- Phase 5: legal configuration, cookie consent evidence, privacy requests,
-- email unsubscribe architecture, third-party inventory, retention settings,
-- accessibility reviews, and asset licensing register.
--
-- The migration intentionally seeds no business identity, registration number,
-- address, telephone number, VAT number, or legal conclusion. Owner-provided
-- fields default to empty strings and the admin readiness register marks them
-- as requiring owner input.

-- Contact-form submissions are stored as support tickets. Anonymous visitors
-- have no user row, so the reply address must be recorded on the ticket.
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS requester_email text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS legal_settings (
  id text PRIMARY KEY DEFAULT 'legal_global',
  legal_name text NOT NULL DEFAULT '',
  trading_name text NOT NULL DEFAULT '',
  registration_number text NOT NULL DEFAULT '',
  registered_address text NOT NULL DEFAULT '',
  business_country text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  support_email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  legal_contact text NOT NULL DEFAULT '',
  privacy_contact text NOT NULL DEFAULT '',
  jurisdiction text NOT NULL DEFAULT '',
  vat_number text NOT NULL DEFAULT '',
  tax_details text NOT NULL DEFAULT '',
  minimum_age integer,
  minimum_age_note text NOT NULL DEFAULT '',
  terms_version text NOT NULL DEFAULT 'draft-2026-11-07',
  privacy_version text NOT NULL DEFAULT 'draft-2026-11-07',
  refunds_version text NOT NULL DEFAULT 'draft-2026-11-07',
  cookies_version text NOT NULL DEFAULT 'draft-2026-11-07',
  accessibility_version text NOT NULL DEFAULT 'draft-2026-11-07',
  terms_effective_date date,
  privacy_effective_date date,
  refunds_effective_date date,
  cookies_effective_date date,
  accessibility_effective_date date,
  terms_review_status text NOT NULL DEFAULT 'needs_legal_review',
  privacy_review_status text NOT NULL DEFAULT 'needs_legal_review',
  refunds_review_status text NOT NULL DEFAULT 'needs_legal_review',
  cookies_review_status text NOT NULL DEFAULT 'needs_legal_review',
  accessibility_review_status text NOT NULL DEFAULT 'needs_legal_review',
  cookie_consent_version text NOT NULL DEFAULT '2026-11-07',
  marketing_consent_version text NOT NULL DEFAULT '2026-11-07',
  refund_review_notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_document_versions (
  id text PRIMARY KEY,
  document_key text NOT NULL,
  version text NOT NULL,
  effective_date date,
  status text NOT NULL DEFAULT 'needs_legal_review',
  summary text NOT NULL DEFAULT '',
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS legal_document_versions_key_version_unique
  ON legal_document_versions (document_key, version);
CREATE INDEX IF NOT EXISTS legal_document_versions_key_idx
  ON legal_document_versions (document_key);

CREATE TABLE IF NOT EXISTS cookie_consents (
  id text PRIMARY KEY,
  subject_hash text NOT NULL,
  consent_version text NOT NULL,
  analytics boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  action text NOT NULL DEFAULT 'custom',
  country_code text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cookie_consents_subject_unique
  ON cookie_consents (subject_hash);
CREATE INDEX IF NOT EXISTS cookie_consents_updated_at_idx
  ON cookie_consents (updated_at);

CREATE TABLE IF NOT EXISTS consent_events (
  id text PRIMARY KEY,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  purpose text NOT NULL,
  version text NOT NULL,
  granted boolean NOT NULL,
  surface text NOT NULL DEFAULT '',
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_events_subject_idx
  ON consent_events (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS consent_events_purpose_idx
  ON consent_events (purpose, created_at);
CREATE INDEX IF NOT EXISTS consent_events_created_at_idx
  ON consent_events (created_at);

CREATE TABLE IF NOT EXISTS privacy_requests (
  id text PRIMARY KEY,
  reference text NOT NULL,
  request_type text NOT NULL,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_verification',
  identity_status text NOT NULL DEFAULT 'unverified',
  verification_token_hash text,
  verified_at timestamptz,
  resolution text NOT NULL DEFAULT '',
  rejection_reason text NOT NULL DEFAULT '',
  admin_notes text NOT NULL DEFAULT '',
  handled_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS privacy_requests_reference_unique
  ON privacy_requests (reference);
CREATE INDEX IF NOT EXISTS privacy_requests_status_idx
  ON privacy_requests (status, created_at);
CREATE INDEX IF NOT EXISTS privacy_requests_email_idx
  ON privacy_requests (email);

CREATE TABLE IF NOT EXISTS email_subscriptions (
  id text PRIMARY KEY,
  email text NOT NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'subscribed',
  source text NOT NULL DEFAULT '',
  consent_version text NOT NULL DEFAULT '',
  unsubscribe_token_hash text NOT NULL,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  unsubscribe_reason text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_subscriptions_email_unique
  ON email_subscriptions (email);
CREATE UNIQUE INDEX IF NOT EXISTS email_subscriptions_token_unique
  ON email_subscriptions (unsubscribe_token_hash);
CREATE INDEX IF NOT EXISTS email_subscriptions_status_idx
  ON email_subscriptions (status);

CREATE TABLE IF NOT EXISTS asset_licenses (
  id text PRIMARY KEY,
  asset_key text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  location text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  license_name text NOT NULL DEFAULT '',
  license_url text NOT NULL DEFAULT '',
  attribution text NOT NULL DEFAULT '',
  commercial_use text NOT NULL DEFAULT 'unknown',
  redistribution text NOT NULL DEFAULT 'unknown',
  status text NOT NULL DEFAULT 'needs_verification',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS asset_licenses_key_unique
  ON asset_licenses (asset_key);

CREATE TABLE IF NOT EXISTS legal_third_parties (
  id text PRIMARY KEY,
  service_key text NOT NULL,
  provider text NOT NULL,
  purpose text NOT NULL,
  data_shared text NOT NULL DEFAULT '',
  cookies text NOT NULL DEFAULT '',
  runs_before_consent boolean NOT NULL DEFAULT false,
  necessary boolean NOT NULL DEFAULT false,
  optional boolean NOT NULL DEFAULT false,
  international_transfer text NOT NULL DEFAULT 'unknown',
  configuration_notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'not_verified',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS legal_third_parties_key_unique
  ON legal_third_parties (service_key);

CREATE TABLE IF NOT EXISTS data_retention_settings (
  id text PRIMARY KEY,
  data_key text NOT NULL,
  label text NOT NULL,
  retention_days integer,
  basis text NOT NULL DEFAULT 'owner_decision_required',
  automated boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS data_retention_key_unique
  ON data_retention_settings (data_key);

CREATE TABLE IF NOT EXISTS accessibility_reviews (
  id text PRIMARY KEY,
  area text NOT NULL,
  status text NOT NULL DEFAULT 'not_verified',
  wcag_level text NOT NULL DEFAULT 'AA',
  findings text NOT NULL DEFAULT '',
  checked_at timestamptz,
  checked_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS accessibility_reviews_area_unique
  ON accessibility_reviews (area);

CREATE TABLE IF NOT EXISTS legal_readiness_items (
  id text PRIMARY KEY,
  item_key text NOT NULL,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'legal',
  status text NOT NULL DEFAULT 'needs_owner_information',
  owner text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS legal_readiness_items_key_unique
  ON legal_readiness_items (item_key);

-- Current-state singleton. Empty business fields are intentional: the owner
-- must supply verified details before the legal pages can be published.
INSERT INTO legal_settings (id) VALUES ('legal_global')
ON CONFLICT (id) DO NOTHING;

INSERT INTO legal_document_versions
  (id, document_key, version, status, summary)
VALUES
  ('legalver_privacy_draft', 'privacy', 'draft-2026-11-07', 'needs_legal_review',
   'Draft privacy policy generated from the implemented data flows. Requires owner business details and legal review.'),
  ('legalver_terms_draft', 'terms', 'draft-2026-11-07', 'needs_legal_review',
   'Draft terms of service. Requires owner business details, jurisdiction, supplier terms, and legal review.'),
  ('legalver_refunds_draft', 'refunds', 'draft-2026-11-07', 'needs_legal_review',
   'Draft refund policy. Refund eligibility rules require owner and legal approval.'),
  ('legalver_cookies_draft', 'cookies', 'draft-2026-11-07', 'needs_legal_review',
   'Draft cookie policy matching the implemented consent manager and optional GA4 integration.'),
  ('legalver_accessibility_draft', 'accessibility', 'draft-2026-11-07', 'not_verified',
   'Accessibility statement. Automated checks and manual keyboard review require owner verification.')
ON CONFLICT (document_key, version) DO NOTHING;

INSERT INTO legal_third_parties
  (id, service_key, provider, purpose, data_shared, cookies, runs_before_consent,
   necessary, optional, international_transfer, configuration_notes, status)
VALUES
  ('thirdparty_netlify', 'netlify_hosting', 'Netlify (production hosting; not active in local demo)',
   'Serves the website and records standard request metadata in production.',
   'IP address, request headers, and standard server logs handled by the hosting provider.',
   'Hosting provider cookies are not set by this application.', true, true, false,
   'Depends on the production hosting region and provider terms.',
   'Production only. Local development runs on the owner''s machine. Confirm a data processing agreement before launch.',
   'external_configuration_required'),
  ('thirdparty_database', 'postgresql_database', 'PostgreSQL database (owner-managed or managed service)',
   'Stores accounts, orders, payments, consent evidence, privacy requests, and audit records.',
   'Account, order, support, consent, and privacy-request data as described in the privacy policy.',
   'None.', true, true, false, 'Depends on where the owner hosts PostgreSQL.',
   'Local PGlite is used for the demo. Production requires a managed PostgreSQL instance and a verified region.',
   'external_configuration_required'),
  ('thirdparty_ga4', 'google_analytics_4', 'Google Analytics 4 (optional)',
   'Optional traffic measurement when the owner configures a GA4 measurement ID.',
   'Page views, approximate location derived by Google, device/browser information, and identifiers set by Google.',
   'May set _ga and _ga_* cookies. Not loaded until analytics consent is granted.',
   false, false, true, 'Likely transfers data outside the visitor''s country. Confirm Google terms and transfer mechanism.',
   'Not configured by default. If configured in admin SEO settings, the loader waits for analytics consent and honours withdrawal.',
   'optional_not_configured'),
  ('thirdparty_payments', 'payment_processor', 'Payment processor (not configured)',
   'Would process live card payments after owner selection and contracting.',
   'Would receive payment and billing details. The current build uses a local mock payment page only.',
   'Provider-dependent. Not present in the local demo.', false, false, false, 'Unknown until a provider is contracted.',
   'No live payment processor is configured. Do not enable live payments before a provider, contract, and legal review exist.',
   'not_configured'),
  ('thirdparty_supplier', 'esim_supplier', 'eSIM supplier (not configured)',
   'Would provision eSIM plans after owner selection and contracting.',
   'Would receive order and activation data required to provision an eSIM.',
   'None in this application.', false, false, false, 'Unknown until a supplier is contracted.',
   'No supplier is connected. All catalogue and fulfillment records are demo data.',
   'not_configured'),
  ('thirdparty_email', 'email_provider', 'Email provider (disabled)',
   'Would deliver transactional order email and optional marketing email.',
   'Email address and message content.', 'None in this application.', false, false, false,
   'Unknown until an email provider is contracted.',
   'Email sending is disabled. The local logger does not send messages.',
   'not_configured')
ON CONFLICT (service_key) DO NOTHING;

INSERT INTO asset_licenses
  (id, asset_key, name, category, location, source_url, license_name, license_url,
   attribution, commercial_use, redistribution, status, notes)
VALUES
  ('asset_manrope', 'font_manrope', 'Manrope variable font', 'font', 'app/fonts/manrope-latin.woff2',
   'https://github.com/sharanda/manrope', 'SIL Open Font License 1.1',
   'https://openfontlicense.org/open-font-license-official-text/',
   'Not required by the license.', 'allowed', 'allowed_with_license', 'verified',
   'Self-hosted with next/font/local. Keep the OFL license text with the font asset.'),
  ('asset_brand_mark', 'brand_mark', 'Esimprove brand mark', 'logo', 'components/brand-mark.tsx',
   '', 'Project asset', '', 'Internal project asset.', 'unknown', 'unknown', 'needs_verification',
   'Confirm ownership and trademark clearance with the owner before launch.'),
  ('asset_icons', 'inline_icons', 'Inline interface icons', 'icon', 'components/icons.tsx',
   '', 'Project asset', '', 'Internal project asset.', 'unknown', 'unknown', 'needs_verification',
   'Confirm that all inline icons were created for the project or are licensed for commercial use.'),
  ('asset_world_map', 'world_map_svg', 'Decorative world map SVG', 'illustration', 'components/home/world-map.tsx',
   '', 'Project asset', '', 'Decorative, aria-hidden illustration.', 'unknown', 'unknown', 'needs_verification',
   'Confirm the source and commercial-use rights for the map path data.'),
  ('asset_app_icon', 'app_icon', 'Application icon and favicon', 'icon', 'app/icon.svg; app/favicon.ico',
   '', 'Project asset', '', 'Internal project asset.', 'unknown', 'unknown', 'needs_verification',
   'Confirm the icon was created for this project.'),
  ('asset_qrcode_library', 'qrcode_library', 'qrcode npm package', 'library', 'package.json',
   'https://www.npmjs.com/package/qrcode', 'MIT', 'https://github.com/soldair/node-qrcode/blob/master/LICENSE',
   'Not required by the license.', 'allowed', 'allowed_with_license', 'verified',
   'Used to render activation QR codes at runtime. Dependency license should remain in the lockfile.'),
  ('asset_manrope_license', 'font_manrope_license', 'Manrope OFL license text', 'font_license', 'app/fonts/OFL.txt',
   'https://github.com/sharanda/manrope', 'SIL Open Font License 1.1',
   'https://openfontlicense.org/open-font-license-official-text/',
   'License text retained with the font.', 'allowed', 'allowed_with_license', 'verified',
   'Bundled license text. Verify the copyright line matches the downloaded font release.')
ON CONFLICT (asset_key) DO NOTHING;

INSERT INTO data_retention_settings
  (id, data_key, label, retention_days, basis, automated, enabled, notes)
VALUES
  ('retention_accounts', 'accounts', 'Customer account profile',
   730, 'proposed_operational_default', false, false,
   'Proposed: remove or anonymise inactive accounts after 24 months. Owner and legal approval required.'),
  ('retention_orders', 'orders', 'Orders, payments, invoices, and refunds',
   2555, 'proposed_recordkeeping_default', false, false,
   'Proposed: retain financial records for 7 years. The statutory period depends on jurisdiction and requires owner/legal confirmation.'),
  ('retention_support', 'support', 'Support tickets and messages',
   730, 'proposed_operational_default', false, false,
   'Proposed: retain closed support records for 24 months. Owner approval required.'),
  ('retention_consent', 'consent', 'Consent records and consent evidence',
   1095, 'proposed_accountability_default', false, false,
   'Proposed: retain consent evidence for 36 months so choices can be demonstrated. Legal review required.'),
  ('retention_privacy_requests', 'privacy_requests', 'Privacy and deletion requests',
   1095, 'proposed_accountability_default', false, false,
   'Proposed: retain request records and audit evidence for 36 months. Legal review required.'),
  ('retention_analytics_events', 'analytics_events', 'Raw first-party analytics events',
   395, 'technical_default', true, true,
   'Existing Phase 4 cleanup uses a bounded raw-event window. Confirm the final period with the owner.'),
  ('retention_analytics_aggregates', 'analytics_aggregates', 'Aggregated analytics sessions and visitors',
   730, 'technical_default', true, true,
   'Aggregates contain HMAC identifiers and coarse country/device data. Confirm the final period with the owner.'),
  ('retention_email_subscriptions', 'email_subscriptions', 'Email marketing subscription status',
   30, 'proposed_operational_default', false, false,
   'Proposed: retain unsubscribe evidence for 30 days after unsubscribe, then delete or anonymise. Owner approval required.')
ON CONFLICT (data_key) DO NOTHING;

INSERT INTO accessibility_reviews
  (id, area, status, wcag_level, findings)
VALUES
  ('a11y_public', 'public_pages', 'not_verified', 'AA',
   'Automated and manual review required. The site includes skip links, semantic landmarks, and visible focus styles, but full WCAG 2.2 AA conformance has not been certified.'),
  ('a11y_forms', 'forms_and_checkout', 'not_verified', 'AA',
   'Labels, error announcements, and keyboard paths require manual verification with assistive technology.'),
  ('a11y_admin', 'admin_dashboard', 'not_verified', 'AA',
   'Admin tables, forms, and status messages require a keyboard and screen-reader review.'),
  ('a11y_consent', 'cookie_consent', 'not_verified', 'AA',
   'The consent dialog uses a native dialog element, labelled controls, and equal-access reject/save actions. Manual focus and screen-reader testing is pending.'),
  ('a11y_content', 'content_and_images', 'not_verified', 'AA',
   'Meaningful images require alt text. Blog featured images require alt text before publication. Decorative inline graphics are hidden from assistive technology where implemented.')
ON CONFLICT (area) DO NOTHING;

INSERT INTO legal_readiness_items
  (id, item_key, label, category, status, owner, notes)
VALUES
  ('readiness_business_identity', 'business_identity', 'Verified legal business name, registration, address, and contacts', 'business', 'needs_owner_information', 'Owner',
   'No business identity is invented. Add verified details in the business information form.'),
  ('readiness_jurisdiction', 'jurisdiction', 'Governing law and customer jurisdictions confirmed', 'legal', 'needs_legal_review', 'Owner + legal',
   'The demo can be accessed internationally. Governing law and mandatory consumer protections require legal advice.'),
  ('readiness_privacy', 'privacy_policy', 'Privacy policy reviewed against actual data flows', 'legal', 'needs_legal_review', 'Owner + legal',
   'The draft describes the implemented first-party analytics, HMAC identifiers, consent evidence, and retention controls.'),
  ('readiness_terms', 'terms_of_service', 'Terms of service reviewed against supplier and payment contracts', 'legal', 'needs_legal_review', 'Owner + legal',
   'Supplier, payment, coverage, and activation terms are not contracted in this build.'),
  ('readiness_refunds', 'refund_policy', 'Refund eligibility and timelines approved', 'legal', 'needs_owner_information', 'Owner + legal',
   'Refund rules depend on actual supplier and payment-provider capabilities. No refund promise is invented.'),
  ('readiness_cookies', 'cookie_policy', 'Cookie policy reviewed against the consent manager and GA4 configuration', 'legal', 'needs_legal_review', 'Owner + legal',
   'GA4 is optional and consent-gated. No marketing pixels are installed.'),
  ('readiness_age', 'age_safeguards', 'Intended audience and minimum-age position approved', 'legal', 'needs_owner_information', 'Owner + legal',
   'No date of birth is collected. The minimum age remains unset until the owner and legal adviser decide the position.'),
  ('readiness_third_parties', 'third_party_contracts', 'Data processing agreements and transfer mechanisms verified', 'privacy', 'needs_owner_information', 'Owner',
   'Hosting, database, GA4, payment, supplier, and email providers require contracts before production.'),
  ('readiness_retention', 'retention_approval', 'Retention periods approved and cleanup scheduled', 'privacy', 'needs_owner_information', 'Owner + legal',
   'The table contains proposed defaults, not legal conclusions.'),
  ('readiness_accessibility', 'accessibility_audit', 'Manual accessibility audit completed', 'accessibility', 'not_verified', 'Owner + reviewer',
   'Keyboard, screen-reader, zoom, contrast, and reduced-motion checks must be performed by a qualified reviewer.'),
  ('readiness_assets', 'asset_licensing', 'Every asset has verified commercial-use rights', 'content', 'needs_verification', 'Owner',
   'The asset register records the font, icons, brand mark, map, and QR library. Unresolved rows must be closed.'),
  ('readiness_unsubscribe', 'unsubscribe_delivery', 'Unsubscribe link delivery tested with a real email provider', 'email', 'external_configuration_required', 'Owner',
   'The token architecture and public unsubscribe page exist, but email sending is disabled in this build.'),
  ('readiness_deletion', 'deletion_workflow', 'Identity verification and retention-aware deletion approved', 'privacy', 'needs_legal_review', 'Owner + legal',
   'The workflow never deletes financial records automatically. Admin approval and out-of-band identity verification are required.'),
  ('readiness_migration', 'production_migration', 'Phase 5 migration applied to a disposable PostgreSQL database and backed up', 'technical', 'not_verified', 'Technical',
   'Apply db/migrations/0006_legal_compliance.sql to a disposable PostgreSQL instance before production.'),
  ('readiness_env', 'production_configuration', 'Production environment variables and Netlify configuration reviewed', 'technical', 'external_configuration_required', 'Owner',
   'No deployment, DNS change, or production secret change is performed by this task.')
ON CONFLICT (item_key) DO NOTHING;
