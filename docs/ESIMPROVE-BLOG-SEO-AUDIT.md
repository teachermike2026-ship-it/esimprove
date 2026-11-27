# ESIMPROVE blog: pre-deployment SEO quality audit

Date: 2026-11-26 · Scope: the 10 editorial articles, `/blog`, category pages, and the shop pages they link to · Environment: localhost only.

Nothing was deployed, committed or pushed. There was no Whop activity, no payment and no supplier purchase.

**What this audit can't tell you.** Passing tests and a clean audit don't prove that articles will rank or sell. There's no Search Console data yet: the site isn't live and the account needs the owner's sign-in. Search volumes and keyword difficulty were not measured. No ranking or traffic estimate appears anywhere in this report.

## Summary

| Area | Status before | What changed |
|---|---|---|
| Search intent and keywords | Each destination article targeted the same main keyword as its shop page | Articles now target guide intent, and shop pages and articles link to each other in clear roles |
| Destination accuracy | One claim could not be verified (USA, 911) | Reworded. Other checked facts are listed below |
| Internal linking | Shop pages linked to no articles; the USA guide had one inbound link | Destination, region and help pages now link to their articles; every article links to all destination guides |
| Duplicates and canonicals | Out-of-range pages and four one-article topic pages were indexable | Those pages are now `noindex, follow` and the topic pages are out of the sitemap |
| Schema and sitemap | Valid, but the brand name was inconsistent and `/blog` showed today's date as its lastmod | Brand name comes from site config; `/blog` lastmod is the newest article's date |
| Conversion | The first shop button sat at the end of each destination article | A button with the live plan count and starting price now sits under the quick answer |

## 1. Search intent and keyword targeting

**Finding: keyword cannibalisation.** `/destinations/japan` has the title "Japan eSIM — data plans from $3.76" and the H1 "Japan eSIM plans". The Japan article's main keyword was also "Japan eSIM", and the same overlap existed for Thailand, Vietnam, Turkey, the USA and Europe. With nothing to tell the two pages apart, Google may rank the article for a buying query, or swap between the two.

**Fix:**
- **Separate roles.** The shop page is the commercial page; the article is the research page.
- **Main keywords.** Each destination article's main keyword is now "{Country} eSIM guide", with the bare "{Country} eSIM" kept as a secondary keyword. These keywords appear only in the article schema; they don't change the visible text.
- **Search titles.** These now say "Guide":
  - "USA eSIM Guide: How to Compare Plans for Your Trip"
  - "Turkey eSIM Guide: Networks, Coverage & Activation"
  - "Vietnam eSIM Guide: Networks, Coverage & Travel Tips"

  Japan already said "Guide". Thailand's title ("What Travelers Need to Know") is already informational.
- **Links in both directions.** Articles link to the shop page with "{Country} eSIM plans", and shop pages link back to the article (see section 3).
- **Unchanged:** H1s and web addresses. They match your brief, and changing addresses before launch gains nothing.

**Remaining risks to watch in Search Console after launch:**
- **Two install pages.** The install article and the short help pages `/guides/install-ios` and `/guides/install-android` answer similar questions. The help pages now point to the full article. If Search Console shows Google ranking the short pages for "how to install eSIM", redirect them to the article.
- **Year in the title.** The Japan title contains "(2026)". Update it, and `updatedAt`, each year, or remove the year.
- **Spelling.** The Thailand H1 uses US spelling ("Travelers"); the article text uses British spelling. I kept the title as written in your brief.

## 2. Accuracy of destination information

