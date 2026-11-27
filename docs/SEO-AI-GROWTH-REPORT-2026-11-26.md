# ESIMPROVE — Search & AI Discoverability Work (2026-11-26, localhost only)

Nothing deployed, committed or paid. Whop was not touched. The only external calls were the read-only eSIM Access package list (catalog refresh) and one read-only production database query. All changes are on `localhost`.

**Goal:** get ESIMPROVE found and recommended by Google/Bing **and** by AI assistants (ChatGPT, Claude, Perplexity, Gemini, Copilot), and turn those visitors into buyers.

## 1. What already existed
Next.js 16.4.6, 3,300 real eSIM Access plans across 244 destinations, real crypto checkout, four languages with hreflang.

Already in place:
- canonical URLs and per-page metadata;
- Organization, WebSite, Breadcrumb and Article structured data;
- dynamic sitemap and robots;
- Google Search Console token field (admin → SEO);
- GA4 behind cookie consent.

## 2. What was added

### AI crawler access (GEO / AIO)
- **`robots.txt`** names the search and AI crawlers explicitly:
  - search engines: Googlebot, Bingbot, Applebot, DuckDuckBot;
  - OpenAI: OAI-SearchBot, ChatGPT-User, GPTBot;
  - Anthropic: Claude-SearchBot, Claude-User, ClaudeBot;
  - Perplexity: PerplexityBot, Perplexity-User;
  - others: Google-Extended, Applebot-Extended, Meta-ExternalAgent, MistralAI-User, CCBot.

  They get the same private-path exclusions as everyone else (cart, checkout, orders, admin, API). Training crawlers are **allowed** because you asked for maximum AI visibility; remove them in `lib/robots.ts` to opt out. Preview and staging deployments still block everything.
- **`/llms.txt`** and **`/llms-full.txt`** (llmstxt.org format) are generated live from the catalog. They give AI assistants accurate, citable facts:
  - what ESIMPROVE sells, from $3.76;
  - data-only and device requirements;
  - USDT payment rules;
  - refunds and contact;
  - the top 40 destinations with plan counts and price ranges;
  - guides and policies;
  - in the full file, all 244 destinations with prices, data, validity, networks, 5G and best price per GB.

### Destination pages (SEO + AEO): the main buying pages
For each of the 244 destinations, everything below is computed from real catalog data, so nothing is invented and every figure can be checked against the plan list:
- **Title and description with real numbers**, e.g. "Spain eSIM — data plans from $3.78" and "Compare 17 prepaid Spain eSIM data plans from $3.78: 500 MB to 50 GB, valid 1 to 180 days…".
- **"At a glance" facts box:** price range, data range, validity, networks, 5G, phone number (data only), delivery.
- **"Which eSIM should I choose?" picks:**
  - lowest price;
  - best price per GB;
  - cheapest for 7+ days;
  - cheapest for 30+ days;
  - most data.

  Each pick links to its plan page.
- **Multi-country plans that also cover the country**, e.g. Europe plans on the Spain page. More choice, and internal links.
- **Six FAQ answers:** price, networks/5G, phone number and WhatsApp, when validity starts plus the activation deadline, delivery time, device compatibility.
- **Structured data:** `Product` + `AggregateOffer` (low/high price, offer count) and `FAQPage`.
- All text is translated into English, French, Spanish and Arabic.

### Plan pages (3,300)
- `Product` + `Offer` structured data: price, currency, data, validity, coverage and networks.
- **Honest availability:** `InStock` only when checkout would really accept the order (supplier ordering on and enough balance); otherwise `OutOfStock`. Locally it shows OutOfStock because supplier ordering is off and the balance is $0.
- Titles fixed (no more "Spain Spain 3GB 30Days"). Descriptions now state data, days, price and networks.

### Honesty fixes that also protect rankings and AI trust
- The supplier's **999 GB "unlimited" sentinel** (8 Japan plans) now shows as **"Unlimited (fair use applies…)"**. It is excluded from "best price per GB" and "most data".
- "Top-up available" was removed earlier (top-ups are not sold). The local catalog was refreshed: 3,085 plans updated, no price changes.

