# Esimprove Phase 4 — SEO, Blog/CMS, and First-Party Analytics Report

Created: 2026-11-06
Repository: `C:\Users\hp\esimprove`
Scope: professional SEO management, complete blog/CMS with a public blog, Google Search Console
readiness, and a real first-party analytics dashboard.
Status: **implementation and local verification complete; no production deploy performed.**

---

## 1. Executive summary

Phase 4 is implemented and passes the local verification gates. The application now has:

- Database-backed global SEO settings, per-page metadata, canonical URLs, Open Graph/Twitter
  metadata, JSON-LD, a database-driven sitemap, a production-safe robots policy, Google Search
  Console verification, and an SEO health audit.
- A complete blog CMS with drafts, publish/unpublish, future scheduling, categories, tags,
  search/filter, author attribution, featured images with required alt text, per-article SEO, and
  server-side HTML sanitization.
- Public blog pages at `/blog`, `/blog/[slug]`, `/blog/category/[slug]`, and `/blog/tag/[slug]`
  that expose only published, due articles.
- A first-party, consent-based analytics system stored in PostgreSQL. It collects anonymous events
  through `POST /api/track`, exposes overview, geography, pages, games, activities, and
  sources/devices reports at `/admin/analytics`, excludes admin/internal/bot traffic, honours
  DNT/GPC, and deletes data outside the retention window.

All of this is Netlify/serverless-compatible. No local filesystem uploads, background process, or
third-party analytics provider is required. GA4 is optional and rendered only when a valid
measurement ID is saved and the deploy is indexable.

**This report does not claim production readiness.** Search Console ownership and indexing,
production analytics evidence, media hosting, legal review, a scheduler, and an actual Netlify
deploy remain external blockers. See `NETLIFY_DEPLOYMENT_BLOCKERS.md`.

---

## 2. What works

### 2.1 SEO management

| Capability | Implementation |
| --- | --- |
| Global settings | `seo_settings` table, edited at `/admin/seo`; site name, homepage title/description, title template, canonical base, default OG image/title/description, logo, favicon, organization name/URL/same-as, default robots, index default, GSC token/property, optional GA4 ID |
| Metadata | Root `generateMetadata`, `buildPageMeta`, title template, absolute canonical URLs, Open Graph and Twitter cards |
| Structured data | Site-level `WebSite` + `Organization` JSON-LD in the root layout; `WebPage` metadata JSON-LD; `Article` and `BreadcrumbList` JSON-LD on articles |
| GSC readiness | Verification token saved in the database and rendered as the Google verification meta tag |
| Sitemap | `/sitemap.xml` built from static public pages, regions, destinations, plans, published/due articles, and categories that have published articles |
| Robots | `/robots.txt` disallows everything in demo/preview/staging; in production allows public pages and disallows admin, portal, login, register, cart, checkout, orders, and API routes |
| Health audit | `/admin/seo` reports missing/duplicate titles, missing descriptions, missing canonical URLs, missing featured images, and missing image alt text for published articles |

Demo/preview/staging remain a hard `noindex` rail: robots disallow `/`, sitemap output is empty,
and optional GA4 does not render.

### 2.2 Blog and CMS

- Admin routes: `/admin/blog`, `/admin/blog/new`, `/admin/blog/[id]/edit`,
  `/admin/blog/categories`, `/admin/blog/tags`.
- Article lifecycle: draft, published, scheduled; publish/unpublish actions; scheduled articles
  are promoted only when `scheduled_at` is due.
- Content: title, slug, excerpt, sanitized body HTML, plain-text body for search/SEO, category,
  tags, author (the acting administrator), featured image URL, required alt text, per-article SEO
  title/description/canonical/OG image/robots.
- Validation: slug normalization and strict lowercase-hyphen format, uniqueness enforced by the
  database, required title/body, future date required for scheduling, alt text required when a
  featured image is present.
- Search/filter: admin list filters by status and search text; public list supports category and
  tag pages.
