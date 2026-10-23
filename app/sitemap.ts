import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db/client";
import { getDestinations, getPlans, getRegions } from "@/lib/catalog";
import { siteUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await getDb();
  const [regions, destinations, plans] = await Promise.all([
    getRegions(db),
    getDestinations(db),
    getPlans(db, { limit: 500 }),
  ]);
  const now = new Date();

  const staticPaths = [
    "",
    "/destinations",
    "/plans",
    "/search",
    "/compatibility",
    "/guides",
    "/legal/terms",
    "/legal/privacy",
    "/legal/refunds",
    "/legal/cookies",
  ];

  return [
    ...staticPaths.map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...regions.map((region) => ({
      url: `${siteUrl}/regions/${region.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...destinations.map((destination) => ({
      url: `${siteUrl}/destinations/${destination.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...plans.map((plan) => ({
      url: `${siteUrl}/plans/${plan.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
