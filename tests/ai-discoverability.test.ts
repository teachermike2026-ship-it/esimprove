/**
 * Search and AI discoverability: crawler access, AI referral attribution,
 * data-driven destination facts, llms.txt and sitemap alternates.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/lib/db/client";
import { AI_AND_SEARCH_CRAWLERS, buildRobotsPolicy, ROBOTS_DISALLOW } from "@/lib/robots";
import { classifyReferrer } from "@/lib/analytics-web";
import { attributionReferrer, isAiAssistantHost } from "@/lib/referrer";
import { destinationFacts } from "@/lib/destination-facts";
import { formatData } from "@/lib/money";
import type { PlanSummary } from "@/lib/catalog";
import { buildLlmsFullTxt, buildLlmsTxt } from "@/lib/llms-txt";
import { buildSitemap, sitemapAlternates } from "@/lib/sitemap";
import { makeTestDb } from "./helpers/db";

describe("crawler access", () => {
  it("opens public pages to search engines and AI assistants, keeps private paths closed", () => {
    const policy = buildRobotsPolicy({ noIndex: false, baseUrl: "https://esimprove.com" });
    const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
    const named = rules.find((rule) => Array.isArray(rule.userAgent));
    expect(named).toBeDefined();
    for (const bot of ["OAI-SearchBot", "ChatGPT-User", "GPTBot", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Googlebot", "Bingbot"]) {
      expect(named!.userAgent).toContain(bot);
    }
    // A named group replaces "*", so it must repeat the private paths.
    expect(named!.disallow).toEqual(ROBOTS_DISALLOW);
    expect(named!.allow).toEqual(expect.arrayContaining(["/", "/llms.txt"]));
    expect(new Set(AI_AND_SEARCH_CRAWLERS).size).toBe(AI_AND_SEARCH_CRAWLERS.length);
  });

  it("still blocks everything on noindex (preview/staging) deployments", () => {
    expect(buildRobotsPolicy({ noIndex: true, baseUrl: "https://x.test" })).toEqual({
      rules: [{ userAgent: "*", disallow: "/" }],
    });
  });
});

describe("AI referral attribution", () => {
  it("classifies AI assistants separately from search engines", () => {
    expect(classifyReferrer("https://chatgpt.com/").source).toBe("ai");
    expect(classifyReferrer("claude.ai").source).toBe("ai");
    expect(classifyReferrer("https://www.perplexity.ai/search").source).toBe("ai");
    expect(classifyReferrer("https://gemini.google.com/app").source).toBe("ai");
    expect(classifyReferrer("https://copilot.microsoft.com/").source).toBe("ai");
    expect(classifyReferrer("https://www.google.com/search?q=esim").source).toBe("search");
    expect(isAiAssistantHost("notchatgpt.com.evil.example")).toBe(false);
  });

  it("uses utm_source only when the browser sent no referrer, and only for AI hosts", () => {
    expect(attributionReferrer("", "?utm_source=chatgpt.com")).toBe("chatgpt.com");
    expect(attributionReferrer("https://www.bing.com/", "?utm_source=chatgpt.com")).toBe("www.bing.com");
    expect(attributionReferrer("", "?utm_source=newsletter")).toBeNull();
    expect(attributionReferrer("", "?utm_source=https://evil.example/x")).toBeNull();
  });
});

function plan(over: Partial<PlanSummary>): PlanSummary {
  return {
    id: over.slug ?? "p",
    slug: "p",
    name: "Plan",
    destinationId: "d",
    destinationName: "Spain",
    destinationSlug: "spain",
    countryCode: "ES",
    regionName: "Europe",
    regionSlug: "europe",
    accent: "teal",
    supplierKey: "esimaccess",
    supplierProductId: "X",
    dataMb: 1024,
    validityDays: 7,
    costMinor: 100,
    markupBps: 0,
    priceMinor: 400,
    currency: "USD",
    taxBps: 0,
    coverageSummary: "Spain",
    networkSummary: "Orange (5G), Movistar (4G)",
    description: "",
    features: ["1 GB total data", "Validity starts on first connection to a network", "Activate within 180 days of purchase", "Data only (no SMS or calls)"],
    status: "published",
    isDemo: false,
    ...over,
  };
}

describe("destination facts", () => {
  it("derives prices, picks and rules only from published plans", () => {
    const facts = destinationFacts([
      plan({ slug: "a", priceMinor: 376, dataMb: 1024, validityDays: 7 }),
      plan({ slug: "b", priceMinor: 512, dataMb: 3072, validityDays: 30 }),
      plan({ slug: "c", priceMinor: 1500, dataMb: 20480, validityDays: 30 }),
      plan({ slug: "d", priceMinor: 900, dataMb: 1024, validityDays: 10, features: ["1 GB per day, then reduced speed"] }),
      plan({ slug: "hidden", priceMinor: 1, status: "archived" }),
    ])!;
    expect(facts.planCount).toBe(4);
    expect(facts.fromPriceMinor).toBe(376);
    expect(facts.toPriceMinor).toBe(1500);
    expect(facts.cheapest.slug).toBe("a");
    expect(facts.bestValuePerGb?.slug).toBe("c"); // $15 / 20 GB = 75 c/GB
    expect(facts.mostData?.slug).toBe("c");
    expect(facts.forAMonth?.slug).toBe("b");
    expect(facts.hasDailyPlans).toBe(true);
    expect(facts.networks).toEqual(["Movistar", "Orange"]);
    expect(facts.has5G).toBe(true);
    expect(facts.activationWindowDays).toBe(180);
    expect(destinationFacts([plan({ status: "archived" })])).toBeNull();
  });

  it("treats the supplier's 999 GB sentinel as unlimited, not as the best value per GB", () => {
    const facts = destinationFacts([
      plan({ slug: "capped", priceMinor: 900, dataMb: 10240 }),
      plan({ slug: "unlimited", priceMinor: 2500, dataMb: 999 * 1024, features: ["Unlimited data"] }),
    ])!;
    expect(facts.hasUnlimited).toBe(true);
    expect(facts.bestValuePerGb?.slug).toBe("capped");
    expect(facts.mostData?.slug).toBe("capped");
    expect(formatData(999 * 1024)).toBe("Unlimited");
  });
});

describe("llms.txt and sitemap", () => {
  let handle: DatabaseHandle;
  beforeAll(async () => {
    handle = await makeTestDb();
  });
  afterAll(async () => handle.close());

  it("summarises the live catalog with absolute links and no secrets", async () => {
    const short = await buildLlmsTxt(handle.db, "https://esimprove.com");
    expect(short.startsWith("# ESIMPROVE\n\n> ")).toBe(true);
    expect(short).toContain("https://esimprove.com/destinations/");
    expect(short).toContain("https://esimprove.com/legal/refunds");
    expect(short).toContain("https://esimprove.com/llms-full.txt");
    expect(short).toMatch(/15 block confirmations/);
    expect(short).not.toMatch(/nodereal|ESIM_SECRET|0xBF93/i);
    const full = await buildLlmsFullTxt(handle.db, "https://esimprove.com");
    expect(full).toContain("## All destinations");
    expect(full.length).toBeGreaterThan(short.length / 2);
  });

  it("lists every published plan once with hreflang alternates for each language", async () => {
    const entries = await buildSitemap(handle.db);
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.some((url) => url.includes("/guides/what-is-an-esim"))).toBe(true);
    const alt = sitemapAlternates("/destinations/spain", "https://esimprove.com").languages;
    expect(Object.keys(alt).length).toBe(5);
    expect(alt["x-default"]).toBe("https://esimprove.com/destinations/spain");
    expect(Object.values(alt)).toContain("https://esimprove.com/fr/destinations/spain");
  });
});
