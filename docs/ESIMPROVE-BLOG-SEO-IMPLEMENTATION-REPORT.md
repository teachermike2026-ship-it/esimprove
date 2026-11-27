# ESIMPROVE: Blog and SEO Implementation Report

**Date:** 2026-11-26
**Environment:** localhost only. Nothing was deployed, published, uploaded or committed.

## 1. Summary

ESIMPROVE now has a complete, SEO-focused travel blog built into the existing Next.js app:

- **Ten full articles**, 1,250–1,700 words each (about 13,800 words in total). Every article has:
  - a short "quick answer" at the top;
  - a table of contents;
  - an FAQ;
  - cited official sources;
  - links into the shop.
- **Live catalog boxes inside the articles.** Prices, plan counts, networks and "cheapest for a week / month / best price per GB" picks come straight from the real catalog, so the articles never show a stale or invented price.
- **A rebuilt `/blog`** with:
  - a featured article and an "essential guides" strip;
  - topic categories and search;
  - paginated cards with original artwork, dates and reading times.
- **"Blog" in the main menu** (desktop and mobile).
- **A "Travel Guides & Insights" homepage section**, placed as the last section directly before the footer.
- **SEO wiring:**
  - unique titles and descriptions;
  - canonical URLs;
  - Open Graph and Twitter cards with generated 1200×630 PNG images;
  - BlogPosting, BreadcrumbList and FAQPage structured data;
  - sitemap entries;
  - the blog added to `llms.txt` and `llms-full.txt`.
- **Three old guide pages that duplicated new articles** now redirect permanently (308) to the fuller articles.
- **New analytics events** for the blog funnel, using the existing consent-gated tracker.

### Architecture decision

The project already had a database-backed blog with an admin editor, which had no published articles. The new articles are **code-managed editorial articles** in `lib/editorial/`, shown alongside any articles written in the admin. Reasons:

- **Live prices:** the articles can embed live catalog data, which a static HTML body in the database cannot.
- **No production database writes:** they deploy with the code, so nothing has to be written to the production database.
- **Review and testing:** they are version-controlled and checked by automated tests (no thin pages, no hard-coded prices, no broken links).

The admin editor keeps working: anything published there appears in the same listing, categories and sitemap, so future articles can be added without rebuilding. The admin now refuses a slug that a built-in article already uses.

## 2. New and modified files

### New files

| File | Purpose |
|---|---|
| `lib/editorial/types.ts` | Article and block types (text, tables, tips, live catalog boxes, CTA) |
| `lib/editorial/categories.ts` | The 5 blog categories |
| `lib/editorial/index.ts` | Article registry, reading time, table of contents, search, redirect map |
| `lib/editorial/articles/*.ts` | The 10 articles |
| `lib/blog-public.ts` | Merges editorial and admin articles: listing, categories, pagination, related |
| `lib/blog-seo.ts` | Blog metadata: English canonical, noindex for untranslated locales and non-production |
| `components/blog/article-art.tsx` | Original SVG artwork (10 themes, brand palette) |
| `components/blog/blog-card.tsx` | Article card |
| `components/blog/blog-search-form.tsx` | Search form (works without JavaScript) |
| `components/blog/editorial-article.tsx` | Article body renderer and live catalog boxes |
| `components/blog/editorial-article-page.tsx` | Article page, metadata and JSON-LD |
| `components/home/blog-section.tsx` | Homepage "Travel Guides & Insights" section |
| `app/og/blog/[slug]/route.tsx` | 1200×630 PNG social image per article |
| `tests/blog-editorial.test.ts` | 26 tests for the blog |

### Modified files

All modified files were backed up first to `.audit/backups/blog-before/` and `.audit/backups/`.

