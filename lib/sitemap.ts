import type { MetadataRoute } from "next";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  blogArticles,
  blogArticleTags,
  blogCategories,
  blogTags,
} from "@/lib/db/schema";
import { getDestinations, getPlans, getRegions } from "@/lib/catalog";
import { loadSeoSettings } from "@/lib/seo";
import { siteUrl } from "@/lib/config";
import { absoluteLocalizedUrl, languageAlternates } from "@/lib/i18n/config";
import { guides } from "@/lib/guides";
import { EDITORIAL_ARTICLES, EDITORIAL_CATEGORIES, MIN_INDEXABLE_CATEGORY_ARTICLES } from "@/lib/editorial";

/** Blog content is English-only: no hreflang alternates (see lib/blog-seo.ts). */
function isBlogPath(path: string): boolean {
  return path === "/blog" || path.startsWith("/blog/");
}

/**
 * Indexable static routes. Keep this list in sync with real page routes under
 * app/; `tests/sitemap-routes.test.ts` fails if a path has no route.
 */
export const SITEMAP_STATIC_PATHS = [
  "",
  "/destinations",
  "/regions",
  "/plans",
  "/search",
  "/about",
  "/contact",
  "/compatibility",
  "/guides",
  "/legal/terms",
  "/legal/privacy",
  "/legal/refunds",
  "/legal/payments",
  "/legal/esim-service",
  "/legal/notice",
  "/legal/cookies",
  "/legal/faq",
  "/legal/accessibility",
  "/privacy/request",
  "/blog",
] as const;

/** hreflang alternates for a path in every supported language (+ x-default). */
export function sitemapAlternates(path: string, base: string): { languages: Record<string, string> } {
  const languages: Record<string, string> = Object.fromEntries(
    languageAlternates.map((descriptor) => [descriptor.htmlLang, absoluteLocalizedUrl(path || "/", descriptor.code, base)]),
  );
  languages["x-default"] = absoluteLocalizedUrl(path || "/", "en", base);
  return { languages };
}

export async function buildSitemap(db: Database): Promise<MetadataRoute.Sitemap> {
  const [regions, destinations, plans, settings] = await Promise.all([
    getRegions(db),
    getDestinations(db),
    // Every published plan: each is a real, purchasable product page.
    getPlans(db, { limit: 20_000 }),
    loadSeoSettings(db),
  ]);
  const base = (settings.canonicalBase || siteUrl).replace(/\/+$/, "");
  const now = new Date();

  const staticPaths = SITEMAP_STATIC_PATHS;
  const latestEditorialUpdate = new Date(
    `${EDITORIAL_ARTICLES.map((article) => article.updatedAt).sort().at(-1)}T00:00:00Z`,
  );
  const editorialSlugs = new Set(EDITORIAL_ARTICLES.map((article) => article.slug));
  const editorialCategorySlugs = new Set(EDITORIAL_CATEGORIES.map((category) => category.slug));

  const [publishedArticles, categoriesWithArticles, tagsWithArticles] = await Promise.all([
    db
      .select({
        slug: blogArticles.slug,
        updatedAt: blogArticles.updatedAt,
      })
      .from(blogArticles)
      .where(
        and(
          eq(blogArticles.status, "published"),
          isNotNull(blogArticles.publishedAt),
          lte(blogArticles.publishedAt, now),
        ),
      ),
    db
      .select({
        slug: blogCategories.slug,
        lastUpdated: sql<string | Date | null>`max(${blogArticles.updatedAt})`,
      })
      .from(blogCategories)
      .innerJoin(
        blogArticles,
        and(
          eq(blogArticles.categoryId, blogCategories.id),
          eq(blogArticles.status, "published"),
          isNotNull(blogArticles.publishedAt),
          lte(blogArticles.publishedAt, now),
        ),
      )
      .groupBy(blogCategories.slug),
    db
      .select({
        slug: blogTags.slug,
        lastUpdated: sql<string | Date | null>`max(${blogArticles.updatedAt})`,
      })
      .from(blogTags)
      .innerJoin(blogArticleTags, eq(blogArticleTags.tagId, blogTags.id))
      .innerJoin(
        blogArticles,
        and(
          eq(blogArticleTags.articleId, blogArticles.id),
          eq(blogArticles.status, "published"),
          isNotNull(blogArticles.publishedAt),
          lte(blogArticles.publishedAt, now),
        ),
      )
      .groupBy(blogTags.slug),
  ]);

  return [
    ...staticPaths.map((path) => ({
      url: `${base}${path}`,
      ...(isBlogPath(path) ? {} : { alternates: sitemapAlternates(path, base) }),
      lastModified: path === "/blog" ? latestEditorialUpdate : now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...regions.map((region) => ({
      url: `${base}/regions/${region.slug}`,
      alternates: sitemapAlternates(`/regions/${region.slug}`, base),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...destinations.map((destination) => ({
      url: `${base}/destinations/${destination.slug}`,
      alternates: sitemapAlternates(`/destinations/${destination.slug}`, base),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...plans.map((plan) => ({
      url: `${base}/plans/${plan.slug}`,
      alternates: sitemapAlternates(`/plans/${plan.slug}`, base),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...guides.map((guide) => ({
      url: `${base}/guides/${guide.slug}`,
      alternates: sitemapAlternates(`/guides/${guide.slug}`, base),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...EDITORIAL_ARTICLES.map((article) => ({
      url: `${base}/blog/${article.slug}`,
      lastModified: new Date(`${article.updatedAt}T00:00:00Z`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // Matches the category page's robots rule: thin topics are noindex and left out.
    ...EDITORIAL_CATEGORIES.filter(
      (category) =>
        EDITORIAL_ARTICLES.filter((article) => article.category === category.slug).length >=
        MIN_INDEXABLE_CATEGORY_ARTICLES,
    ).map((category) => ({
      url: `${base}/blog/category/${category.slug}`,
      lastModified: new Date(
        `${EDITORIAL_ARTICLES.filter((article) => article.category === category.slug)
          .map((article) => article.updatedAt)
          .sort()
          .at(-1)}T00:00:00Z`,
      ),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...publishedArticles.filter((article) => !editorialSlugs.has(article.slug)).map((article) => ({
      url: `${base}/blog/${article.slug}`,
      lastModified: article.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...categoriesWithArticles.filter((category) => !editorialCategorySlugs.has(category.slug)).map((category) => ({
      url: `${base}/blog/category/${category.slug}`,
      lastModified: category.lastUpdated ? new Date(category.lastUpdated) : now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...tagsWithArticles.map((tag) => ({
      url: `${base}/blog/tag/${tag.slug}`,
      lastModified: tag.lastUpdated ? new Date(tag.lastUpdated) : now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
