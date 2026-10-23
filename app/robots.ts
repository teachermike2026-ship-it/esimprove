import type { MetadataRoute } from "next";
import { demoMode, siteUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (demoMode) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      sitemap: `${siteUrl}/sitemap.xml`,
    };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/portal", "/checkout", "/orders", "/api"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
