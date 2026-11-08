import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import {
  analyticsEvents,
  analyticsSessions,
  analyticsVisitors,
  dataRetentionSettings,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import {
  ANALYTICS_RETENTION_KEYS,
  DEFAULT_ANALYTICS_RETENTION_DAYS,
  cleanupAnalytics,
  loadAnalyticsRetentionPolicy,
  normalizeRetentionDays,
} from "@/lib/retention";
import { makeTestDb } from "./helpers/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

function daysAgo(days: number): Date {
  return new Date(NOW - days * DAY_MS);
}

async function seedActivity(
  handle: DatabaseHandle,
  key: string,
  options: { eventDaysAgo: number; aggregateDaysAgo: number },
): Promise<{ sessionId: string; visitorId: string; eventId: string }> {
  const visitorHash = `retention-visitor-${key}`;
  const sessionHash = `retention-session-${key}`;
  const visitorId = newId("av");
  const sessionId = newId("as");
  const eventId = newId("ae");
  const aggregateSeen = daysAgo(options.aggregateDaysAgo);

  await handle.db.insert(analyticsVisitors).values({
    id: visitorId,
    visitorHash,
    firstSeen: aggregateSeen,
    lastSeen: aggregateSeen,
    sessionCount: 1,
  });
  await handle.db.insert(analyticsSessions).values({
    id: sessionId,
    sessionHash,
    visitorHash,
    firstSeen: aggregateSeen,
    lastSeen: aggregateSeen,
    pageViews: 1,
    events: 1,
  });
  await handle.db.insert(analyticsEvents).values({
    id: eventId,
    sessionId,
    eventType: "page_view",
    pagePath: "/retention-test",
    createdAt: daysAgo(options.eventDaysAgo),
  });

  return { sessionId, visitorId, eventId };
}

async function countRows(handle: DatabaseHandle, id: string, table: "events" | "sessions" | "visitors") {
  if (table === "events") {
    const rows = await handle.db
      .select({ id: analyticsEvents.id })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.id, id));
    return rows.length;
  }
  if (table === "sessions") {
    const rows = await handle.db
      .select({ id: analyticsSessions.id })
      .from(analyticsSessions)
      .where(eq(analyticsSessions.id, id));
    return rows.length;
  }
  const rows = await handle.db
    .select({ id: analyticsVisitors.id })
    .from(analyticsVisitors)
    .where(eq(analyticsVisitors.id, id));
  return rows.length;
}

async function setRetention(
  handle: DatabaseHandle,
  dataKey: string,
  retentionDays: number | null,
  enabled: boolean,
): Promise<void> {
  await handle.db
    .insert(dataRetentionSettings)
    .values({
      id: `retention_${dataKey}`,
      dataKey,
      label: dataKey,
      retentionDays,
      basis: "technical_default",
      automated: enabled,
      enabled,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: dataRetentionSettings.dataKey,
      set: {
        retentionDays,
        automated: enabled,
        enabled,
        updatedAt: new Date(),
      },
    });
}