### Guides (content funnel)
Four new guides that answer the questions travellers ask AI assistants:
- *What is an eSIM, and how does a travel eSIM work?*
- *eSIM vs local SIM vs roaming*
- *Keep WhatsApp and your phone number with a travel eSIM*
- *How much data do I need?*

All guides now have Article and Breadcrumb structured data, link to every other guide, and include a "browse plans" button.

### Sitemap
- All 3,300 plans (previously only 500).
- 244 destinations, regions, all 9 guides, legal pages and blog.
- **hreflang alternates for all four languages** on every entry.

### Measuring AI traffic and the funnel
- New traffic source **"ai"** in admin analytics. Detected by referrer (chatgpt.com, claude.ai, perplexity.ai, gemini.google.com, copilot.microsoft.com and others), or by `utm_source=chatgpt.com` when the assistant strips the referrer. Gemini is no longer counted as Google search.
- Funnel events now fire, consent-gated, with generic paths only and never order IDs:
  1. destination_viewed
  2. plan_viewed
  3. cart_viewed
  4. checkout_started
  5. order_created
- They also fire on French, Spanish and Arabic pages, which previously recorded nothing.

### Search-engine verification (ready, inactive until you provide codes)
- Google: existing admin field (Admin → SEO → Search Console token).
- Bing: `BING_SITE_VERIFICATION`. Yandex: `YANDEX_SITE_VERIFICATION`.
- **IndexNow** (Bing, Yandex, Seznam, Naver): key served at `/indexnow-key.txt` (key generated in `.env.local`). Submission script `scripts/indexnow-submit.ts` refuses localhost and noindex sites, and only runs after you deploy.

## 3. Tests
- New `tests/ai-discoverability.test.ts` covers:
  - robots AI groups;
  - AI referral classification and utm fallback;
  - destination facts, including the unlimited sentinel;
  - llms.txt contents (no secrets);
  - sitemap uniqueness and hreflang.
- Full suite: 414/414 passed.

## 4. What I need from you (accounts; none needed for localhost)
These only work once the site is live on esimprove.com:

1. **Google Search Console**: add the property for `https://esimprove.com`, choose "HTML tag", and send me the `content` value. I'll put it in Admin → SEO. After deploy, submit `https://esimprove.com/sitemap.xml`.
2. **Bing Webmaster Tools**: add the site (or import from Search Console), choose the meta tag, and send me the `msvalidate.01` value. Bing also powers ChatGPT search and Copilot results, so this one matters for AI traffic.
3. **Google Analytics 4** (optional): create a property and send me the Measurement ID (`G-…`). It loads only after cookie consent.
4. **Not needed:** IndexNow (no account), llms.txt, robots.txt.

## 5. Not done, and why
- **No deployment:** your instruction. None of this is visible to Google or AI crawlers until you deploy, and robots on localhost correctly says "Disallow: /".
- **No competitor comparisons or "best eSIM" rankings:** these need verified competitor data, and unverified claims would hurt trust with Google and AI systems. Our own plan comparisons, the picks on each destination page, are done.
- **No mass AI-written articles or thousands of thin pages:** destination pages carry unique, data-driven content instead.
- **Guide bodies are English-only** (titles are translated). Translating them well is the next content step.
- **Off-site authority** (reviews, travel sites, Reddit and forum answers, backlinks) is what makes AI assistants *recommend* a brand. It can't be done from code. Start after launch with real customers and reviews.

## 6. Final results
- TypeScript: clean. ESLint: clean.
- Tests: **414 / 414 passed** (43 files).
- Production build (isolated copy): **OK**. New routes /llms.txt, /llms-full.txt and /indexnow-key.txt built.
- Browser (localhost): Spain destination page shows the facts box, 4 picks, 6 FAQs, Product+FAQPage JSON-LD and hreflang for 4 languages. Plan page has Product/Offer JSON-LD (OutOfStock while the supplier is off). /llms.txt serves live catalog facts.