- Sanitization: in-house allowlist sanitizer (`lib/sanitize.ts`) strips scripts, styles, iframes,
  event handlers, comments, and unsafe URLs; links receive `rel="noopener noreferrer"`.
- Media policy: the CMS accepts HTTPS-hosted image URLs only. There is no local filesystem upload
  path, which is deliberate for Netlify's ephemeral/read-only function filesystem.

### 2.3 Public blog

- `/blog` lists published, due articles (9 per page), with category and tag navigation. It does
  not provide text search; the admin list provides status, text, and category/tag filters.
- `/blog/[slug]` renders a published, due article with metadata, canonical URL, Article and
  Breadcrumb JSON-LD, featured image, author, dates, category, and tags.
- Draft, scheduled-future, and otherwise unpublished slugs return 404 publicly.
- `/blog/category/[slug]` and `/blog/tag/[slug]` list only published, due articles.

### 2.4 First-party analytics

Collection:

- `POST /api/track` accepts a batch of up to 10 validated events per request.
- Event types include page views, plan/destination/article interactions, search, CTA clicks, and
  game open/start/complete/exit events.
- Anonymous visitor and session IDs are generated client-side and HMAC-hashed server-side. Raw
  IDs, IP addresses, user-agent strings, and fingerprints are not stored.
- Country is read only from coarse platform headers (`x-country`, `x-nf-country`, `cf-ipcountry`,
  `x-vercel-ip-country`); missing headers remain unknown and are never inferred.
- Device, browser, and OS are derived as coarse labels from the request user agent and are not
  stored as the raw string.
- Consent is required in the client before any event is sent. DNT and GPC are honoured. The
  `NEXT_PUBLIC_ANALYTICS_DISABLED=true` kill switch returns 204 before storage.
- Admin/internal/bot traffic is recorded as internal and excluded from all reports.
- Cross-origin submissions return 403; invalid JSON/payloads return 400; bodies over 32 KB return
  413; valid batches return 202; GET returns 405.
- Per-session request limiting (120 events/minute) is enforced.

Reporting (`/admin/analytics`, admin-only):

- Tabs: Overview, Geography, Pages, Games, Activities, Sources & devices.
- Date ranges: today, yesterday, last 7/30/90 days, and custom ranges with a previous-period
  comparison.
- Metrics: visitors, sessions, page views, new/returning visitors, average session duration,
  pages per session, bounce rate, trend chart, and period deltas.
- Geography: country sessions/visitors with percentages; `Unknown` is shown honestly.
- Pages: entries, exits, page views, visitors, page-type filter, country filter.
- Games: generic `gameId` ranking by opened/started/completed/exited, completion rate, average
  duration, per-game detail, pages, events, and trend. The current site has no games section, so
  the tab shows an honest empty state until game events exist.
- Activities: non-page-view event breakdown and recent activity.
- Sources: direct/search/social/referral classification, referrer hosts, devices, browsers, and
  operating systems.
- Empty states: when no consented public traffic exists, the dashboard shows zeros and an
  explanation. No demo analytics are fabricated.

### 2.5 Scheduling and retention

- `POST /api/jobs/run` (authenticated with `INTERNAL_JOB_SECRET`) now runs:
  - existing outbox/fulfillment jobs,
  - due scheduled blog publication (`publishDueScheduledArticles`),
  - analytics retention cleanup (`cleanupAnalytics`, default 90 days, clamped to 7–365).
- No scheduler is defined in this repository. Scheduled publishing and retention require an
  external scheduler or an explicitly configured Netlify scheduled function. This is documented
  as blocker B-09.

### 2.6 Netlify compatibility

- All persistence is PostgreSQL; no local files or in-memory state are required.
- API routes use `runtime = "nodejs"` and dynamic rendering.
- Image handling accepts hosted HTTPS URLs; no upload directory is used.
- `/api/track` is a short database write with bounded payloads.
- `/api/jobs/run` remains within the synchronous-function model for the current workload; long
  work must move to an approved queue if it grows.