describe("analytics retention policy", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  beforeEach(async () => {
    await handle.db.delete(analyticsEvents);
    await handle.db.delete(analyticsSessions);
    await handle.db.delete(analyticsVisitors);
    await handle.db
      .delete(dataRetentionSettings)
      .where(inArray(dataRetentionSettings.dataKey, [...ANALYTICS_RETENTION_KEYS]));
    await handle.db.insert(dataRetentionSettings).values([
      {
        id: "retention_analytics_events",
        dataKey: "analytics_events",
        label: "Raw first-party analytics events",
        retentionDays: DEFAULT_ANALYTICS_RETENTION_DAYS.analytics_events,
        basis: "technical_default",
        automated: true,
        enabled: true,
        updatedAt: new Date(),
      },
      {
        id: "retention_analytics_aggregates",
        dataKey: "analytics_aggregates",
        label: "Aggregated analytics sessions and visitors",
        retentionDays: DEFAULT_ANALYTICS_RETENTION_DAYS.analytics_aggregates,
        basis: "technical_default",
        automated: true,
        enabled: true,
        updatedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await handle.close();
  });

  it("normalizes retention days safely", () => {
    expect(normalizeRetentionDays(395)).toBe(395);
    expect(normalizeRetentionDays(1)).toBe(1);
    expect(normalizeRetentionDays(0)).toBeNull();
    expect(normalizeRetentionDays(-5)).toBeNull();
    expect(normalizeRetentionDays(12.9)).toBe(12);
    expect(normalizeRetentionDays(Number.NaN)).toBeNull();
    expect(normalizeRetentionDays("30")).toBeNull();
  });

  it("uses the 0006 seed defaults when retention rows are missing", async () => {
    await handle.db
      .delete(dataRetentionSettings)
      .where(inArray(dataRetentionSettings.dataKey, [...ANALYTICS_RETENTION_KEYS]));

    const policy = await loadAnalyticsRetentionPolicy(handle.db);
    expect(policy).toMatchObject({
      eventsDays: DEFAULT_ANALYTICS_RETENTION_DAYS.analytics_events,
      aggregatesDays: DEFAULT_ANALYTICS_RETENTION_DAYS.analytics_aggregates,
      eventsSource: "default",
      aggregatesSource: "default",
    });

    const mixed = await seedActivity(handle, "defaults-mixed", {
      eventDaysAgo: 500,
      aggregateDaysAgo: 500,
    });
    const result = await cleanupAnalytics(handle.db);
    expect(result.events).toBeGreaterThanOrEqual(1);
    expect(result.sessions).toBe(0);
    expect(result.visitors).toBe(0);
    expect(await countRows(handle, mixed.eventId, "events")).toBe(0);
    expect(await countRows(handle, mixed.sessionId, "sessions")).toBe(1);
    expect(await countRows(handle, mixed.visitorId, "visitors")).toBe(1);

    const old = await seedActivity(handle, "defaults-old", {
      eventDaysAgo: 800,
      aggregateDaysAgo: 800,
    });
    const second = await cleanupAnalytics(handle.db);
    expect(second.sessions).toBeGreaterThanOrEqual(1);
    expect(second.visitors).toBeGreaterThanOrEqual(1);
    expect(await countRows(handle, old.sessionId, "sessions")).toBe(0);
    expect(await countRows(handle, old.visitorId, "visitors")).toBe(0);
  });

  it("applies database settings separately to events and aggregates", async () => {
    await setRetention(handle, "analytics_events", 10, true);
    await setRetention(handle, "analytics_aggregates", 20, true);

    const policy = await loadAnalyticsRetentionPolicy(handle.db);
    expect(policy.eventsDays).toBe(10);
    expect(policy.aggregatesDays).toBe(20);
    expect(policy.eventsSource).toBe("database");
    expect(policy.aggregatesSource).toBe("database");

    const recent = await seedActivity(handle, "settings-15d", {
      eventDaysAgo: 15,
      aggregateDaysAgo: 15,
    });
    const first = await cleanupAnalytics(handle.db);
    expect(first.events).toBeGreaterThanOrEqual(1);
    expect(first.sessions).toBe(0);
    expect(first.visitors).toBe(0);
    expect(await countRows(handle, recent.eventId, "events")).toBe(0);
    expect(await countRows(handle, recent.sessionId, "sessions")).toBe(1);

    await setRetention(handle, "analytics_aggregates", 10, true);

    const second = await cleanupAnalytics(handle.db);
    expect(second.sessions).toBeGreaterThanOrEqual(1);
    expect(second.visitors).toBeGreaterThanOrEqual(1);
    expect(await countRows(handle, recent.sessionId, "sessions")).toBe(0);
    expect(await countRows(handle, recent.visitorId, "visitors")).toBe(0);
  });

  it("does not delete a category whose automation is disabled", async () => {
    await setRetention(handle, "analytics_events", 1, false);
    await setRetention(handle, "analytics_aggregates", 1, false);

    const kept = await seedActivity(handle, "disabled", {
      eventDaysAgo: 10,
      aggregateDaysAgo: 10,
    });
    const result = await cleanupAnalytics(handle.db);
    expect(result.events).toBe(0);
    expect(result.sessions).toBe(0);
    expect(result.visitors).toBe(0);
    expect(await countRows(handle, kept.eventId, "events")).toBe(1);
    expect(await countRows(handle, kept.sessionId, "sessions")).toBe(1);
    expect(await countRows(handle, kept.visitorId, "visitors")).toBe(1);
  });

  it("falls back to the reviewed default when an enabled row has an invalid period", async () => {
    await setRetention(handle, "analytics_events", 0, true);

    const policy = await loadAnalyticsRetentionPolicy(handle.db);
    expect(policy.eventsDays).toBe(DEFAULT_ANALYTICS_RETENTION_DAYS.analytics_events);
    expect(policy.eventsSource).toBe("default");

    const rows = await handle.db
      .select({ dataKey: dataRetentionSettings.dataKey })
      .from(dataRetentionSettings)
      .where(
        and(
          eq(dataRetentionSettings.dataKey, "analytics_events"),
          eq(dataRetentionSettings.enabled, true),
        ),
      );
    expect(rows).toHaveLength(1);
  });
});