| File | Change |
|---|---|
| `app/blog/page.tsx` | Rebuilt landing page |
| `app/blog/category/[slug]/page.tsx` | Editorial and admin categories |
| `app/blog/[slug]/page.tsx` | Serves editorial articles; existing admin-article rendering kept; respects the site-wide noindex |
| `app/page.tsx` | Homepage blog section added before the footer |
| `components/site-header.tsx` | "Blog" link (desktop and mobile share the list) |
| `next.config.ts` | Permanent redirects for the 3 old guides, all 4 language prefixes |
| `lib/guides.ts` | Removed the 3 guides whose content moved into the blog |
| `lib/sitemap.ts` | Articles and categories added; blog URLs listed without hreflang |
| `lib/llms-txt.ts` | Blog section; short answers and FAQs in `llms-full.txt` |
| `lib/blog.ts` | Query for all published admin articles |
| `lib/analytics-web.ts` | 4 new event types |
| `components/analytics-tracker.tsx` | Blog page-view event; click tracking now also works on `/fr`, `/es`, `/ar` URLs |
| `app/admin/blog/actions.ts` | Refuses slugs used by built-in articles |
| `app/globals.css` | Blog, article and homepage-section styles (responsive) |
| `lib/i18n/dictionaries/en.ts`, `{fr,es,ar}/content.ts` | 46 new interface strings in all 4 languages |

## 3. Blog URLs and articles

| URL | Title | Category | Words |
|---|---|---|---|
| `/blog/japan-esim-travel-guide` | Japan eSIM: Complete Travel Guide (2026) | Destination Guides | 1,696 |
| `/blog/europe-esim-multiple-countries` | Europe eSIM: How to Stay Connected Across Multiple Countries | Destination Guides | 1,391 |
| `/blog/vietnam-esim-plans-coverage` | Vietnam eSIM: Plans, Coverage and Travel Tips | Destination Guides | 1,364 |
| `/blog/thailand-esim-travel-guide` | Thailand eSIM: Everything Travelers Need to Know | Destination Guides | 1,364 |
| `/blog/usa-esim-compare-data-plans` | USA eSIM: Compare Data Plans for Your Trip | Destination Guides | 1,346 |
| `/blog/turkey-esim-data-plans` | Turkey eSIM: Data Plans, Coverage and Activation Guide | Destination Guides | 1,250 |
| `/blog/how-much-data-do-i-need-travel` | How Much Mobile Data Do You Need When Travelling? | Travel Data & Planning | 1,332 |
| `/blog/esim-vs-physical-sim-vs-roaming` | eSIM vs Physical SIM vs Roaming: Which Is Better for Travel? | Travel eSIM Guides | 1,379 |
| `/blog/how-to-install-esim-iphone-android` | How to Install and Activate an eSIM on iPhone and Android | eSIM Tips & Tutorials | 1,356 |
| `/blog/whatsapp-with-esim-keep-number` | Can You Keep Your WhatsApp Number When Using an eSIM? | Connectivity & Technology | 1,340 |

Word counts exclude the live catalog boxes.

**Other routes:**
- `/blog`, with `?q=` search and `?page=` pagination;
- `/blog/category/{destination-guides, travel-esim-guides, esim-tips-tutorials, connectivity-technology, travel-data-planning}`;
- `/og/blog/{slug}`, the social image.

**Redirects (308, permanent):**

| Old URL | New URL |
|---|---|
| `/guides/how-much-data` | `/blog/how-much-data-do-i-need-travel` |
| `/guides/esim-vs-physical-sim` | `/blog/esim-vs-physical-sim-vs-roaming` |
| `/guides/whatsapp-and-dual-sim` | `/blog/whatsapp-with-esim-keep-number` |

The same redirects apply under `/fr`, `/es` and `/ar`.

**Kept as short help-centre pages:**
- `/guides/what-is-an-esim`
- `/guides/before-you-travel`
- `/guides/install-ios`
- `/guides/install-android`
- `/guides/qr-or-manual`
- `/guides/troubleshooting`

These are linked from the articles. The install article targets the broad query "how to install eSIM", while the iOS and Android guides stay as short support checklists.

**Word-count note:** the brief aimed for about 1,500–2,200 words. Nine of the ten articles are 1,250–1,400 words. I expanded them with route-specific coverage notes, troubleshooting and common mistakes, and stopped there rather than pad them.

## 4. Keyword and search-intent strategy