---

## 3. Verification evidence

All commands were run locally on 2026-11-06 against the working tree.

| Gate | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | Pass, no output |
| ESLint | `npx eslint .` | Pass with 0 errors and 6 `@next/next/no-img-element` warnings (remote CMS images use `<img>` intentionally) |
| Tests | `npm test` | Pass: 17 files / 175 tests |
| Phase 4 tests | included above | 54 new tests: blog/SEO 20, analytics 21, access/API 13 |
| Production build | `npm run build` | Pass; all Phase 4 routes compiled |
| Route smoke | `npm run smoke` | 64 PASS, 0 FAIL, 26 BLOCKED (authenticated checks require `SMOKE_AUTH_COOKIE`) |

Phase 4 test coverage includes:

- slug normalization/validation and HTML sanitization (scripts, handlers, unsafe URLs, iframes);
- SEO settings round-trip, absolute metadata, title template, article/breadcrumb/site JSON-LD;
- public visibility rules for published, draft, scheduled, and future-published articles;
- category/tag queries and database-level slug uniqueness;
- due scheduled publication and idempotency;
- admin article actions: authorization, sanitization, duplicate slugs, scheduling validation,
  required alt text, publish/unpublish;
- sitemap inclusion/exclusion and robots policies for noindex and production modes;
- SEO health audit counts and warnings;
- analytics payload validation, batch caps, metadata redaction, HMAC-only storage;
- overview/session/visitor metrics, geography, pages, sources/devices, activities, games;
- internal traffic exclusion and honest empty states;
- retention cleanup;
- range resolution, referrer classification, user-agent parsing, page typing, formatting;
- admin guards for unauthenticated, customer, pending-2FA, and administrator sessions;
- SEO/CMS action authorization and successful administrator mutations;
- `/api/track` method/origin/DNT/GPC/JSON/payload/internal behaviours.

Smoke-test additions: `/blog`, `/robots.txt`, `/sitemap.xml`, admin blog routes, and the
`/api/track` contract checks.

---

## 4. External configuration required

Nothing below is automated by the code. Each item needs owner action.

| Item | Where | Required before claiming |
| --- | --- | --- |
| Apply `0005_seo_blog_analytics.sql` | `npm run db:migrate` with the production migration URL | Phase 4 routes work at all |
| Public origin | `SITE_URL` | Canonical URLs, sitemap, robots, absolute links |
| Canonical base | Admin → SEO & CMS (`seo_settings`) | Sitemap/canonical output; takes precedence over `SITE_URL` |
| GSC verification | Admin → SEO & CMS, then Google Search Console | Ownership verification and sitemap submission |
| Sitemap submission/indexing | Google Search Console | Any indexing claim |
| Optional GA4 | Admin → SEO & CMS | Third-party analytics (not used for the first-party dashboard) |
| Analytics HMAC secret | `ANALYTICS_HASH_SECRET` | Stable anonymous hashing per context |
| Analytics retention | `ANALYTICS_RETENTION_DAYS` (optional, default 90) | Retention policy |
| Tracking kill switch | `NEXT_PUBLIC_ANALYTICS_DISABLED` (optional) | Emergency disable |
| Scheduled publishing and retention | External scheduler or Netlify scheduled function calling `POST /api/jobs/run` | Automatic publishing/cleanup |
| Blog media | External HTTPS host/CDN | Editor image workflow |
| Privacy/cookie review | Legal review | Analytics consent/retention compliance |

`ANALYTICS_ENABLED` is a legacy/reserved flag and must remain `false`; the preflight rejects it.
It does not control first-party analytics.

---

## 5. Security and privacy properties

- All admin pages and Server Actions call `requireAdmin` server-side; customers are redirected to
  `/portal`, unauthenticated users to `/login`, and pending-2FA sessions to `/login/2fa`.
