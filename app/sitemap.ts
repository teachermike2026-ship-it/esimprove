import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db/client";
import { buildSitemap } from "@/lib/sitemap";
import { noIndex } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Preview deployments must not advertise indexable URLs.
  if (noIndex) return [];
  const db = await getDb();
  return buildSitemap(db);
}