| Article | Primary keyword | Intent | Converts through |
|---|---|---|---|
| Japan | Japan eSIM | Commercial investigation | Live Japan box → `/destinations/japan` → plan pages |
| Europe | Europe eSIM | Commercial investigation | Live list of Europe regional plans → `/regions/europe` |
| Vietnam | Vietnam eSIM | Commercial investigation | Live box → `/destinations/vietnam`; multi-country list |
| Thailand | Thailand eSIM | Commercial investigation | Live box → `/destinations/thailand`; multi-country list |
| USA | USA eSIM | Commercial investigation | Live box → `/destinations/united-states`; USA & Canada list |
| Turkey | Turkey eSIM | Commercial investigation | Live box → `/destinations/turkey` |
| Data | how much data do I need for travel | Informational | Method → plan allowances → `/destinations` |
| Comparison | eSIM vs physical SIM vs roaming | Commercial investigation | Neutral comparison → `/destinations` |
| Install | how to install eSIM | How-to | Steps → `/compatibility` and help-centre guides |
| WhatsApp | WhatsApp with eSIM | Informational | Removes a purchase objection → `/destinations` |

Each article also lists secondary keywords, such as "eSIM for Japan", "Türkiye eSIM", "install eSIM iPhone" and "keep WhatsApp number abroad". They are used in its metadata and the on-page search.

**Not verified:** search volumes, keyword difficulty and ranking potential. No keyword tool or Search Console data was available (see section 5), and no figures were invented. The topic list follows your brief. Its priority is based on search intent and on where the catalog is strongest: Japan has 55 plans, the USA 38, Vietnam 39, Thailand 35 and Turkey 31.

## 5. Google Search Console findings

**Not accessible.** When I opened Search Console in the app's browser, Google showed its sign-in page. I did not sign in, because entering your password is something I must not do. There is no Search Console API integration or data export in the project; the Admin → SEO page only stores the verification token. So:

- I have not seen any queries, impressions, clicks, CTR or positions.
- No cannibalisation analysis based on real data was possible.
- Within the site itself, cannibalisation was avoided by removing the three duplicate guides and adding redirects.

**Next step:** once the site is live and has a few weeks of data, export the Performance report (queries and pages, last 3 months) or sign in yourself in the app's browser. Then I can re-prioritise topics, rewrite titles for high-impression, low-CTR queries, and target queries in positions 5–30.

## 6. Internal linking

Links run in both directions between the blog and the shop:

- **Articles to shop:**
  - Each destination article has a live catalog box linking to the destination page and to four specific plan pages (lowest price, cheapest 7+ days, cheapest 30+ days, best price per GB).
  - Multi-country articles list the matching regional plans live.
  - Every article ends with a call to action into the shop.
- **Shop pages linked from articles:**
  - `/compatibility` (from every article that mentions device requirements);
  - `/legal/refunds`;
  - the help-centre guides;
  - region pages.
- **Between articles:**
  - each article picks three related articles, filled from its own category if needed;
  - contextual links in the text with descriptive anchors.
- **Blog entry points:**
  - the header (desktop and mobile);
  - the homepage section;
  - the existing footer;
  - the category pages.

A crawl of all ten article pages found **121 distinct internal links, all resolving**. The only non-200 responses were expected: the language switcher's `/en/` redirects, and `/portal`, which redirects to login.

## 7. Structured data

Each article page has one JSON-LD `@graph` containing:

- **`BlogPosting`:**
  - headline, description and URL;
  - a 1200×630 image;
  - published and modified dates;
  - author: "ESIMPROVE Editorial Team" (an organisation; no invented person);
  - publisher: the ESIMPROVE organisation;
  - language, section, keywords, word count and reading time;
  - citations (the official source URLs).
- **`BreadcrumbList`:** Home → Blog → Category → Article.
- **`FAQPage`:** exactly the questions and answers visible on the page. A check against the rendered HTML confirmed every question appears on the page.

The blog landing page has `Blog` with a `blogPost` list, and category pages have `BreadcrumbList`.

There is **no Product schema and there are no ratings or reviews** on articles. Product and Offer data stays on the plan and destination pages, where it belongs.

Note: Google currently shows FAQ rich results only for a limited set of authoritative sites. The FAQ markup is still valid and accurate and helps other answer engines, but it may not produce an FAQ snippet in Google.

## 8. Multilingual status