- Blog HTML is sanitized on save; public rendering also uses the sanitized value.
- Canonical/OG/image URLs are validated as HTTP(S) where applicable; unsafe protocols are rejected.
- Analytics stores only HMAC hashes and coarse context; no raw IP, user agent, fingerprint, email,
  password, card number, or nested metadata.
- Sensitive metadata keys are dropped by the validator; values are length-limited and primitive.
- Consent is affirmative; DNT/GPC and the kill switch prevent storage.
- Admin/portal/checkout/internal/bot traffic is excluded from reports.
- Analytics reports are `noindex, nofollow`.
- Existing Phase 1–3 protections (auth, 2FA, rate limiting, webhook verification, encryption,
  N-07 supplier restrictions) were not weakened.

---

## 6. Limitations and non-claims

- No Netlify deploy, production database, production secret, or production traffic exists. Local
  build/test success is not deployment evidence.
- Saving a GSC token does not verify ownership; publishing an article does not guarantee indexing.
- Analytics accuracy, consent behaviour, geography headers, and retention are proven locally, not
  in production. The dashboard is empty until real consented traffic arrives.
- The site currently has no games section; the Games tab is an honest empty state.
- Country data depends on platform headers; absent headers show `Unknown`, not invented countries.
- Scheduled publishing and retention cleanup do not run automatically without an external
  scheduler (B-09).
- Blog media must be hosted externally; the CMS does not provide uploads.
- Legal/privacy review is outstanding, including analytics consent and retention (B-07).
- Browser, responsive, console/hydration, and accessibility checks were not executed (B-08).
- The six `<img>` ESLint warnings are intentional for arbitrary remote CMS images; they are not
  errors and were not suppressed.
- This report does not authorize a production launch.

---

## 7. Files changed (Phase 4)

New:

- `db/migrations/0005_seo_blog_analytics.sql`
- `lib/seo.ts`, `lib/blog.ts`, `lib/sanitize.ts`, `lib/sitemap.ts`, `lib/robots.ts`,
  `lib/blog-schedule.ts`, `lib/analytics-web.ts`
- `app/admin/seo/page.tsx`, `app/admin/seo/actions.ts`, `app/admin/seo/seo-form.tsx`
- `app/admin/blog/page.tsx`, `app/admin/blog/article-form.tsx`, `app/admin/blog/actions.ts`,
  `app/admin/blog/new/page.tsx`, `app/admin/blog/[id]/edit/page.tsx`,
  `app/admin/blog/categories/page.tsx`, `app/admin/blog/tags/page.tsx`
- `app/admin/analytics/page.tsx`
- `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `app/blog/category/[slug]/page.tsx`,
  `app/blog/tag/[slug]/page.tsx`
- `app/api/track/route.ts`
- `components/analytics-charts.tsx`, `components/analytics-tracker.tsx`
- `tests/phase4-blog-seo.test.ts`, `tests/phase4-analytics.test.ts`,
  `tests/phase4-access.test.ts`

Modified:

- `lib/db/schema.ts` (SEO, blog, and analytics tables/types)
- `app/layout.tsx` (dynamic metadata, GSC verification, optional GA4, site JSON-LD, tracker,
  consent banner)
- `app/robots.ts`, `app/sitemap.ts` (delegate to testable policies)
- `app/api/jobs/run/route.ts` (scheduled publishing + analytics retention)
- `app/admin/layout.tsx` (Blog and SEO navigation)
- `app/globals.css` (Phase 4 styles)
- `components/search-form.tsx` (`data-analytics-search`)
- `scripts/smoke-test.mjs` (Phase 4 routes and API contracts)
- `.env.example` (analytics variables)
- `NETLIFY_DEPLOYMENT_GUIDE.md`, `NETLIFY_ENVIRONMENT_VARIABLES.md`,
  `NETLIFY_PRODUCTION_CHECKLIST.md`, `NETLIFY_DEPLOYMENT_BLOCKERS.md`

Related report: `FINAL_PHASES_1-5_AUDIT_AND_REMEDIATION_REPORT.md` (Phase 4 addendum).
