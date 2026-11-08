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
  "/legal/cookies",
  "/legal/faq",
  "/legal/accessibility",
  "/privacy/request",
  "/blog",
] as const;

export async function buildSitemap(db: Database): Promise<MetadataRoute.Sitemap> {
  const [regions, destinations, plans, settings] = await Promise.all([
    getRegions(db),
    getDestinations(db),
    getPlans(db, { limit: 500 }),
    loadSeoSettings(db),
  ]);
  const base = (settings.canonicalBase || siteUrl).replace(/\/+$/, "");
  const now = new Date();

  const staticPaths = SITEMAP_STATIC_PATHS;

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
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...regions.map((region) => ({
      url: `${base}/regions/${region.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...destinations.map((destination) => ({
      url: `${base}/destinations/${destination.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...plans.map((plan) => ({
      url: `${base}/plans/${plan.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...publishedArticles.map((article) => ({
      url: `${base}/blog/${article.slug}`,
      lastModified: article.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...categoriesWithArticles.map((category) => ({
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