| Claim | Article | Result |
|---|---|---|
| Netflix data use: up to 1 GB/h in SD and 3 GB/h in HD on the High setting | How much data, USA | **Matches** the Netflix Help Center page, read today |
| A data-only plan "cannot make emergency calls… phones can typically still dial 911 using any available network" | USA | **Not verified.** The FCC page refused automated access. **Reworded** to make no promise about emergency calls: the plan has no voice service, so keep the home SIM active and don't rely on the eSIM for calls |
| Japan has four national operators (docomo, KDDI au, SoftBank, Rakuten Mobile) | Japan | Consistent with my knowledge; not re-checked against a source today |
| AIS and True are Thailand's main operators; True merged with DTAC in 2023 | Thailand | Consistent with my knowledge; not re-checked |
| Viettel, Vinaphone and MobiFone are Vietnam's largest operators | Vietnam | Consistent with my knowledge; not re-checked |
| Turkcell, Vodafone Türkiye and Türk Telekom (formerly Avea) | Turkey | Consistent with my knowledge; not re-checked |
| Turkey requires phones to be registered by IMEI when used long-term with a Turkish SIM | Turkey | Kept deliberately vague (no day count); readers are told to check with an operator or the regulator, BTK |
| AT&T, Verizon and T-Mobile are the US national networks; US iPhone 14 and later models have no SIM tray | USA | Consistent with my knowledge; not re-checked |
| EU "roam like at home" covers the EU plus Iceland, Liechtenstein and Norway, and protects EU/EEA customers only | Europe | Consistent with the EU pages the article cites; not re-checked today |

- **Live plan data.** Prices, plan counts, networks and multi-country plans render from the catalog, never from the article text, and every block on every destination article rendered with data:
  - Japan: 55 plans from $3.76.
  - USA: the USA & Canada and North America plans.
  - Europe: six regional plans.
  - Thailand and Vietnam: their South-East Asia plans.
- **Before launch:** have someone who knows each destination read the coverage notes by region (Ha Giang, Cappadocia valleys and so on). They're written as cautious, general guidance, but they were not checked against operator coverage maps.

## 3. Internal linking

**Before**, counting only links inside the page (menus and footer excluded):
- The destination pages for Japan, Thailand, Vietnam, Turkey and the USA linked to no article.
- `/regions/europe` and the six `/guides` pages linked to no article either.
- The USA article had one inbound link, from the blog index; Japan, Thailand, Vietnam and Turkey had two each.
- The four general articles never linked to a destination article, except "how much data", which linked to Japan and Europe.

**After:**
- **Destination pages** show a "Travel guide" card under the main banner, linking to their article: Japan, Thailand, Vietnam, Türkiye and the United States.
- **`/regions/europe`** links to the Europe article.
- **Help pages:**
  - `/guides/install-ios`, `install-android`, `qr-or-manual` and `troubleshooting` link to the install article.
  - `what-is-an-esim` links to eSIM vs SIM vs roaming.
  - `before-you-travel` links to how much data.
- **Every article** ends with a "Destination guides" list, so each destination guide gains nine inbound links.
- **Language and tracking.** Article titles and excerpts shown on French, Spanish and Arabic pages are marked `lang="en"`. Clicks are tracked as the new consented event `blog_guide_link_clicked`.

## 4. Duplicate content and canonicals

**Already correct, re-verified:**
- **Canonicals and translations:**
  - English is the canonical; `/fr`, `/es` and `/ar` copies of blog pages canonicalise to the English URL.
  - Those copies are `noindex, follow`, and hreflang lists only `en` and `x-default`.
- **Search results** (`?q=`) are `noindex`, with the canonical set to `/blog`.
- **Old guides** redirect with 308.
- **Admin blog:** the admin can't publish an article at one of the ten articles' addresses.
- **Sitemap:** no duplicates among its 3,593 URLs, generated from the local database.

**Fixed:**
- **Out-of-range pages.** `/blog?page=99` (and the same on category pages) showed the last page under its own canonical, creating a duplicate. These pages are now `noindex`.
- **Thin topic pages.** Four of the five topics contain one article each, so their pages are thin. They're now `noindex, follow` and left out of the sitemap. A topic becomes indexable automatically once it has two or more articles (`MIN_INDEXABLE_CATEGORY_ARTICLES`). Destination Guides, with six articles, stays indexed.

**Remaining (site-wide, not changed):**
- **Soft 404s.** Unknown addresses return status 200 with a "not found" page, because of the root `loading.tsx`.
- **Sitemap dates.** Every non-blog URL in the sitemap uses the current time as its `lastmod`, so Google is likely to ignore those dates.