| Item | Status |
|---|---|
| Article text | **English only.** No machine translations were published. |
| Blog interface (menus, labels, live boxes, homepage section) | Translated into French, Spanish and Arabic (46 new strings each) |
| `/fr/blog/...`, `/es/blog/...`, `/ar/blog/...` | Work for visitors with translated navigation and a notice that the article is in English. Marked `noindex, follow`, with the canonical pointing to the English URL. |
| hreflang | Blog pages declare only `en` and `x-default`. The sitemap lists blog URLs without language alternates, so search engines are not told an untranslated page is a translation. |
| Arabic (RTL) | Checked: the Arabic interface is right-to-left, the English article body is correctly left-to-right, and there is no horizontal overflow on mobile. |

**To add a reviewed translation later:** give the article a localized version and an hreflang entry in `lib/blog-seo.ts`, then remove the noindex for that language.

## 9. AI search optimisation

- **Answer-first layout:** every article opens with a two-to-four-sentence quick answer, uses question-style headings ("What is a Japan eSIM?", "Do EU roaming rules apply to visitors?"), and has a visible FAQ.
- **Sources:** every article cites official sources:
  - Apple, Google Pixel, Samsung, WhatsApp and Netflix help centres;
  - the European Commission;
  - the GSMA.
- **`llms.txt`** now has a Blog section: the landing page, 5 categories and 10 articles with descriptions.
- **`llms-full.txt`** now includes each article's quick answer and all FAQ answers, about 50 question-and-answer pairs. Prices are deliberately left out of this part, because the live destination list already carries them.
- **Unchanged:**
  - robots.txt and the AI crawler groups;
  - private paths (admin, account, orders, API) stay excluded;
  - localhost still sends `Disallow: /` and `noindex`.

## 10. Images and editorial quality

- **Artwork:** ten original illustrations drawn in code (SVG) in the ESIMPROVE palette, one theme per article (Japan sun and mountains, Europe star ring, Vietnam karsts, a US highway and so on). No stock or third-party images, so there are no licensing issues.
- **On cards and articles:** the SVG is inline, so there is no extra download and no layout shift (fixed 16:9 ratio). It is marked decorative on cards, because the heading already names the article, and carries a descriptive label on the article page.
- **For social networks** (which do not accept SVG): a generated 1200×630 PNG per article at `/og/blog/{slug}`, with the title and category, cached for a day.

### Accuracy safeguards

- **No hard-coded prices:** a test fails if any article text contains a dollar price. All prices come from the live catalog boxes.
- **No unverified claims:**
  - no claims to be "the best" provider;
  - no competitor comparisons;
  - no speed numbers beyond what plan names state, such as "10Mbps";
  - coverage statements are general and point to the plan page and the operator's coverage map.
- **Hedged, sourced facts:**
  - **Turkey's IMEI rules:** explained as mainly affecting phones used with Turkish SIM cards, with advice to check with an operator or the BTK regulator for long stays.
  - **Netflix data figures:** quoted from Netflix's own help centre.
- **Installation steps:** checked against the order page. Manual details appear as one `LPA:1$…` string, and the article explains how to read it.

## 11. Analytics funnel

All events are consent-gated, use the existing tracker, and are sent only after analytics consent.

| Requested event | Implemented as |
|---|---|
| blog_view | `blog_viewed` (new): blog landing, category and tag pages |
| article_view | `article_opened` (existing, kept to avoid duplicates) |
| related_article_click | `related_article_clicked` (new): related cards and in-text article links |
| destination_click | `blog_destination_clicked` (new): live boxes and in-text destination links |
| plan_view | `plan_viewed` (existing) |
| plan_select | `blog_plan_clicked` (new, plan link clicked from an article) and `cart_item_added` (existing) |
| begin_checkout | `checkout_started` (existing) |
| purchase | `order_created` (existing; no order IDs sent) |

**Fix:** click tracking for blog links now also works on `/fr`, `/es` and `/ar` pages. It previously compared paths without removing the language prefix.

## 12. Tests and build results

All of these were actually run:

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | Clean |
| ESLint | Clean (0 errors, 0 warnings) |
| New blog tests (`tests/blog-editorial.test.ts`) | **26 / 26 passed** |
| Full test suite (`vitest run`) | **440 / 440 passed** across 44 files (the previous 414 plus 26 new; none removed or weakened) |
| Production build (`next build`) | **Succeeded** (exit 0); `/blog`, `/blog/[slug]`, `/blog/category/[slug]` and `/og/blog/[slug]` built. Log: `.audit/build-blog.log` |

