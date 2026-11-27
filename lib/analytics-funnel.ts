/**
 * Funnel and scroll-depth reports for the admin analytics page.
 *
 * Browsing stages are counted as distinct analytics sessions (pseudonymous,
 * consent-based, internal traffic excluded). Payment and delivery come from
 * order records, because payment confirmation never depends on analytics.
 * The two halves are labelled separately; they are not joined per person.
 */
import { and, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { analyticsEvents, analyticsSessions, orders } from "@/lib/db/schema";

export const FUNNEL_STAGES = [
  { key: "page_view", label: "Visited a page" },
  { key: "destination_viewed", label: "Viewed a destination" },
  { key: "plan_viewed", label: "Viewed a plan" },
  { key: "cart_item_added", label: "Added to cart" },
  { key: "checkout_started", label: "Started checkout" },
] as const;

export type FunnelGroup = "all" | "device" | "source" | "country";

export interface FunnelRow {
  group: string;
  stages: number[];
}

export interface FunnelReport {
  stages: Array<{ key: string; label: string; count: number; fromPrevious: number | null; fromFirst: number | null }>;
  paidOrders: number;
  deliveredOrders: number;
  byGroup: FunnelRow[];
  group: FunnelGroup;
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

export async function getFunnelReport(
  db: Database,
  range: { from: Date; to: Date },
  group: FunnelGroup = "all",
): Promise<FunnelReport> {
  const stageKeys = FUNNEL_STAGES.map((s) => s.key);
  const groupColumn =
    group === "device"
      ? analyticsSessions.deviceType
      : group === "source"
        ? analyticsSessions.source
        : group === "country"
          ? sql<string>`coalesce(${analyticsSessions.countryCode}, 'unknown')`
          : sql<string>`'unknown'`;

  const rows = group === "all" ? [] : await db
    .select({
      group: groupColumn,
      eventType: analyticsEvents.eventType,
      sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int`,
    })
    .from(analyticsEvents)
    .innerJoin(analyticsSessions, eq(analyticsSessions.id, analyticsEvents.sessionId))
    .where(
      and(
        inArray(analyticsEvents.eventType, stageKeys),
        eq(analyticsEvents.isInternal, false),
        gte(analyticsEvents.createdAt, range.from),
        lt(analyticsEvents.createdAt, range.to),
      ),
    )
    .groupBy(groupColumn, analyticsEvents.eventType);

  const byGroupMap = new Map<string, number[]>();
  for (const row of rows) {
    const key = String(row.group ?? "unknown");
    const stages = byGroupMap.get(key) ?? stageKeys.map(() => 0);
    stages[stageKeys.indexOf(row.eventType as (typeof stageKeys)[number])] = Number(row.sessions);
    byGroupMap.set(key, stages);
  }

  // Overall stage counts (distinct sessions across all groups).
  const overall = await db
    .select({ eventType: analyticsEvents.eventType, sessions: sql<number>`count(distinct ${analyticsEvents.sessionId})::int` })
    .from(analyticsEvents)
    .where(
      and(
        inArray(analyticsEvents.eventType, stageKeys),
        eq(analyticsEvents.isInternal, false),
        gte(analyticsEvents.createdAt, range.from),
        lt(analyticsEvents.createdAt, range.to),
      ),
    )
    .groupBy(analyticsEvents.eventType);
  const counts = stageKeys.map((key) => Number(overall.find((r) => r.eventType === key)?.sessions ?? 0));

  const [paid, delivered] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          inArray(orders.paymentStatus, ["paid", "partially_refunded", "refunded", "disputed"]),
          isNotNull(orders.paidAt),
          gte(orders.paidAt, range.from),
          lt(orders.paidAt, range.to),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(eq(orders.fulfillmentStatus, "delivered"), isNotNull(orders.paidAt), gte(orders.paidAt, range.from), lt(orders.paidAt, range.to)),
      ),
  ]);

  return {
    stages: FUNNEL_STAGES.map((stage, index) => ({
      key: stage.key,
      label: stage.label,
      count: counts[index]!,
      fromPrevious: index === 0 ? null : pct(counts[index]!, counts[index - 1]!),
      fromFirst: index === 0 ? null : pct(counts[index]!, counts[0]!),
    })),
    paidOrders: Number(paid[0]?.n ?? 0),
    deliveredOrders: Number(delivered[0]?.n ?? 0),
    byGroup: (group === "all" ? [["all", counts] as [string, number[]]] : [...byGroupMap.entries()])
      .map(([g, stages]) => ({ group: g, stages }))
      .sort((a, b) => b.stages[0]! - a.stages[0]!)
      .slice(0, 12),
    group,
  };
}

export interface ScrollReport {
  milestones: Array<{ depth: number; events: number }>;
  pages: Array<{ path: string; views: number; reached50: number; reached90: number }>;
}

/** Scroll milestones from consent-based `scroll_depth` events (25/50/75/90). */
export async function getScrollReport(db: Database, range: { from: Date; to: Date }): Promise<ScrollReport> {
  const window = and(
    eq(analyticsEvents.isInternal, false),
    gte(analyticsEvents.createdAt, range.from),
    lt(analyticsEvents.createdAt, range.to),
  );
  const depthExpr = sql<string>`${analyticsEvents.metadata}->>'depth'`;
  const [milestones, perPage, views] = await Promise.all([
    db
      .select({ depth: depthExpr, n: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.eventType, "scroll_depth"), window))
      .groupBy(depthExpr),
    db
      .select({ path: analyticsEvents.pagePath, depth: depthExpr, n: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.eventType, "scroll_depth"), window))
      .groupBy(analyticsEvents.pagePath, depthExpr),
    db
      .select({ path: analyticsEvents.pagePath, n: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.eventType, "page_view"), window))
      .groupBy(analyticsEvents.pagePath),
  ]);
  const pages = new Map<string, { views: number; reached50: number; reached90: number }>();
  for (const v of views) pages.set(v.path, { views: Number(v.n), reached50: 0, reached90: 0 });
  for (const row of perPage) {
    const entry = pages.get(row.path) ?? { views: 0, reached50: 0, reached90: 0 };
    if (row.depth === "50") entry.reached50 = Number(row.n);
    if (row.depth === "90") entry.reached90 = Number(row.n);
    pages.set(row.path, entry);
  }
  return {
    milestones: [25, 50, 75, 90].map((depth) => ({
      depth,
      events: Number(milestones.find((m) => m.depth === String(depth))?.n ?? 0),
    })),
    pages: [...pages.entries()]
      .map(([path, v]) => ({ path, ...v }))
      .filter((p) => p.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 15),
  };
}
