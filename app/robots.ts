import type { MetadataRoute } from "next";
import { noIndex, siteUrl } from "@/lib/config";
import { buildRobotsPolicy } from "@/lib/robots";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // Hard safety rail: demo, preview, and staging deployments are never indexed.
  return buildRobotsPolicy({ noIndex, baseUrl: siteUrl });
}
