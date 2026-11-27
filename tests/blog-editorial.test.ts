/**
 * Editorial blog: content quality rules, routing, SEO wiring and the merge
 * with CMS articles. These guard against thin, duplicated or unsourced
 * content slipping in, and against blog URLs breaking.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/lib/db/client";
import { makeTestDb } from "./helpers/db";
import {
  EDITORIAL_ARTICLES,
  EDITORIAL_CATEGORIES,
  SUPERSEDED_GUIDES,
  articleInternalLinks,
  articlePlainText,
  articleToc,
  articleWordCount,
  getEditorialArticle,
  isEditorialSlug,
  MIN_INDEXABLE_CATEGORY_ARTICLES,
  destinationGuideArticles,
  editorialForDestination,
  editorialForGuide,
  editorialForRegion,
  matchesEditorialSearch,
  plainInline,
  readingMinutes,
} from "@/lib/editorial";
import { guides } from "@/lib/guides";
import { listBlogCards, listBlogCategories, paginate, relatedEditorial } from "@/lib/blog-public";
import { buildSitemap } from "@/lib/sitemap";
import { buildLlmsFullTxt, buildLlmsTxt } from "@/lib/llms-txt";
import { TRACKED_EVENT_TYPES } from "@/lib/analytics-web";
import { en } from "@/lib/i18n/dictionaries/en";
import { blogArticles, blogCategories, users } from "@/lib/db/schema";

const ROOT = process.cwd();

describe("editorial articles: content quality", () => {
  it("has ten articles with unique slugs, titles and descriptions", () => {
    expect(EDITORIAL_ARTICLES).toHaveLength(10);
    for (const field of ["slug", "title", "seoTitle", "description"] as const) {
      const values = EDITORIAL_ARTICLES.map((article) => article[field]);
      expect(new Set(values).size, field).toBe(values.length);
    }
  });

  it.each(EDITORIAL_ARTICLES.map((article) => [article.slug, article] as const))(
    "%s meets the editorial checklist",
    (_slug, article) => {
      expect(article.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(article.seoTitle.length).toBeLessThanOrEqual(60);
      expect(article.description.length).toBeGreaterThanOrEqual(110);
      expect(article.description.length).toBeLessThanOrEqual(160);
      expect(article.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article.updatedAt >= article.publishedAt).toBe(true);
      expect(article.art.alt.length).toBeGreaterThan(20);
      // Substantial guides, not thin pages.
      expect(articleWordCount(article)).toBeGreaterThanOrEqual(1200);
      expect(readingMinutes(article)).toBeGreaterThanOrEqual(5);
      // A logical outline with question-style or descriptive H2s.
      expect(articleToc(article).length).toBeGreaterThanOrEqual(5);
      expect(article.faq.length).toBeGreaterThanOrEqual(4);
      expect(article.quickAnswer.split(/\s+/).length).toBeLessThanOrEqual(90);
      // Credible external sources, over HTTPS.
      expect(article.references.length).toBeGreaterThanOrEqual(3);
      for (const reference of article.references) expect(reference.url).toMatch(/^https:\/\//);
      // Category exists; related articles exist and are not self-references.
      expect(EDITORIAL_CATEGORIES.some((category) => category.slug === article.category)).toBe(true);
      for (const slug of article.related) {
        expect(slug).not.toBe(article.slug);
        expect(getEditorialArticle(slug), slug).toBeDefined();
      }
      // Ends with a call to action into the commercial pages.
      expect(article.body.some((block) => typeof block !== "string" && "cta" in block)).toBe(true);
    },
  );

  it("never hard-codes prices in the prose (live catalog boxes carry prices)", () => {
    for (const article of EDITORIAL_ARTICLES) {
      expect(articlePlainText(article), article.slug).not.toMatch(/\$\s?\d/);
    }
  });

  it("does not claim to be the best provider or invent ratings", () => {
    for (const article of EDITORIAL_ARTICLES) {
      const text = articlePlainText(article).toLowerCase();
      expect(text, article.slug).not.toMatch(/esimprove is the best|best esim provider|#1 esim|rated \d/);
    }
  });

  it("links every destination article to its live destination data", () => {
    for (const slug of ["japan", "vietnam", "thailand", "united-states", "turkey"]) {
      const article = EDITORIAL_ARTICLES.find((item) => item.destinations.includes(slug))!;
      expect(article, slug).toBeDefined();
      expect(article.body.some((block) => typeof block !== "string" && "catalog" in block && block.catalog === slug)).toBe(true);
      expect(articleInternalLinks(article)).toContain(`/destinations/${slug}`);
    }
  });

  it("uses only internal links to routes that exist", () => {
    const staticRoutes = new Set(["/compatibility", "/destinations", "/plans", "/about", "/contact"]);
    for (const article of EDITORIAL_ARTICLES) {
      for (const link of articleInternalLinks(article)) {
        if (link.startsWith("/blog/")) {
          expect(isEditorialSlug(link.slice(6)), `${article.slug} → ${link}`).toBe(true);
        } else if (link.startsWith("/guides/")) {
          expect(guides.some((guide) => `/guides/${guide.slug}` === link), `${article.slug} → ${link}`).toBe(true);
        } else if (link.startsWith("/legal/")) {
          expect(existsSync(join(ROOT, "app", link, "page.tsx")), link).toBe(true);
        } else if (link.startsWith("/destinations/") || link.startsWith("/regions/")) {
          expect(link).toMatch(/^\/(destinations|regions)\/[a-z0-9-]+$/);
        } else {
          expect(staticRoutes.has(link), `${article.slug} → ${link}`).toBe(true);
        }
      }
    }
  });

  it("strips inline markup for plain text and search", () => {
    expect(plainInline("See [Japan](/destinations/japan) and **bold** `LPA:1$`")).toBe("See Japan and bold LPA:1$");
    const japan = getEditorialArticle("japan-esim-travel-guide")!;
    expect(matchesEditorialSearch(japan, "japan esim")).toBe(true);
    expect(matchesEditorialSearch(japan, "jápan")).toBe(true);
    expect(matchesEditorialSearch(japan, "whatsapp turkey")).toBe(false);
  });
});

describe("guides that moved into the blog", () => {
  it("redirects each superseded guide to an article and removes the old guide", () => {
    expect(SUPERSEDED_GUIDES).toEqual({
      "how-much-data": "how-much-data-do-i-need-travel",
      "esim-vs-physical-sim": "esim-vs-physical-sim-vs-roaming",
      "whatsapp-and-dual-sim": "whatsapp-with-esim-keep-number",
    });
    for (const oldSlug of Object.keys(SUPERSEDED_GUIDES)) {
      expect(guides.some((guide) => guide.slug === oldSlug)).toBe(false);
    }
    const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");
    expect(config).toContain("SUPERSEDED_GUIDES");
    expect(config).toMatch(/permanent:\s*true/);
  });

  it("keeps the remaining guides that are not duplicated", () => {
    expect(guides.map((guide) => guide.slug)).toEqual([
      "before-you-travel",
      "install-ios",
      "install-android",
      "qr-or-manual",
      "troubleshooting",
      "what-is-an-esim",
    ]);
  });
});

describe("blog listing, sitemap and llms.txt", () => {
  let handle: DatabaseHandle;
  beforeAll(async () => {
    handle = await makeTestDb();
  });
  afterAll(async () => handle.close());

  it("merges CMS articles with editorial ones and reserves editorial slugs", async () => {
    const db = handle.db;
    const [author] = await db.select({ id: users.id }).from(users).limit(1);
    expect(author).toBeDefined();
    await db.insert(blogCategories).values({ id: "cat-news", slug: "news", name: "News" });
    await db.insert(blogArticles).values([
      {
        id: "cms-1",
        slug: "cms-article",
        title: "A CMS article",
        excerpt: "Written in the admin",
        bodyHtml: "<p>hello world</p>",
        bodyText: "hello world",
        status: "published",
        publishedAt: new Date("2026-11-20T00:00:00Z"),
        authorId: author!.id,
        categoryId: "cat-news",
      },
      {
        // Same slug as an editorial article: must never shadow it.
        id: "cms-2",
        slug: "japan-esim-travel-guide",
        title: "Shadow",
        bodyHtml: "<p>x</p>",
        status: "published",
        publishedAt: new Date("2026-11-20T00:00:00Z"),
        authorId: author!.id,
      },
      {
        id: "cms-3",
        slug: "draft-article",
        title: "Draft",
        bodyHtml: "<p>x</p>",
        status: "draft",
        authorId: author!.id,
      },
    ]);

    const cards = await listBlogCards(db);
    expect(cards.map((card) => card.slug)).toContain("cms-article");
    expect(cards.filter((card) => card.slug === "japan-esim-travel-guide")).toHaveLength(1);
    expect(cards.find((card) => card.slug === "japan-esim-travel-guide")!.source).toBe("editorial");
    expect(cards.some((card) => card.slug === "draft-article")).toBe(false);
    expect(cards).toHaveLength(11);

    const filtered = await listBlogCards(db, { categorySlug: "destination-guides" });
    expect(filtered.every((card) => card.categorySlug === "destination-guides")).toBe(true);
    expect(filtered).toHaveLength(6);

    const searched = await listBlogCards(db, { query: "whatsapp" });
    expect(searched.map((card) => card.slug)).toEqual(["whatsapp-with-esim-keep-number"]);

    const categories = await listBlogCategories(db);
    expect(categories.find((category) => category.slug === "news")?.count).toBe(1);
    expect(categories.find((category) => category.slug === "destination-guides")?.count).toBe(6);

    const page = paginate(cards, 2, 9);
    expect(page.page).toBe(2);
    expect(page.items).toHaveLength(2);
    expect(paginate(cards, 99, 9).page).toBe(2);
  });

  it("lists every article and category in the sitemap once, English-only", async () => {
    const entries = await buildSitemap(handle.db);
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const article of EDITORIAL_ARTICLES) {
      const entry = entries.find((item) => item.url.endsWith(`/blog/${article.slug}`));
      expect(entry, article.slug).toBeDefined();
      expect(entry!.alternates).toBeUndefined();
    }
    const blogIndex = entries.find((item) => item.url.endsWith("/blog"));
    expect(blogIndex?.alternates).toBeUndefined();
    expect(urls.some((url) => url.endsWith("/blog/category/destination-guides"))).toBe(true);
    for (const oldSlug of Object.keys(SUPERSEDED_GUIDES)) {
      expect(urls.some((url) => url.endsWith(`/guides/${oldSlug}`))).toBe(false);
    }
  });

  it("adds the blog to llms.txt and the short answers to llms-full.txt", async () => {
    const short = await buildLlmsTxt(handle.db, "https://esimprove.com");
    expect(short).toContain("## Blog");
    expect(short).toContain("https://esimprove.com/blog/japan-esim-travel-guide");
    expect(short).toContain("https://esimprove.com/blog/category/destination-guides");
    expect(short).not.toContain("/admin");
    const full = await buildLlmsFullTxt(handle.db, "https://esimprove.com");
    expect(full).toContain("## Travel guides (blog)");
    expect(full).toContain("Q: Will WhatsApp work with a data-only eSIM?");
    expect(full).not.toMatch(/\]\(\//); // no relative markdown links leak through
  });
});

describe("blog wiring", () => {
  it("relates articles without duplicates or self-links", () => {
    for (const article of EDITORIAL_ARTICLES) {
      const related = relatedEditorial(article, 3);
      expect(related.length).toBe(3);
      expect(new Set(related.map((item) => item.slug)).size).toBe(3);
      expect(related.some((item) => item.slug === article.slug)).toBe(false);
    }
  });

  it("registers the blog analytics events", () => {
    for (const type of ["blog_viewed", "article_opened", "related_article_clicked", "blog_destination_clicked", "blog_plan_clicked"]) {
      expect(TRACKED_EVENT_TYPES).toContain(type);
    }
  });

  it("puts Blog in the main navigation and the guides section on the homepage before the footer", () => {
    const header = readFileSync(join(ROOT, "components/site-header.tsx"), "utf8");
    expect(header).toContain('{ href: "/blog", label: t("nav.blog") }');
    const home = readFileSync(join(ROOT, "app/page.tsx"), "utf8");
    // The blog section is the last element of the homepage (the footer follows in the layout).
    expect(home.trimEnd()).toMatch(/<HomeBlogSection \/>\s*<\/div>\s*\);\s*\}$/);
    expect(en["nav.blog"]).toBe("Blog");
    expect(en["home.blog.cta"]).toBe("Explore all articles");
  });

  it("keeps blog pages out of the index outside production and on untranslated locales", () => {
    const seo = readFileSync(join(ROOT, "lib/blog-seo.ts"), "utf8");
    expect(seo).toContain("noIndex ? { index: false, follow: false, nocache: true }");
    expect(seo).toContain('locale === "en"');
  });

  it("rejects CMS slugs that collide with editorial articles", () => {
    const actions = readFileSync(join(ROOT, "app/admin/blog/actions.ts"), "utf8");
    expect(actions).toContain("isEditorialSlug(slug)");
  });
});

describe("SEO audit: intent, cross-linking and thin pages", () => {
  let handle: DatabaseHandle;
  beforeAll(async () => {
    handle = await makeTestDb();
  });
  afterAll(async () => handle.close());

  it("targets guide intent so articles do not compete with destination pages", () => {
    for (const article of EDITORIAL_ARTICLES.filter((item) => item.destinations.length > 0 || item.regions?.length)) {
      expect(article.primaryKeyword, article.slug).toMatch(/ guide$/);
      expect(article.seoTitle.length, article.slug).toBeLessThanOrEqual(60);
    }
  });

  it("links destination, region and help pages back to their article", () => {
    for (const article of EDITORIAL_ARTICLES) {
      for (const slug of article.destinations) expect(editorialForDestination(slug)?.slug).toBe(article.slug);
      for (const slug of article.regions ?? []) expect(editorialForRegion(slug)?.slug).toBe(article.slug);
      for (const slug of article.expands ?? []) {
        expect(guides.some((guide) => guide.slug === slug), slug).toBe(true);
        expect(editorialForGuide(slug)?.slug).toBe(article.slug);
      }
    }
    expect(editorialForRegion("europe")?.slug).toBe("europe-esim-multiple-countries");
    expect(editorialForGuide("install-ios")?.slug).toBe("how-to-install-esim-iphone-android");
    for (const file of ["app/destinations/[slug]/page.tsx", "app/regions/[slug]/page.tsx", "app/guides/[slug]/page.tsx"]) {
      expect(readFileSync(join(ROOT, file), "utf8"), file).toContain("<EditorialGuideCard");
    }
    expect(TRACKED_EVENT_TYPES).toContain("blog_guide_link_clicked");
  });

  it("lists every destination guide on every article page", () => {
    expect(destinationGuideArticles().length).toBeGreaterThanOrEqual(6);
    const page = readFileSync(join(ROOT, "components/blog/editorial-article-page.tsx"), "utf8");
    expect(page).toContain("destinationGuideArticles()");
    expect(page).toContain('data-track="blog_destination_clicked"');
  });

  it("keeps single-article topics and out-of-range pages out of the index and sitemap", async () => {
    const counts = new Map<string, number>();
    for (const article of EDITORIAL_ARTICLES) counts.set(article.category, (counts.get(article.category) ?? 0) + 1);
    const urls = (await buildSitemap(handle.db)).map((entry) => entry.url);
    for (const category of EDITORIAL_CATEGORIES) {
      const listed = urls.some((url) => url.endsWith(`/blog/category/${category.slug}`));
      expect(listed, category.slug).toBe((counts.get(category.slug) ?? 0) >= MIN_INDEXABLE_CATEGORY_ARTICLES);
    }
    const categoryPage = readFileSync(join(ROOT, "app/blog/category/[slug]/page.tsx"), "utf8");
    expect(categoryPage).toContain("cards.length < MIN_INDEXABLE_CATEGORY_ARTICLES || page > pageCount");
    expect(readFileSync(join(ROOT, "app/blog/page.tsx"), "utf8")).toContain("noindex: Boolean(query) || page > pageCount");
  });

  it("dates the blog index in the sitemap by its newest article", async () => {
    const entries = await buildSitemap(handle.db);
    const blogIndex = entries.find((item) => item.url.endsWith("/blog"));
    const newest = EDITORIAL_ARTICLES.map((article) => article.updatedAt).sort().at(-1);
    expect((blogIndex?.lastModified as Date).toISOString().slice(0, 10)).toBe(newest);
  });
});
