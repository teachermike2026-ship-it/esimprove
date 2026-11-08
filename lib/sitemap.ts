import type { MetadataRoute } from "next";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { blogArticles, blogCategories } from "@/lib/db/schema";
import { getDestinations, getPlans, getRegions } from "@/lib/catalog";
import { loadSeoSettings } from "@/lib/seo";
import { siteUrl } from "@/lib/config";

export async function buildSitemap(db: Database): Promise<MetadataRoute.Sitemap> {
  const [regions, destinations, plans, settings] = await Promise.all([
    getRegions(db),
    getDestinations(db),
    getPlans(db, { limit: 500 }),
    loadSeoSettings(db),
  ]);
  const base = (settings.canonicalBase || siteUrl).replace(/\/+$/, "");
  const now = new Date();

  const staticPaths = [
    "",
    "/destinations",
    "/regions",
    "/plans",
    "/search",
    "/about",
    "/contact",
    "/compatibility",
    "/guides",
    "/compatibility/install",
    "/legal/terms",
    "/legal/privacy",
    "/legal/refunds",
    "/legal/cookies",
    "/blog",
  ];

  const [publishedArticles, categoriesWithArticles] = await Promise.all([
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
  ];
}
