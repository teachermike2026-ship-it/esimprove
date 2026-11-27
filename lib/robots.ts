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

/**
 * Crawlers ESIMPROVE wants to reach its public pages: classic search engines
 * plus AI search/answer engines and the agents that fetch pages when a user
 * asks an assistant about eSIMs. Training crawlers (GPTBot, ClaudeBot,
 * Google-Extended, Applebot-Extended, CCBot) are allowed by the owner's
 * choice to maximise visibility in AI assistants; remove them here to opt out.
 */
export const AI_AND_SEARCH_CRAWLERS = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Applebot",
  "YandexBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "MistralAI-User",
  "CCBot",
] as const;

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
      // Search engines and AI assistants are named explicitly so that public
      // pages stay open to them even if a host-level default ever changes.
      // A crawler that matches its own group ignores "*", so the same private
      // paths are repeated here.
      {
        userAgent: [...AI_AND_SEARCH_CRAWLERS],
        allow: ["/", "/llms.txt", "/llms-full.txt"],
        disallow: ROBOTS_DISALLOW,
      },
    ],
    sitemap: `${options.baseUrl.replace(/\/+$/, "")}/sitemap.xml`,
    host: options.baseUrl.replace(/\/+$/, ""),
  };
}
