import type { MetadataRoute } from "next";

export const ROBOTS_DISALLOW = [
  "/admin",
  "/admin/",
  "/portal",
  "/portal/",
  "/login",
  "/register",
  "/cart",
  "/checkout",
  "/orders",
  "/api",
  "/api/",
];

export function buildRobotsPolicy(options: {
  noIndex: boolean;
  baseUrl: string;
}): MetadataRoute.Robots {
  if (options.noIndex) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ROBOTS_DISALLOW,
      },
    ],
    sitemap: `${options.baseUrl.replace(/\/+$/, "")}/sitemap.xml`,
    host: options.baseUrl.replace(/\/+$/, ""),
  };
}
