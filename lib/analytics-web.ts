import {
  and,
  desc,
  eq,
  gte,
  isNotNull,
  lt,
  sql,
} from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  analyticsEvents,
  analyticsSessions,
  analyticsVisitors,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { analyticsHashSecret } from "@/lib/config";
import { hmacHex } from "@/lib/crypto";
import { minimizedReferrer, referrerHost } from "@/lib/referrer";

/* -------------------------------------------------------------------------- */
/* Event definitions and validation                                           */
/* -------------------------------------------------------------------------- */

export const TRACKED_EVENT_TYPES = [
  "page_view",
  "search_performed",
  "search_result_clicked",
  "category_selected",
  "destination_viewed",
  "plan_viewed",
  "game_opened",
  "game_started",
  "game_completed",
  "game_exited",
  "article_opened",
  "article_link_clicked",
  "registration_completed",
  "login_completed",
  "cart_viewed",
  "cart_item_added",
  "cart_item_removed",
  "checkout_started",
  "order_created",
  "cta_clicked",
  "share_clicked",
] as const;

export type TrackedEventType = (typeof TRACKED_EVENT_TYPES)[number];

const EVENT_TYPE_SET = new Set<string>(TRACKED_EVENT_TYPES);

const SENSITIVE_METADATA_KEY = /pass|secret|token|card|cvv|cvc|email|phone|address|ssn|iban|account|message|content|searchterm|query/i;

export type TrackingEventInput = {
  type: string;
  path: string;
  title?: string;
  gameId?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
};

export type TrackingPayload = {
  visitorId: string;
  sessionId: string;
  events: TrackingEventInput[];
};

export type TrackingContext = {
  countryCode?: string | null;
  userAgent?: string | null;
  isInternal: boolean;
};

export type TrackingResult =
  | { ok: true; accepted: number; internal: boolean }
  | { ok: false; error: string; status: number };

const ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

export function validateTrackingPayload(input: unknown): TrackingPayload | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (typeof record.visitorId !== "string" || !ID_PATTERN.test(record.visitorId)) return null;
  if (typeof record.sessionId !== "string" || !ID_PATTERN.test(record.sessionId)) return null;
  if (!Array.isArray(record.events) || record.events.length === 0) return null;
  if (record.events.length > 10) return null;

  const events: TrackingEventInput[] = [];
  for (const raw of record.events) {
    if (!raw || typeof raw !== "object") return null;
    const event = raw as Record<string, unknown>;
    if (typeof event.type !== "string" || !EVENT_TYPE_SET.has(event.type)) return null;
    if (typeof event.path !== "string" || !event.path.startsWith("/") || event.path.length > 500) {
      return null;
    }
    const parsed: TrackingEventInput = { type: event.type, path: event.path.slice(0, 500) };
    if (typeof event.title === "string") parsed.title = event.title.slice(0, 300);
    if (typeof event.gameId === "string" && event.gameId.length <= 100) parsed.gameId = event.gameId;
    if (typeof event.referrer === "string" && event.referrer.length <= 1000) {
      // Store only the source host. Paths, query strings, fragments, and
      // credentials are discarded before the event reaches the database.
      const host = minimizedReferrer(event.referrer);
      if (host) parsed.referrer = host;
    }
    if (event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)) {
      const metadata: Record<string, unknown> = {};
      let keys = 0;
      for (const [key, value] of Object.entries(event.metadata)) {
        if (keys >= 15) break;
        if (!/^[a-zA-Z0-9_]{1,40}$/.test(key)) continue;
        if (SENSITIVE_METADATA_KEY.test(key)) continue;
        if (typeof value === "string") {
          metadata[key] = value.slice(0, 300);
        } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
          metadata[key] = value;
        } else {
          continue;
        }
        keys += 1;
      }
      parsed.metadata = metadata;
    }
    events.push(parsed);
  }
  return { visitorId: record.visitorId, sessionId: record.sessionId, events };
}

/* -------------------------------------------------------------------------- */
/* Collection                                                                 */
/* -------------------------------------------------------------------------- */

function analyticsSecret(): string {
  return analyticsHashSecret();
}

export function hashIdentifier(value: string): string {
  return hmacHex(value, analyticsSecret());
}