## 5. Article schema and sitemap

- **Schema checked.** `BlogPosting` has a headline, description, URL, `mainEntityOfPage`, a 1200×630 image, published and modified dates, language, section, keywords, word count, author, publisher and citations. `BreadcrumbList` matches the visible breadcrumb, and the `FAQPage` questions match the FAQ on the page. No Product schema and no ratings on articles.
- **Brand name fixed.** The blog's schema and social tags said "ESIMPROVE", while the rest of the site's schema uses "Esimprove" from site config. The blog now uses the same configured name.
- **Sitemap date fixed.** `/blog` now uses the newest article's date as its lastmod instead of the current time.
- **FAQ rich results.** Since 2023, Google shows FAQ rich results mainly for authoritative government and health sites. The FAQ markup is harmless, but don't expect FAQ snippets.
- **Publisher logo.** It's included only when a logo URL is set in **Admin → SEO settings**. Set one before launch.

## 6. Conversion from reader to customer

- **Shop button moved up.** On destination articles the only shop button came at the end, about 1,300–1,700 words in. A "See {Country} eSIM plans" button now sits directly under the quick answer, with "N plans from $X" taken live from the catalog and tracked as `blog_destination_clicked`.
- **Funnel to measure after launch:** `blog_viewed` → `blog_destination_clicked` / `blog_plan_clicked` → `checkout_started` → `order_created`. Judge each article by this chain, not by page views.
- **Next step, not done:**
  - Add a short comparison block to the general articles (WhatsApp, install, how much data) using the visitor's likely destination.
  - Or add a destination picker.

  Both need product decisions.

## Found but not fixed (site-wide)

**Page weight.** The full translation dictionary (1,564 keys, about 97 KB of raw JSON) is sent to the browser on every page through `I18nProvider`. An article page is about 265 KB of HTML, of which about 211 KB is React data embedded in the page. Splitting the dictionary so client components receive only the keys they use would cut every page's size, which helps loading speed (Core Web Vitals). It affects the whole site, so it should be a separate, tested change.

## Verification

Results are in `.audit/seo-audit-*.log`:
- **Type check (`tsc`):** see `.audit/seo-audit-tsc.log`.
- **Lint (ESLint):** see `.audit/seo-audit-lint.log`.
- **Tests:** full suite in `.audit/seo-audit-tests.log`. Five new tests in `tests/blog-editorial.test.ts` cover the keyword rule, the two-way links, the guide list on every article, thin topics and out-of-range pages, and the `/blog` sitemap date.
- **Production build:** `.audit/seo-audit-build.log`.
- **Browser checks:**
  - Desktop and mobile (375 px), in Arabic RTL, on the Japan article, `/destinations/japan` and `/guides/install-ios`: no horizontal overflow.
  - Fixed during the check: green-on-green text on the new shop button, wrong word order in the Arabic price line, and an arrow pointing the wrong way in RTL.

## Files changed

- **Articles and data:**
  - `lib/editorial/types.ts`, adding `regions` and `expands`.
  - `lib/editorial/index.ts`, adding the lookup helpers and the topic threshold.
  - Seven article files: keywords, search titles, the shop links, and the USA 911 wording.
- **Pages and components:**
  - `components/blog/editorial-guide-card.tsx` (new).
  - `components/blog/editorial-article-page.tsx`.
  - `app/destinations/[slug]/page.tsx`, `app/regions/[slug]/page.tsx`, `app/guides/[slug]/page.tsx`.
  - `app/blog/page.tsx`, `app/blog/category/[slug]/page.tsx`.
- **SEO and analytics:** `lib/sitemap.ts`, `lib/blog-seo.ts`, `lib/analytics-web.ts`.
- **Translations and styles:**
  - i18n: seven keys in each of `en.ts` and `fr`/`es`/`ar` `content.ts`.
  - `app/globals.css`.
- **Tests:** `tests/blog-editorial.test.ts`.
- **Backups:** `.audit/backups/seo-audit/`.