**Browser checks (localhost):**
- **Desktop 1366 px:** blog landing (featured article, essentials, grid, categories, search), the Japan article (table of contents, quick answer, live catalog box with real prices, FAQ, sources), the homepage section directly above the footer, and "Blog" in the header.
- **Mobile 375 px:** homepage section, article page, category page and the mobile menu (which includes Blog).
- **Bug found and fixed:** a horizontal overflow on mobile article pages (the page grid column did not shrink).
- **Arabic RTL** article page checked.

**HTTP and SEO checks:**
- 20 existing pages all load: home, destinations, plans, regions, cart, checkout, guides, compatibility, legal, login and localized pages. Checkout was only loaded; nothing was submitted.
- The old guide URLs return 308 to the new articles.
- Article metadata, canonical, robots, hreflang and `og:image` verified on English, French, search and category pages.
- The social image returns a valid 1200×630 PNG.

**Localhost protection:**
- `robots.txt` still says `Disallow: /`.
- Every blog page sends `noindex, nofollow, nocache` on localhost.
- **Bug found and fixed:** the first version of the blog metadata overrode this.
- **Pre-existing bug fixed:** the admin-article page had the same override problem.

## 13. Remaining issues and limitations

1. **Search Console data was not available** (sign-in required). Topic priorities and keywords are not validated with real query data.
2. **Search volumes and difficulty are unverified.** No keyword tool was used, and no numbers were invented.
3. **Articles are English only.** Reviewed French, Spanish and Arabic translations are the next content step. Category names are also English.
4. **Unknown blog URLs** (for example `/blog/nope`) show the "not found" page with `noindex`, but the HTTP status is 200 rather than 404. This is existing, site-wide behaviour (`/destinations/nope` does the same) caused by the root loading screen streaming before the 404 is known. Search engines treat it as a soft 404 because of the noindex. Fixing it means changing the root `loading.tsx`, which affects the whole site, so I left it for a separate change.
5. **`sitemap.xml` is empty on localhost by design** (non-production). The blog entries were verified through the sitemap builder in tests.
6. **Articles carry no review or rating markup**, and none should be added until there are genuine customer reviews.
7. **Nothing is indexed yet.** None of this is visible to Google, Bing or AI crawlers until the site is deployed, and I make no claim about indexing or rankings.

## 14. Confirmations

- All work remains local in `C:\Users\hp\esimprove`. Nothing was committed or pushed.
- **No deployment occurred.** Nothing was deployed, published or uploaded to Netlify, Neon or any other host. No production settings, data or environment variables were changed.
- **No real payment**, no Whop operation of any kind, no supplier (eSIM Access) purchase or API call, and no change to supplier balances, real orders or payment settings. The only external requests were read-only web searches for official documentation, and opening the Search Console sign-in page (no sign-in).
- No existing customer data was modified. The local database was only read.

## 15. Recommendations for the next SEO phase

1. **After deployment:**
   - submit `https://esimprove.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools;
   - run `scripts/indexnow-submit.ts --send` for the 10 article URLs.
2. **After 3–4 weeks of Search Console data:**
   - rewrite titles and descriptions for high-impression, low-CTR queries;
   - expand articles ranking in positions 5–30;
   - add articles for the queries the data reveals.
3. **Next articles, following the catalog's strengths:**
   - South Korea, China (including how apps work there), the UK, Indonesia/Bali, Mexico and the UAE;
   - "Japan & South Korea" and "USA & Canada" trip guides;
   - "eSIM for cruises" (explaining that maritime networks are not covered);
   - "Does my phone support eSIM?" (a broad query that feeds `/compatibility`).
4. **Reviewed translations:** French and Spanish first, starting with the Europe, Japan and WhatsApp articles. Then remove the noindex for those languages and add hreflang.
5. **Off-site authority:** genuine customer reviews once orders flow, answers on travel forums, and partnerships with travel bloggers. This is what makes AI assistants recommend a brand, and it cannot be done from code.
6. **Refresh dates honestly:** update `updatedAt` only when an article really changes; live prices update automatically.
