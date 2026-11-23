import type { MetadataRoute } from "next";
import { noIndex, siteUrl } from "@/lib/config";
import { buildRobotsPolicy } from "@/lib/robots";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // Hard safety rail: preview, staging, and local deployments are never indexed.
  return buildRobotsPolicy({ noIndex, baseUrl: siteUrl });
}