export function classifyReferrer(referrer: string | null | undefined): {
  source: "direct" | "search" | "social" | "referral";
  host: string | null;
} {
  if (!referrer) return { source: "direct", host: null };
  // Referrers are persisted as host-only values. Accept a full URL for callers
  // that still pass raw browser data, but normalise both forms to a host.
  const host =
    referrerHost(referrer) ??
    (/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(referrer.trim())
      ? referrer.trim().toLowerCase()
      : null);
  if (!host) return { source: "referral", host: null };
  if (
    /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|ask|naver|seznam)\.[a-z.]+$/.test(host)
  ) {
    return { source: "search", host };
  }
  if (
    /(^|\.)(facebook|instagram|twitter|x|linkedin|tiktok|reddit|pinterest|youtube|threads|mastodon|bsky)\.[a-z.]+$/.test(
      host,
    )
  ) {
    return { source: "social", host };
  }
  return { source: "referral", host };
}

export function parseUserAgent(userAgent: string | null | undefined): {
  deviceType: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  browser: string;
  os: string;
} {
  if (!userAgent) return { deviceType: "unknown", browser: "unknown", os: "unknown" };
  const ua = userAgent.toLowerCase();
  const bot = /bot|crawler|spider|slurp|bingpreview|headless|lighthouse/.test(ua);
  const tablet = /ipad|tablet|playbook|silk|kindle/.test(ua);
  const mobile = /mobi|iphone|ipod|android.*mobile|windows phone|blackberry/.test(ua);
  const deviceType = bot ? "bot" : tablet ? "tablet" : mobile ? "mobile" : "desktop";

  let browser = "other";
  if (/edg\//.test(ua)) browser = "Edge";
  else if (/opr\/|opera/.test(ua)) browser = "Opera";
  else if (/chrome|crios/.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/.test(ua)) browser = "Firefox";
  else if (/safari/.test(ua)) browser = "Safari";
  else if (/bot|crawler|spider/.test(ua)) browser = "Bot";

  let os = "other";
  if (/windows nt/.test(ua)) os = "Windows";
  else if (/android/.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod|ios/.test(ua)) os = "iOS";
  else if (/mac os x|macintosh/.test(ua)) os = "macOS";
  else if (/linux/.test(ua)) os = "Linux";
  else if (/cros/.test(ua)) os = "ChromeOS";

  return { deviceType, browser, os };
}

function normalizedCountry(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
}

/**
 * Records a batch of anonymous events. No raw IP address, user agent string, or
 * client identifier is stored: only an HMAC of the generated identifier and a
 * coarse country code derived from CDN headers.
 */
export async function recordAnalyticsEvents(
  db: Database,
  payload: TrackingPayload,
  context: TrackingContext,
): Promise<TrackingResult> {
  const now = new Date();
  const visitorHash = hashIdentifier(payload.visitorId);
  const sessionHash = hashIdentifier(`${payload.visitorId}:${payload.sessionId}`);
  const ua = parseUserAgent(context.userAgent);
  const countryCode = normalizedCountry(context.countryCode);
  const internal = context.isInternal;

  // Basic abuse protection: cap a single session at 120 events per minute.
  const { rows: recentRows } = (await db.execute(
    sql`select count(*)::int as count from ${analyticsEvents}
        where ${analyticsEvents.sessionId} in (
          select ${analyticsSessions.id} from ${analyticsSessions}
          where ${analyticsSessions.sessionHash} = ${sessionHash}
        ) and ${analyticsEvents.createdAt} >= now() - interval '1 minute'`,
  )) as unknown as { rows: { count: number }[] };
  if (Number(recentRows[0]?.count ?? 0) > 120) {
    return { ok: false, error: "rate_limited", status: 429 };
  }

  const [existingVisitor] = await db
    .select({ id: analyticsVisitors.id })
    .from(analyticsVisitors)
    .where(eq(analyticsVisitors.visitorHash, visitorHash))
    .limit(1);
  const isNewVisitor = !existingVisitor;
  if (existingVisitor) {
    await db
      .update(analyticsVisitors)
      .set({ lastSeen: now, ...(internal ? { isInternal: true } : {}) })
      .where(eq(analyticsVisitors.id, existingVisitor.id));
  } else {
    await db.insert(analyticsVisitors).values({
      id: newId("av"),
      visitorHash,
      firstSeen: now,
      lastSeen: now,
      isInternal: internal,
    });
  }

  const firstEvent = payload.events[0];
  const lastEvent = payload.events[payload.events.length - 1];
  const entryReferrer = minimizedReferrer(firstEvent.referrer);
  const { source } = classifyReferrer(entryReferrer);
  const pageViews = payload.events.filter((event) => event.type === "page_view").length;

  const [existingSession] = await db
    .select({ id: analyticsSessions.id })
    .from(analyticsSessions)
    .where(eq(analyticsSessions.sessionHash, sessionHash))
    .limit(1);

  let sessionId: string;
  if (existingSession) {
    sessionId = existingSession.id;
    await db
      .update(analyticsSessions)
      .set({
        lastSeen: now,
        exitPath: lastEvent.path,
        pageViews: sql`${analyticsSessions.pageViews} + ${pageViews}`,
        events: sql`${analyticsSessions.events} + ${payload.events.length}`,
        ...(countryCode && !internal ? { countryCode } : {}),
        ...(internal ? { isInternal: true } : {}),
      })
      .where(eq(analyticsSessions.id, sessionId));
  } else {
    sessionId = newId("as");
    await db.insert(analyticsSessions).values({
      id: sessionId,
      sessionHash,
      visitorHash,
      firstSeen: now,
      lastSeen: now,
      entryPath: firstEvent.path,
      exitPath: lastEvent.path,
      deviceType: ua.deviceType,
      browser: ua.browser,
      os: ua.os,
      countryCode,
      referrer: entryReferrer,
      source,
      isNew: isNewVisitor,
      isInternal: internal,
      pageViews,
      events: payload.events.length,
    });
    await db
      .update(analyticsVisitors)
      .set({ sessionCount: sql`${analyticsVisitors.sessionCount} + 1` })
      .where(eq(analyticsVisitors.visitorHash, visitorHash));
  }

  await db.insert(analyticsEvents).values(
    payload.events.map((event) => ({
      id: newId("ae"),
      sessionId,
      eventType: event.type,
      pagePath: event.path,
      pageTitle: event.title ?? null,
      gameId: event.gameId ?? null,
      countryCode,
      deviceType: ua.deviceType,
      browser: ua.browser,
      referrer: minimizedReferrer(event.referrer),
      metadata: event.metadata ?? {},
      isInternal: internal,
      createdAt: now,
    })),
  );

  return { ok: true, accepted: payload.events.length, internal };
}

/**
 * Retention cleanup lives in lib/retention.ts so that the job route, the legal
 * admin UI, and the analytics module share one policy source.
 */
export { cleanupAnalytics } from "@/lib/retention";
export type {
  AnalyticsCleanupOverrides,
  AnalyticsCleanupResult,
} from "@/lib/retention";

/* -------------------------------------------------------------------------- */
/* Reporting                                                                  */
/* -------------------------------------------------------------------------- */

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

export type AnalyticsRange = {
  key: RangeKey;
  label: string;
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  days: number;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function resolveAnalyticsRange(params: {
  range?: string;
  from?: string;
  to?: string;
}): AnalyticsRange {
  const now = new Date();
  const today = startOfUtcDay(now);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const key = (params.range as RangeKey) || "7d";

  function window(days: number): { from: Date; to: Date; previousFrom: Date; previousTo: Date } {
    const to = tomorrow;
    const from = new Date(today.getTime() - (days - 1) * 86_400_000);
    return {
      from,
      to,
      previousFrom: new Date(from.getTime() - days * 86_400_000),
      previousTo: from,
    };
  }

  if (key === "today") {
    return { key, label: "Today", ...window(1), days: 1 };
  }
  if (key === "yesterday") {
    const from = new Date(today.getTime() - 86_400_000);
    return {
      key,
      label: "Yesterday",
      from,
      to: today,
      previousFrom: new Date(from.getTime() - 86_400_000),
      previousTo: from,
      days: 1,
    };
  }
  if (key === "30d") return { key, label: "Last 30 days", ...window(30), days: 30 };
  if (key === "90d") return { key, label: "Last 90 days", ...window(90), days: 90 };
  if (key === "custom" && params.from && params.to) {
    const from = new Date(`${params.from}T00:00:00.000Z`);
    const to = new Date(`${params.to}T00:00:00.000Z`);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) {
      const toExclusive = new Date(to.getTime() + 86_400_000);
      const days = Math.max(1, Math.round((toExclusive.getTime() - from.getTime()) / 86_400_000));
      return {
        key,
        label: `${params.from} to ${params.to}`,
        from,
        to: toExclusive,
        previousFrom: new Date(from.getTime() - days * 86_400_000),
        previousTo: from,
        days,
      };
    }
  }
  return { key: "7d", label: "Last 7 days", ...window(7), days: 7 };
}

type DateFilter = { from: Date; to: Date };

function sessionWhere(range: DateFilter) {
  return and(
    gte(analyticsSessions.firstSeen, range.from),
    lt(analyticsSessions.firstSeen, range.to),
    eq(analyticsSessions.isInternal, false),
  );
}

function eventWhere(range: DateFilter) {
  return and(
    gte(analyticsEvents.createdAt, range.from),
    lt(analyticsEvents.createdAt, range.to),
    eq(analyticsEvents.isInternal, false),
  );
}

export type OverviewMetrics = {
  visitors: number;
  sessions: number;
  pageViews: number;
  newVisitors: number;
  returningVisitors: number;
  avgSessionSeconds: number | null;
  pagesPerSession: number | null;
  bounceRate: number | null;
};

export type AnalyticsOverview = {
  current: OverviewMetrics;
  previous: OverviewMetrics;
  trend: { date: string; sessions: number; pageViews: number; visitors: number }[];
  hasData: boolean;
};

async function loadOverviewMetrics(db: Database, range: DateFilter): Promise<OverviewMetrics> {
  const [sessionRow] = await db
    .select({
      visitors: sql<number>`count(distinct ${analyticsSessions.visitorHash})::int`,
      sessions: sql<number>`count(*)::int`,
      newSessions: sql<number>`sum(case when ${analyticsSessions.isNew} then 1 else 0 end)::int`,
      returningSessions: sql<number>`sum(case when ${analyticsSessions.isNew} then 0 else 1 end)::int`,
      avgDuration: sql<number | null>`avg(extract(epoch from (${analyticsSessions.lastSeen} - ${analyticsSessions.firstSeen})))`,
      bounced: sql<number>`sum(case when ${analyticsSessions.pageViews} <= 1 then 1 else 0 end)::int`,
      pageViewsCounter: sql<number>`sum(${analyticsSessions.pageViews})::int`,
    })
    .from(analyticsSessions)
    .where(sessionWhere(range));

  const [eventRow] = await db
    .select({
      pageViews: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(and(eventWhere(range), eq(analyticsEvents.eventType, "page_view")));

  const sessions = Number(sessionRow?.sessions ?? 0);
  const pageViews = Number(eventRow?.pageViews ?? 0);
  return {
    visitors: Number(sessionRow?.visitors ?? 0),
    sessions,
    pageViews,
    newVisitors: Number(sessionRow?.newSessions ?? 0),
    returningVisitors: Number(sessionRow?.returningSessions ?? 0),
    avgSessionSeconds:
      sessionRow?.avgDuration === null || sessionRow?.avgDuration === undefined
        ? null
        : Math.round(Number(sessionRow.avgDuration)),
    pagesPerSession: sessions > 0 ? Number((pageViews / sessions).toFixed(2)) : null,
    bounceRate:
      sessions > 0 ? Number(((Number(sessionRow?.bounced ?? 0) / sessions) * 100).toFixed(1)) : null,
  };
}

export async function getAnalyticsOverview(
  db: Database,
  range: AnalyticsRange,
): Promise<AnalyticsOverview> {
  const [current, previous] = await Promise.all([
    loadOverviewMetrics(db, range),
    loadOverviewMetrics(db, { from: range.previousFrom, to: range.previousTo }),
  ]);

  const sessionDaily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${analyticsSessions.firstSeen}), 'YYYY-MM-DD')`,
      sessions: sql<number>`count(*)::int`,
      visitors: sql<number>`count(distinct ${analyticsSessions.visitorHash})::int`,
    })
    .from(analyticsSessions)
    .where(sessionWhere(range))
    .groupBy(sql`date_trunc('day', ${analyticsSessions.firstSeen})`)
    .orderBy(sql`date_trunc('day', ${analyticsSessions.firstSeen})`);

  const pageViewDaily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${analyticsEvents.createdAt}), 'YYYY-MM-DD')`,
      pageViews: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(and(eventWhere(range), eq(analyticsEvents.eventType, "page_view")))
    .groupBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`);

  const sessionsByDay = new Map(sessionDaily.map((row) => [row.day, row]));
  const viewsByDay = new Map(pageViewDaily.map((row) => [row.day, row.pageViews]));
  const trend: AnalyticsOverview["trend"] = [];
  for (let time = range.from.getTime(); time < range.to.getTime(); time += 86_400_000) {
    const day = new Date(time).toISOString().slice(0, 10);
    trend.push({
      date: day,
      sessions: Number(sessionsByDay.get(day)?.sessions ?? 0),
      visitors: Number(sessionsByDay.get(day)?.visitors ?? 0),
      pageViews: Number(viewsByDay.get(day) ?? 0),
    });
  }

  return {
    current,
    previous,
    trend,
    hasData: current.sessions > 0 || current.pageViews > 0,
  };
}

export type GeoRow = {
  countryCode: string | null;
  sessions: number;
  visitors: number;
  pageViews: number;
  percentage: number;
  trend: number[];
};

export async function getGeoBreakdown(
  db: Database,
  range: AnalyticsRange,
): Promise<GeoRow[]> {
  const rows = await db
    .select({
      countryCode: analyticsSessions.countryCode,
      sessions: sql<number>`count(*)::int`,
      visitors: sql<number>`count(distinct ${analyticsSessions.visitorHash})::int`,
      pageViews: sql<number>`sum(${analyticsSessions.pageViews})::int`,
    })
    .from(analyticsSessions)
    .where(sessionWhere(range))
    .groupBy(analyticsSessions.countryCode)
    .orderBy(desc(sql`count(*)`));

  const total = rows.reduce((sum, row) => sum + Number(row.sessions), 0);
  const trendRows = await db
    .select({
      countryCode: analyticsSessions.countryCode,
      day: sql<string>`to_char(date_trunc('day', ${analyticsSessions.firstSeen}), 'YYYY-MM-DD')`,
      sessions: sql<number>`count(*)::int`,
    })
    .from(analyticsSessions)
    .where(sessionWhere(range))
    .groupBy(analyticsSessions.countryCode, sql`date_trunc('day', ${analyticsSessions.firstSeen})`);

  const trendMap = new Map<string, Map<string, number>>();
  for (const row of trendRows) {
    const key = row.countryCode ?? "unknown";
    const map = trendMap.get(key) ?? new Map<string, number>();
    map.set(row.day, Number(row.sessions));
    trendMap.set(key, map);
  }

  const days: string[] = [];
  for (let time = range.from.getTime(); time < range.to.getTime(); time += 86_400_000) {
    days.push(new Date(time).toISOString().slice(0, 10));
  }

  return rows.map((row) => ({
    countryCode: row.countryCode,
    sessions: Number(row.sessions),
    visitors: Number(row.visitors),
    pageViews: Number(row.pageViews),
    percentage: total > 0 ? Number(((Number(row.sessions) / total) * 100).toFixed(1)) : 0,
    trend: days.map((day) => Number(trendMap.get(row.countryCode ?? "unknown")?.get(day) ?? 0)),
  }));
}

export type PageRow = {
  path: string;
  title: string | null;
  pageViews: number;
  visitors: number;
  sessions: number;
  entries: number;
  exits: number;
  avgEngagementSeconds: number | null;
};

export async function getPageBreakdown(
  db: Database,
  range: AnalyticsRange,
  filter: { type?: string; country?: string } = {},
): Promise<PageRow[]> {
  const conditions = [eventWhere(range), eq(analyticsEvents.eventType, "page_view")];
  if (filter.country) {
    conditions.push(eq(analyticsEvents.countryCode, filter.country.toUpperCase()));
  }
  const rows = await db
    .select({
      path: analyticsEvents.pagePath,
      title: sql<string | null>`max(${analyticsEvents.pageTitle})`,
      pageViews: sql<number>`count(*)::int`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
    })
    .from(analyticsEvents)
    .where(and(...conditions))
    .groupBy(analyticsEvents.pagePath)
    .orderBy(desc(sql`count(*)`));

  const sessionConditions = [sessionWhere(range)];
  if (filter.country) {
    sessionConditions.push(eq(analyticsSessions.countryCode, filter.country.toUpperCase()));
  }
  const [entryRows, exitRows, visitorRows] = await Promise.all([
    db
      .select({ path: analyticsSessions.entryPath, entries: sql<number>`count(*)::int` })
      .from(analyticsSessions)
      .where(and(...sessionConditions))
      .groupBy(analyticsSessions.entryPath),
    db
      .select({ path: analyticsSessions.exitPath, exits: sql<number>`count(*)::int` })
      .from(analyticsSessions)
      .where(and(...sessionConditions, isNotNull(analyticsSessions.exitPath)))
      .groupBy(analyticsSessions.exitPath),
    db
      .select({
        path: analyticsEvents.pagePath,
        visitors: sql<number>`count(distinct ${analyticsSessions.visitorHash})::int`,
        avgEngagement: sql<number | null>`avg(extract(epoch from (${analyticsSessions.lastSeen} - ${analyticsSessions.firstSeen})))`,
      })
      .from(analyticsEvents)
      .innerJoin(analyticsSessions, eq(analyticsEvents.sessionId, analyticsSessions.id))
      .where(and(...conditions))
      .groupBy(analyticsEvents.pagePath),
  ]);

  const entries = new Map(entryRows.map((row) => [row.path, Number(row.entries)]));
  const exits = new Map(exitRows.map((row) => [row.path ?? "", Number(row.exits)]));
  const visitors = new Map(
    visitorRows.map((row) => [
      row.path,
      { visitors: Number(row.visitors), avg: row.avgEngagement === null ? null : Math.round(Number(row.avgEngagement)) },
    ]),
  );

  const mapped: PageRow[] = rows.map((row) => ({
    path: row.path,
    title: row.title,
    pageViews: Number(row.pageViews),
    visitors: visitors.get(row.path)?.visitors ?? 0,
    sessions: Number(row.sessions),
    entries: entries.get(row.path) ?? 0,
    exits: exits.get(row.path) ?? 0,
    avgEngagementSeconds: visitors.get(row.path)?.avg ?? null,
  }));

  if (!filter.type || filter.type === "all") return mapped;
  return mapped.filter((row) => pageType(row.path) === filter.type);
}

export function pageType(path: string): string {
  if (path === "/" || path === "") return "home";
  if (path.startsWith("/blog")) return "blog";
  if (path.startsWith("/games")) return "games";
  if (path.startsWith("/destinations") || path.startsWith("/regions")) return "destinations";
  if (path.startsWith("/plans")) return "plans";
  if (path.startsWith("/guides") || path.startsWith("/compatibility")) return "guides";
  return "other";
}

export type GameRow = {
  gameId: string;
  opened: number;
  started: number;
  completed: number;
  exited: number;
  sessions: number;
  visitors: number;
  averageSeconds: number | null;
  completionRate: number | null;
};

export async function getGamesBreakdown(
  db: Database,
  range: AnalyticsRange,
): Promise<GameRow[]> {
  const rows = await db
    .select({
      gameId: analyticsEvents.gameId,
      eventType: analyticsEvents.eventType,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
      occurrences: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(and(eventWhere(range), isNotNull(analyticsEvents.gameId)))
    .groupBy(analyticsEvents.gameId, analyticsEvents.eventType);

  const byGame = new Map<string, GameRow & { avgAccumulator: number[] }>();
  for (const row of rows) {
    if (!row.gameId) continue;
    const entry = byGame.get(row.gameId) ?? {
      gameId: row.gameId,
      opened: 0,
      started: 0,
      completed: 0,
      exited: 0,
      sessions: 0,
      visitors: 0,
      averageSeconds: null,
      completionRate: null,
      avgAccumulator: [],
    };
    const occurrences = Number(row.occurrences);
    if (row.eventType === "game_opened") entry.opened += occurrences;
    if (row.eventType === "game_started") entry.started += occurrences;
    if (row.eventType === "game_completed") entry.completed += occurrences;
    if (row.eventType === "game_exited") entry.exited += occurrences;
    entry.sessions = Math.max(entry.sessions, Number(row.sessions));
    byGame.set(row.gameId, entry);
  }

  // Unique visitors and average time per game (per session).
  if (byGame.size > 0) {
    const visitorRows = await db
      .select({
        gameId: analyticsEvents.gameId,
        visitors: sql<number>`count(distinct ${analyticsSessions.visitorHash})::int`,
      })
      .from(analyticsEvents)
      .innerJoin(analyticsSessions, eq(analyticsEvents.sessionId, analyticsSessions.id))
      .where(
        and(
          eventWhere(range),
          isNotNull(analyticsEvents.gameId),
          eq(analyticsSessions.isInternal, false),
        ),
      )
      .groupBy(analyticsEvents.gameId);
    for (const row of visitorRows) {
      const entry = row.gameId ? byGame.get(row.gameId) : undefined;
      if (entry) entry.visitors = Number(row.visitors);
    }

    const durationRows = await db
      .select({
        gameId: analyticsEvents.gameId,
        sessionId: analyticsEvents.sessionId,
        seconds: sql<number>`extract(epoch from (max(${analyticsEvents.createdAt}) - min(${analyticsEvents.createdAt})))`,
      })
      .from(analyticsEvents)
      .where(and(eventWhere(range), isNotNull(analyticsEvents.gameId)))
      .groupBy(analyticsEvents.gameId, analyticsEvents.sessionId);
    for (const row of durationRows) {
      if (!row.gameId) continue;
      byGame.get(row.gameId)?.avgAccumulator.push(Number(row.seconds));
    }
  }

  return [...byGame.values()]
    .map((entry) => {
      const average =
        entry.avgAccumulator.length > 0
          ? Math.round(
              entry.avgAccumulator.reduce((sum, value) => sum + value, 0) /
                entry.avgAccumulator.length,
            )
          : null;
      return {
        gameId: entry.gameId,
        opened: entry.opened,
        started: entry.started,
        completed: entry.completed,
        exited: entry.exited,
        sessions: entry.sessions,
        visitors: entry.visitors,
        averageSeconds: average,
        completionRate:
          entry.started > 0 ? Number(((entry.completed / entry.started) * 100).toFixed(1)) : null,
      };
    })
    .sort((a, b) => b.opened - a.opened || b.started - a.started);
}

export async function getGameDetail(
  db: Database,
  gameId: string,
  range: AnalyticsRange,
): Promise<{
  events: { eventType: string; occurrences: number }[];
  trend: { date: string; occurrences: number }[];
  pages: { path: string; views: number }[];
}> {
  const conditions = [eventWhere(range), eq(analyticsEvents.gameId, gameId)];
  const [eventRows, trendRows, pageRows] = await Promise.all([
    db
      .select({ eventType: analyticsEvents.eventType, occurrences: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(and(...conditions))
      .groupBy(analyticsEvents.eventType),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${analyticsEvents.createdAt}), 'YYYY-MM-DD')`,
        occurrences: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(and(...conditions))
      .groupBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`)
      .orderBy(sql`date_trunc('day', ${analyticsEvents.createdAt})`),
    db
      .select({ path: analyticsEvents.pagePath, views: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(and(...conditions))
      .groupBy(analyticsEvents.pagePath)
      .orderBy(desc(sql`count(*)`)),
  ]);

  return {
    events: eventRows.map((row) => ({
      eventType: row.eventType,
      occurrences: Number(row.occurrences),
    })),
    trend: trendRows.map((row) => ({ date: row.day, occurrences: Number(row.occurrences) })),
    pages: pageRows.map((row) => ({ path: row.path, views: Number(row.views) })),
  };
}

export type ActivityRow = {
  eventType: string;
  occurrences: number;
  sessions: number;
  visitors: number;
  lastSeen: Date | null;
};

export async function getActivityBreakdown(
  db: Database,
  range: AnalyticsRange,
): Promise<ActivityRow[]> {
  const rows = await db
    .select({
      eventType: analyticsEvents.eventType,
      occurrences: sql<number>`count(*)::int`,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
      visitors: sql<number>`count(distinct ${analyticsSessions.visitorHash})::int`,
      lastSeen: sql<Date | null>`max(${analyticsEvents.createdAt})`,
    })
    .from(analyticsEvents)
    .innerJoin(analyticsSessions, eq(analyticsEvents.sessionId, analyticsSessions.id))
    .where(and(eventWhere(range), eq(analyticsSessions.isInternal, false)))
    .groupBy(analyticsEvents.eventType)
    .orderBy(desc(sql`count(*)`));
  return rows
    .filter((row) => row.eventType !== "page_view")
    .map((row) => ({
      eventType: row.eventType,
      occurrences: Number(row.occurrences),
      sessions: Number(row.sessions),
      visitors: Number(row.visitors),
      lastSeen: row.lastSeen ? new Date(row.lastSeen) : null,
    }));
}

export async function getRecentActivity(
  db: Database,
  limit = 25,
): Promise<
  {
    id: string;
    eventType: string;
    pagePath: string;
    gameId: string | null;
    countryCode: string | null;
    createdAt: Date;
  }[]
> {
  const rows = await db
    .select({
      id: analyticsEvents.id,
      eventType: analyticsEvents.eventType,
      pagePath: analyticsEvents.pagePath,
      gameId: analyticsEvents.gameId,
      countryCode: analyticsEvents.countryCode,
      createdAt: analyticsEvents.createdAt,
    })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.isInternal, false))
    .orderBy(desc(analyticsEvents.createdAt))
    .limit(Math.min(100, Math.max(1, limit)));
  return rows;
}

export type SourceRow = {
  source: string;
  sessions: number;
  visitors: number;
  pageViews: number;
  percentage: number;
};

export async function getSourceBreakdown(
  db: Database,
  range: AnalyticsRange,
): Promise<{
  sources: SourceRow[];
  referrers: { host: string; sessions: number }[];
  devices: { deviceType: string; sessions: number; percentage: number }[];
  browsers: { browser: string; sessions: number }[];
  operatingSystems: { os: string; sessions: number }[];
}> {
  const rows = await db
    .select({
      source: analyticsSessions.source,
      sessions: sql<number>`count(*)::int`,
      visitors: sql<number>`count(distinct ${analyticsSessions.visitorHash})::int`,
      pageViews: sql<number>`sum(${analyticsSessions.pageViews})::int`,
    })
    .from(analyticsSessions)
    .where(sessionWhere(range))
    .groupBy(analyticsSessions.source)
    .orderBy(desc(sql`count(*)`));

  const total = rows.reduce((sum, row) => sum + Number(row.sessions), 0);
  const sources = rows.map((row) => ({
    source: row.source,
    sessions: Number(row.sessions),
    visitors: Number(row.visitors),
    pageViews: Number(row.pageViews),
    percentage: total > 0 ? Number(((Number(row.sessions) / total) * 100).toFixed(1)) : 0,
  }));

  const referrerRows = await db
    .select({
      referrer: analyticsSessions.referrer,
      sessions: sql<number>`count(*)::int`,
    })
    .from(analyticsSessions)
    .where(and(sessionWhere(range), isNotNull(analyticsSessions.referrer)))
    .groupBy(analyticsSessions.referrer)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  const referrers = referrerRows
    .map((row) => {
      const host = referrerHost(row.referrer) ?? row.referrer?.toLowerCase() ?? null;
      return host ? { host, sessions: Number(row.sessions) } : null;
    })
    .filter((row): row is { host: string; sessions: number } => row !== null);

  const deviceRows = await db
    .select({ deviceType: analyticsSessions.deviceType, sessions: sql<number>`count(*)::int` })
    .from(analyticsSessions)
    .where(sessionWhere(range))
    .groupBy(analyticsSessions.deviceType)
    .orderBy(desc(sql`count(*)`));
  const deviceTotal = deviceRows.reduce((sum, row) => sum + Number(row.sessions), 0);
  const devices = deviceRows.map((row) => ({
    deviceType: row.deviceType,
    sessions: Number(row.sessions),
    percentage: deviceTotal > 0 ? Number(((Number(row.sessions) / deviceTotal) * 100).toFixed(1)) : 0,
  }));

  const browsers = (
    await db
      .select({ browser: analyticsSessions.browser, sessions: sql<number>`count(*)::int` })
      .from(analyticsSessions)
      .where(sessionWhere(range))
      .groupBy(analyticsSessions.browser)
      .orderBy(desc(sql`count(*)`))
  ).map((row) => ({ browser: row.browser, sessions: Number(row.sessions) }));

  const operatingSystems = (
    await db
      .select({ os: analyticsSessions.os, sessions: sql<number>`count(*)::int` })
      .from(analyticsSessions)
      .where(sessionWhere(range))
      .groupBy(analyticsSessions.os)
      .orderBy(desc(sql`count(*)`))
  ).map((row) => ({ os: row.os, sessions: Number(row.sessions) }));

  return { sources, referrers, devices, browsers, operatingSystems };
}

export async function hasAnyAnalyticsData(db: Database): Promise<boolean> {
  const [row] = await db
    .select({ id: analyticsEvents.id })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.isInternal, false))
    .limit(1);
  return Boolean(row);
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}
