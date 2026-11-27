/** Funnel and scroll-depth reports, and validation of the new events (test data). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/lib/db/client";
import { analyticsEvents, analyticsSessions } from "@/lib/db/schema";
import { getFunnelReport, getScrollReport } from "@/lib/analytics-funnel";
import { validateTrackingPayload } from "@/lib/analytics-web";
import { makeTestDb } from "./helpers/db";

describe("funnel and scroll reports (test data)", () => {
  let handle: DatabaseHandle;
  const range = { from: new Date(Date.now() - 86_400_000), to: new Date(Date.now() + 86_400_000) };

  beforeAll(async () => {
    handle = await makeTestDb();
    const sessions = [
      { id: "sess_test_a", device: "mobile", source: "google", stages: ["page_view", "destination_viewed", "plan_viewed", "cart_item_added", "checkout_started"] },
      { id: "sess_test_b", device: "desktop", source: "direct", stages: ["page_view", "destination_viewed", "plan_viewed"] },
      { id: "sess_test_c", device: "mobile", source: "google", stages: ["page_view"] },
    ];
    for (const s of sessions) {
      await handle.db.insert(analyticsSessions).values({ id: s.id, sessionHash: `hash_${s.id}`, deviceType: s.device, source: s.source });
      for (const type of s.stages) {
        await handle.db.insert(analyticsEvents).values({ id: `evt_${s.id}_${type}`, sessionId: s.id, eventType: type, pagePath: "/destinations/japan" });
      }
    }
    // An internal (staff) session must never count.
    await handle.db.insert(analyticsSessions).values({ id: "sess_test_internal", sessionHash: "hash_internal", isInternal: true });
    await handle.db.insert(analyticsEvents).values({ id: "evt_internal", sessionId: "sess_test_internal", eventType: "page_view", isInternal: true });
    for (const depth of [25, 50, 75, 90]) {
      await handle.db.insert(analyticsEvents).values({
        id: `evt_scroll_${depth}`,
        sessionId: "sess_test_a",
        eventType: "scroll_depth",
        pagePath: "/destinations/japan",
        metadata: { depth },
      });
    }
  }, 180_000);
  afterAll(async () => handle.close());

  it("counts distinct sessions per stage with conversion rates, excluding internal traffic", async () => {
    const report = await getFunnelReport(handle.db, range);
    expect(report.stages.map((s) => s.count)).toEqual([3, 2, 2, 1, 1]);
    expect(report.stages[1]!.fromPrevious).toBe(66.7);
    expect(report.stages[4]!.fromFirst).toBe(33.3);
  });

  it("segments the funnel by device and by source", async () => {
    const device = await getFunnelReport(handle.db, range, "device");
    expect(device.byGroup.find((g) => g.group === "mobile")?.stages).toEqual([2, 1, 1, 1, 1]);
    const source = await getFunnelReport(handle.db, range, "source");
    expect(source.byGroup.find((g) => g.group === "direct")?.stages).toEqual([1, 1, 1, 0, 0]);
  });

  it("reports scroll milestones and per-page reach", async () => {
    const scroll = await getScrollReport(handle.db, range);
    expect(scroll.milestones).toEqual([
      { depth: 25, events: 1 },
      { depth: 50, events: 1 },
      { depth: 75, events: 1 },
      { depth: 90, events: 1 },
    ]);
    expect(scroll.pages.find((p) => p.path === "/destinations/japan")).toMatchObject({ views: 3, reached90: 1 });
  });
});

describe("tracking validation for the new events", () => {
  it("accepts scroll and payment-method events and strips sensitive metadata keys", () => {
    const payload = validateTrackingPayload({
      visitorId: "visitor_test_1",
      sessionId: "session_test_1",
      events: [
        { type: "scroll_depth", path: "/plans", metadata: { depth: 75 } },
        { type: "payment_method_selected", path: "/checkout", metadata: { method: "card", cardNumber: "4242424242424242", email: "x@y.z" } },
      ],
    });
    expect(payload?.events.map((e) => e.type)).toEqual(["scroll_depth", "payment_method_selected"]);
    expect(payload?.events[1]!.metadata).toEqual({ method: "card" });
  });
});
