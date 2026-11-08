import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, lt, sql } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import {
  analyticsEvents,
  analyticsSessions,
  analyticsVisitors,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { makeTestDb } from "./helpers/db";
import {
  classifyReferrer,
  cleanupAnalytics,
  formatDuration,
  getActivityBreakdown,
  getAnalyticsOverview,
  getGameDetail,
  getGamesBreakdown,
  getGeoBreakdown,
  getPageBreakdown,
  getRecentActivity,
  getSourceBreakdown,
  hasAnyAnalyticsData,
  hashIdentifier,
  pageType,
  parseUserAgent,
  percentChange,
  recordAnalyticsEvents,
  resolveAnalyticsRange,
  validateTrackingPayload,
  type TrackingContext,
  type TrackingEventInput,
} from "@/lib/analytics-web";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

async function record(
  handle: DatabaseHandle,
  visitorId: string,
  sessionId: string,
  events: TrackingEventInput[],
  context: Partial<TrackingContext> = {},
) {
  return recordAnalyticsEvents(
    handle.db,
    { visitorId, sessionId, events },
    {
      countryCode: context.countryCode ?? null,
      userAgent: context.userAgent ?? WINDOWS_CHROME,
      isInternal: context.isInternal ?? false,
    },
  );
}

function id(prefix: string): string {
  return `${prefix}${newId("t").replace(/[^A-Za-z0-9_-]/g, "").slice(-16)}`;
}

describe("Phase 4 analytics", () => {
  let main: DatabaseHandle;
  let empty: DatabaseHandle;
  let games: DatabaseHandle;

  beforeAll(async () => {
    main = await makeTestDb();
    empty = await makeTestDb();
    games = await makeTestDb();
  });

  afterAll(async () => {
    await Promise.all([main.close(), empty.close(), games.close()]);
  });

  describe("payload validation", () => {
    const validEvent = { type: "page_view", path: "/plans/japan" };

    it("accepts a well-formed anonymous batch", () => {
      const parsed = validateTrackingPayload({
        visitorId: "visitor_12345678",
        sessionId: "session_12345678",
        events: [validEvent],
      });
      expect(parsed).not.toBeNull();
      expect(parsed!.events).toHaveLength(1);
      expect(parsed!.events[0]!.type).toBe("page_view");
    });

    it("rejects malformed identifiers, unknown events, and unsafe paths", () => {
      expect(
        validateTrackingPayload({
          visitorId: "short",
          sessionId: "session_12345678",
          events: [validEvent],
        }),
      ).toBeNull();
      expect(
        validateTrackingPayload({
          visitorId: "visitor_12345678",
          sessionId: "session_12345678",
          events: [{ type: "not_a_real_event", path: "/" }],
        }),
      ).toBeNull();
      expect(
        validateTrackingPayload({
          visitorId: "visitor_12345678",
          sessionId: "session_12345678",
          events: [{ type: "page_view", path: "https://evil.example" }],
        }),
      ).toBeNull();
      expect(
        validateTrackingPayload({
          visitorId: "visitor_12345678",
          sessionId: "session_12345678",
          events: [],
        }),
      ).toBeNull();
    });

    it("caps a batch at ten events", () => {
      const events = Array.from({ length: 11 }, () => validEvent);
      expect(
        validateTrackingPayload({
          visitorId: "visitor_12345678",
          sessionId: "session_12345678",
          events,
        }),
      ).toBeNull();
    });

    it("drops sensitive metadata keys and nested objects", () => {
      const parsed = validateTrackingPayload({
        visitorId: "visitor_12345678",
        sessionId: "session_12345678",
        events: [
          {
            type: "search_performed",
            path: "/search",
            metadata: {
              email: "customer@example.test",
              password: "hunter2",
              searchTerm: "japan",
              cardNumber: "4242424242424242",
              planId: "plan_japan",
              country: "JP",
              nested: { secret: true },
            },
          },
        ],
      });
      expect(parsed).not.toBeNull();
      expect(parsed!.events[0]!.metadata).toEqual({
        planId: "plan_japan",
        country: "JP",
      });
    });
  });

  describe("collection and privacy", () => {
    it("stores only HMAC identifiers and coarse, non-identifying context", async () => {
      const visitorId = id("visitor");
      const sessionId = id("session");
      const result = await record(
        main,
        visitorId,
        sessionId,
        [
          { type: "page_view", path: "/", title: "Home", metadata: { planId: "x" } },
          { type: "page_view", path: "/plans/japan" },
        ],
        { countryCode: "nz", userAgent: IPHONE_SAFARI },
      );
      expect(result.ok).toBe(true);

      const [visitor] = await main.db
        .select()
        .from(analyticsVisitors)
        .where(eq(analyticsVisitors.visitorHash, hashIdentifier(visitorId)));
      expect(visitor).toBeTruthy();
      expect(visitor!.visitorHash).not.toBe(visitorId);

      const [session] = await main.db
        .select()
        .from(analyticsSessions)
        .where(
          eq(
            analyticsSessions.sessionHash,
            hashIdentifier(`${visitorId}:${sessionId}`),
          ),
        );
      expect(session).toBeTruthy();
      expect(session!.countryCode).toBe("NZ");
      expect(session!.deviceType).toBe("mobile");
      expect(session!.browser).toBe("Safari");
      expect(session!.os).toBe("iOS");
      expect(session!.pageViews).toBe(2);
      expect(session!.events).toBe(2);

      // Raw identifiers, IP addresses, and the user-agent string are not stored.
      const serialized = JSON.stringify({ visitor, session });
      expect(serialized).not.toContain(visitorId);
      expect(serialized).not.toContain(sessionId);
      expect(serialized).not.toContain("Mozilla/5.0");
      expect(serialized).not.toMatch(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    });
  });

  describe("reports", () => {
    let alphaSession: string;
    let betaSession: string;

    beforeAll(async () => {
      const alpha = id("visitor");
      alphaSession = id("session");
      betaSession = id("session");
      const beta = id("visitor");
      const gamma = id("visitor");

      await record(
        main,
        alpha,
        alphaSession,
        [
          { type: "page_view", path: "/", title: "Home" },
          { type: "page_view", path: "/plans/japan", title: "Japan plan" },
          { type: "plan_viewed", path: "/plans/japan", metadata: { planId: "plan_jp" } },
        ],
        {
          countryCode: "US",
          userAgent: IPHONE_SAFARI,
        },
      );
      // `referrer` is attached to the first event of a session by the client.
      // The second alpha session uses a Facebook referrer.
      await record(
        main,
        alpha,
        id("session"),
        [
          {
            type: "page_view",
            path: "/blog/hello",
            title: "Hello",
            referrer: "https://www.facebook.com/post/1",
          },
          { type: "article_opened", path: "/blog/hello" },
        ],
        { countryCode: "US", userAgent: IPHONE_SAFARI },
      );
      await record(
        main,
        beta,
        betaSession,
        [
          {
            type: "page_view",
            path: "/destinations/japan",
            title: "Japan",
            referrer: "https://news.example.com/travel/esim",
          },
          { type: "destination_viewed", path: "/destinations/japan" },
        ],
        { countryCode: "DE", userAgent: WINDOWS_CHROME },
      );
      await record(
        main,
        gamma,
        id("session"),
        [
          {
            type: "page_view",
            path: "/search",
            title: "Search",
            referrer: "https://www.google.com/search?q=esim+japan",
          },
          {
            type: "search_performed",
            path: "/search",
            metadata: {
              email: "customer@example.test",
              searchTerm: "japan",
              planId: "plan_jp",
            },
          },
        ],
        { countryCode: "FR", userAgent: WINDOWS_CHROME },
      );
    });

    it("counts unique visitors, sessions, page views, and returning visitors", async () => {
      const range = resolveAnalyticsRange({ range: "7d" });
      const overview = await getAnalyticsOverview(main.db, range);

      // The privacy test above added one more visitor and session.
      expect(overview.current.visitors).toBe(4);
      expect(overview.current.sessions).toBe(5);
      expect(overview.current.pageViews).toBe(7);
      expect(overview.current.newVisitors).toBe(4);
      expect(overview.current.returningVisitors).toBe(1);
      expect(overview.current.bounceRate).not.toBeNull();
      expect(overview.hasData).toBe(true);
      expect(overview.trend).toHaveLength(range.days);
      expect(
        overview.trend.reduce((sum, point) => sum + point.pageViews, 0),
      ).toBe(7);
    });

    it("groups traffic by country without inventing unknown countries", async () => {
      const range = resolveAnalyticsRange({ range: "7d" });
      const geo = await getGeoBreakdown(main.db, range);
      const byCode = new Map(geo.map((row) => [row.countryCode, row]));

      expect(byCode.get("US")?.sessions).toBe(2);
      expect(byCode.get("US")?.visitors).toBe(1);
      expect(byCode.get("DE")?.sessions).toBe(1);
      expect(byCode.get("FR")?.sessions).toBe(1);
      for (const row of geo) {
        expect(row.percentage).toBeGreaterThanOrEqual(0);
        expect(row.percentage).toBeLessThanOrEqual(100);
      }
      const total = geo.reduce((sum, row) => sum + row.sessions, 0);
      expect(total).toBe(5);
    });

    it("normalizes lowercase country headers and ignores invalid ones", async () => {
      const lowerVisitor = id("visitor");
      const lowerSession = id("session");
      await record(
        main,
        lowerVisitor,
        lowerSession,
        [{ type: "page_view", path: "/about" }],
        { countryCode: "us" },
      );
      const invalidVisitor = id("visitor");
      const invalidSession = id("session");
      await record(
        main,
        invalidVisitor,
        invalidSession,
        [{ type: "page_view", path: "/about" }],
        { countryCode: "USA" },
      );

      const rows = await main.db
        .select({
          hash: analyticsSessions.sessionHash,
          country: analyticsSessions.countryCode,
        })
        .from(analyticsSessions);
      const byHash = new Map(rows.map((row) => [row.hash, row.country]));
      expect(byHash.get(hashIdentifier(`${lowerVisitor}:${lowerSession}`))).toBe(
        "US",
      );
      expect(
        byHash.get(hashIdentifier(`${invalidVisitor}:${invalidSession}`)),
      ).toBeNull();
    });

    it("reports page entries, exits, visitors, and page types", async () => {
      const range = resolveAnalyticsRange({ range: "7d" });
      const pages = await getPageBreakdown(main.db, range);
      const byPath = new Map(pages.map((page) => [page.path, page]));

      expect(byPath.get("/")?.pageViews).toBe(2);
      expect(byPath.get("/")?.entries).toBe(2);
      expect(byPath.get("/plans/japan")?.pageViews).toBe(2);
      expect(byPath.get("/plans/japan")?.exits).toBe(2);
      expect(byPath.get("/blog/hello")?.entries).toBe(1);
      expect(byPath.get("/destinations/japan")?.entries).toBe(1);

      const plans = await getPageBreakdown(main.db, range, { type: "plans" });
      expect(plans.every((page) => page.path.startsWith("/plans"))).toBe(true);
      const blog = await getPageBreakdown(main.db, range, { type: "blog" });
      expect(blog.map((page) => page.path)).toEqual(["/blog/hello"]);
      const usPages = await getPageBreakdown(main.db, range, { country: "US" });
      expect(usPages.every((page) => page.path !== "/destinations/japan")).toBe(
        true,
      );
    });

    it("classifies traffic sources, referrers, devices, and browsers", async () => {
      const range = resolveAnalyticsRange({ range: "7d" });
      const report = await getSourceBreakdown(main.db, range);
      const sources = new Map(
        report.sources.map((row) => [row.source, row.sessions]),
      );
      expect(sources.get("search")).toBe(1);
      expect(sources.get("social")).toBe(1);
      expect(sources.get("direct")).toBeGreaterThanOrEqual(1);
      expect(sources.get("referral")).toBe(1);
      expect(report.referrers.map((row) => row.host)).toEqual(
        expect.arrayContaining(["www.google.com", "www.facebook.com"]),
      );
      expect(report.devices.find((row) => row.deviceType === "mobile")?.sessions).toBe(
        3,
      );
      expect(report.browsers.find((row) => row.browser === "Safari")?.sessions).toBe(
        3,
      );
      expect(
        report.operatingSystems.find((row) => row.os === "Windows")?.sessions,
      ).toBeGreaterThanOrEqual(2);
    });

    it("summarizes activities without counting page views as interactions", async () => {
      const range = resolveAnalyticsRange({ range: "7d" });
      const activities = await getActivityBreakdown(main.db, range);
      const types = activities.map((row) => row.eventType);
      expect(types).not.toContain("page_view");
      expect(types).toEqual(
        expect.arrayContaining([
          "plan_viewed",
          "article_opened",
          "destination_viewed",
          "search_performed",
        ]),
      );

      const recent = await getRecentActivity(main.db, 10);
      expect(recent.length).toBeGreaterThan(0);
      expect(recent.every((row) => !row.pagePath.startsWith("/admin"))).toBe(true);
    });
  });

  describe("internal traffic exclusion", () => {
    it("records internal events but excludes them from every report", async () => {
      const range = resolveAnalyticsRange({ range: "7d" });
      const before = await getAnalyticsOverview(main.db, range);

      const result = await record(
        main,
        id("internalvisitor"),
        id("internalsession"),
        [
          { type: "page_view", path: "/admin/analytics", title: "Admin" },
          { type: "cta_clicked", path: "/admin/analytics" },
        ],
        { countryCode: "US", userAgent: WINDOWS_CHROME, isInternal: true },
      );
      expect(result.ok).toBe(true);
      expect(result.ok && result.internal).toBe(true);

      const after = await getAnalyticsOverview(main.db, range);
      expect(after.current).toEqual(before.current);

      const geo = await getGeoBreakdown(main.db, range);
      expect(geo.reduce((sum, row) => sum + row.sessions, 0)).toBe(
        before.current.sessions,
      );

      const activities = await getActivityBreakdown(main.db, range);
      expect(activities.map((row) => row.eventType)).not.toContain("cta_clicked");

      const recent = await getRecentActivity(main.db, 50);
      expect(recent.every((row) => !row.pagePath.startsWith("/admin"))).toBe(true);
    });

    it("keeps an internal-only database in the honest empty state", async () => {
      await record(
        empty,
        id("internalvisitor"),
        id("internalsession"),
        [{ type: "page_view", path: "/admin/seo" }],
        { isInternal: true },
      );
      expect(await hasAnyAnalyticsData(empty.db)).toBe(false);
      const overview = await getAnalyticsOverview(
        empty.db,
        resolveAnalyticsRange({ range: "30d" }),
      );
      expect(overview.hasData).toBe(false);
      expect(overview.current.sessions).toBe(0);
      expect(overview.current.pageViews).toBe(0);
    });
  });

  describe("games analytics", () => {
    it("returns an empty ranking when no game events exist", async () => {
      expect(await getGamesBreakdown(games.db, resolveAnalyticsRange({ range: "30d" }))).toEqual(
        [],
      );
    });

    it("ranks games by opens and derives completion honestly", async () => {
      await record(
        games,
        id("gamer"),
        id("gamesession"),
        [
          { type: "page_view", path: "/games/flag-quiz" },
          { type: "game_opened", path: "/games/flag-quiz", gameId: "flag-quiz" },
          { type: "game_started", path: "/games/flag-quiz", gameId: "flag-quiz" },
          { type: "game_completed", path: "/games/flag-quiz", gameId: "flag-quiz" },
          { type: "game_exited", path: "/games/flag-quiz", gameId: "flag-quiz" },
        ],
        { countryCode: "GB", userAgent: ANDROID_CHROME },
      );
      await record(
        games,
        id("gamer"),
        id("gamesession"),
        [
          { type: "page_view", path: "/games/flag-quiz" },
          { type: "game_opened", path: "/games/flag-quiz", gameId: "flag-quiz" },
        ],
        { countryCode: "GB", userAgent: ANDROID_CHROME },
      );
      await record(
        games,
        id("gamer"),
        id("gamesession"),
        [
          { type: "page_view", path: "/games/memory" },
          { type: "game_opened", path: "/games/memory", gameId: "memory" },
          { type: "game_started", path: "/games/memory", gameId: "memory" },
          { type: "game_exited", path: "/games/memory", gameId: "memory" },
        ],
        { countryCode: "CA", userAgent: WINDOWS_CHROME },
      );

      const range = resolveAnalyticsRange({ range: "7d" });
      const ranking = await getGamesBreakdown(games.db, range);
      expect(ranking.map((row) => row.gameId)).toEqual(["flag-quiz", "memory"]);

      const quiz = ranking.find((row) => row.gameId === "flag-quiz")!;
      expect(quiz.opened).toBe(2);
      expect(quiz.started).toBe(1);
      expect(quiz.completed).toBe(1);
      expect(quiz.exited).toBe(1);
      expect(quiz.sessions).toBe(2);
      expect(quiz.visitors).toBe(2);
      expect(quiz.completionRate).toBe(100);
      expect(quiz.averageSeconds).not.toBeNull();

      const memory = ranking.find((row) => row.gameId === "memory")!;
      expect(memory.completed).toBe(0);
      expect(memory.completionRate).toBe(0);

      const detail = await getGameDetail(games.db, "flag-quiz", range);
      expect(detail.events.map((row) => row.eventType)).toEqual(
        expect.arrayContaining([
          "game_opened",
          "game_started",
          "game_completed",
          "game_exited",
        ]),
      );
      expect(detail.pages[0]!.path).toBe("/games/flag-quiz");
      expect(detail.trend.length).toBeGreaterThan(0);
    });

    it("does not count page views as game completions", async () => {
      const handle = await makeTestDb();
      try {
        await record(
          handle,
          id("gamer"),
          id("gamesession"),
          [
            { type: "page_view", path: "/games/only-viewed" },
            { type: "page_view", path: "/games/only-viewed" },
          ],
          { countryCode: "US" },
        );
        expect(
          await getGamesBreakdown(handle.db, resolveAnalyticsRange({ range: "7d" })),
        ).toEqual([]);
      } finally {
        await handle.close();
      }
    });
  });

  describe("empty state and retention", () => {
    it("reports honest zeros before any consented traffic", async () => {
      expect(await hasAnyAnalyticsData(empty.db)).toBe(false);
      const overview = await getAnalyticsOverview(
        empty.db,
        resolveAnalyticsRange({ range: "7d" }),
      );
      expect(overview.hasData).toBe(false);
      expect(overview.current).toEqual({
        visitors: 0,
        sessions: 0,
        pageViews: 0,
        newVisitors: 0,
        returningVisitors: 0,
        avgSessionSeconds: null,
        pagesPerSession: null,
        bounceRate: null,
      });
      expect(overview.trend.every((point) => point.pageViews === 0)).toBe(true);
      expect(await getGeoBreakdown(empty.db, resolveAnalyticsRange({ range: "7d" }))).toEqual(
        [],
      );
      expect(await getPageBreakdown(empty.db, resolveAnalyticsRange({ range: "7d" }))).toEqual(
        [],
      );
      expect(
        await getActivityBreakdown(empty.db, resolveAnalyticsRange({ range: "7d" })),
      ).toEqual([]);
    });

    it("deletes data outside the retention window", async () => {
      const visitorId = id("cleanupvisitor");
      const sessionId = id("cleanupsession");
      await record(
        main,
        visitorId,
        sessionId,
        [{ type: "page_view", path: "/old-page" }],
        { countryCode: "US" },
      );

      const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      const [{ id: sessionRowId }] = await main.db
        .select({ id: analyticsSessions.id })
        .from(analyticsSessions)
        .where(
          eq(
            analyticsSessions.sessionHash,
            hashIdentifier(`${visitorId}:${sessionId}`),
          ),
        );
      await main.db
        .update(analyticsEvents)
        .set({ createdAt: old })
        .where(eq(analyticsEvents.sessionId, sessionRowId));
      await main.db
        .update(analyticsSessions)
        .set({ firstSeen: old, lastSeen: old })
        .where(eq(analyticsSessions.id, sessionRowId));
      await main.db
        .update(analyticsVisitors)
        .set({ lastSeen: old })
        .where(eq(analyticsVisitors.visitorHash, hashIdentifier(visitorId)));

      const result = await cleanupAnalytics(main.db, 30);
      expect(result.events).toBeGreaterThanOrEqual(1);
      expect(result.sessions).toBeGreaterThanOrEqual(1);
      expect(result.visitors).toBeGreaterThanOrEqual(1);

      const remainingEvents = await main.db
        .select({ count: sql<number>`count(*)::int` })
        .from(analyticsEvents)
        .where(lt(analyticsEvents.createdAt, old));
      expect(Number(remainingEvents[0]!.count)).toBe(0);
    });
  });

  describe("range and classification helpers", () => {
    it("resolves relative, named, and custom ranges", () => {
      const today = resolveAnalyticsRange({ range: "today" });
      expect(today.days).toBe(1);
      expect(today.to.getTime() - today.from.getTime()).toBe(86_400_000);

      const yesterday = resolveAnalyticsRange({ range: "yesterday" });
      expect(yesterday.days).toBe(1);
      expect(yesterday.to.getTime()).toBe(today.from.getTime());

      const seven = resolveAnalyticsRange({ range: "7d" });
      expect(seven.days).toBe(7);
      expect(seven.previousTo.getTime()).toBe(seven.from.getTime());

      const custom = resolveAnalyticsRange({
        range: "custom",
        from: "2026-01-01",
        to: "2026-01-03",
      });
      expect(custom.days).toBe(3);
      expect(custom.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(custom.to.toISOString()).toBe("2026-01-04T00:00:00.000Z");
      expect(custom.previousFrom.toISOString()).toBe("2025-12-29T00:00:00.000Z");

      const fallback = resolveAnalyticsRange({
        range: "custom",
        from: "not-a-date",
        to: "also-bad",
      });
      expect(fallback.key).toBe("7d");
    });

    it("classifies referrers and user agents", () => {
      expect(classifyReferrer("https://www.google.com/search?q=x").source).toBe(
        "search",
      );
      expect(classifyReferrer("https://www.facebook.com/x").source).toBe("social");
      expect(classifyReferrer("https://news.example.com/x").source).toBe(
        "referral",
      );
      expect(classifyReferrer(null)).toEqual({ source: "direct", host: null });
      expect(classifyReferrer("not a url")).toEqual({
        source: "referral",
        host: null,
      });

      expect(parseUserAgent(IPHONE_SAFARI)).toEqual({
        deviceType: "mobile",
        browser: "Safari",
        os: "iOS",
      });
      expect(parseUserAgent(WINDOWS_CHROME).deviceType).toBe("desktop");
      expect(parseUserAgent(WINDOWS_CHROME).browser).toBe("Chrome");
      expect(parseUserAgent(WINDOWS_CHROME).os).toBe("Windows");
      expect(parseUserAgent(ANDROID_CHROME).deviceType).toBe("mobile");
      expect(
        parseUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)").deviceType,
      ).toBe("bot");
      expect(parseUserAgent(null).deviceType).toBe("unknown");
    });

    it("maps paths to types and formats measured values", () => {
      expect(pageType("/")).toBe("home");
      expect(pageType("/blog/hello")).toBe("blog");
      expect(pageType("/games/quiz")).toBe("games");
      expect(pageType("/destinations/japan")).toBe("destinations");
      expect(pageType("/regions/europe")).toBe("destinations");
      expect(pageType("/plans/japan")).toBe("plans");
      expect(pageType("/guides/setup")).toBe("guides");
      expect(pageType("/compatibility/install")).toBe("guides");
      expect(pageType("/about")).toBe("other");

      expect(formatDuration(null)).toBe("—");
      expect(formatDuration(45)).toBe("45s");
      expect(formatDuration(75)).toBe("1m 15s");
      expect(percentChange(10, 5)).toBe(100);
      expect(percentChange(5, 10)).toBe(-50);
      expect(percentChange(5, 0)).toBeNull();
      expect(percentChange(0, 0)).toBe(0);
    });
  });
});
