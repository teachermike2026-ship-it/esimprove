import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import {
  auditLogs,
  destinations,
  fulfillmentJobs,
  orderItems,
  orders,
  plans,
  refunds,
  regions,
  supportTickets,
  users,
} from "@/lib/db/schema";
import {
  getCatalogueAnalytics,
  getCommerceKpis,
  getDemoOrderValue,
  getOrdersSeries,
  getRegistrationsSeries,
  listCustomers,
  resolveCommerceRange,
} from "@/lib/analytics-commerce";

const utcNow = new Date();
const todayUtc = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate()));
const monthStart = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), 1));
const daysAgo = (n: number) => new Date(todayUtc.getTime() - n * 86_400_000 + 12 * 3_600_000);
/** Guaranteed inside the current calendar month, but not necessarily today. */
const thisMonthSafe = new Date(Math.max(monthStart.getTime() + 3_600_000, utcNow.getTime() - 2 * 86_400_000));
/** Guaranteed to be today. */
const todayAnchor = new Date(utcNow.getTime() - 30 * 60_000);

let handle: DatabaseHandle;

beforeAll(async () => {
  handle = await createDatabase({ dataDir: "memory://", connectionString: "" });
  await runMigrations(handle.client, handle.dialect);

  await handle.db.insert(regions).values({
    id: "region-1", slug: "europe", name: "Europe", description: "Europe", sortOrder: 1,
  });
  await handle.db.insert(destinations).values({
    id: "dest-1", regionId: "region-1", slug: "france", countryCode: "FR",
    name: "France", summary: "France eSIM", description: "France eSIM plans",
  });
  await handle.db.insert(plans).values([
    {
      id: "plan-1", destinationId: "dest-1", slug: "fr-10gb", name: "France 10GB",
      supplierKey: "mock", supplierProductId: "fr-10gb", dataMb: 10240, validityDays: 30,
      costMinor: 500, markupBps: 2000, priceMinor: 1000, currency: "USD",
      coverageSummary: "France", networkSummary: "4G/5G", description: "Plan",
      features: [], status: "published",
    },
    {
      id: "plan-2", destinationId: "dest-1", slug: "fr-draft", name: "France Draft",
      supplierKey: "mock", supplierProductId: "fr-draft", dataMb: 2048, validityDays: 7,
      costMinor: 100, markupBps: 2000, priceMinor: 300, currency: "USD",
      coverageSummary: "France", networkSummary: "4G", description: "Plan",
      features: [], status: "draft",
    },
    {
      id: "plan-3", destinationId: "dest-1", slug: "fr-zero", name: "France ZeroOrders",
      supplierKey: "mock", supplierProductId: "fr-zero", dataMb: 5120, validityDays: 15,
      costMinor: 250, markupBps: 2000, priceMinor: 600, currency: "USD",
      coverageSummary: "France", networkSummary: "4G", description: "Plan",
      features: [], status: "published",
    },
  ]);
  await handle.db.insert(users).values([
    {
      id: "user-1", email: "alice@example.test", name: "Alice Example",
      passwordHash: "hash", role: "customer", emailVerifiedAt: thisMonthSafe,
      createdAt: thisMonthSafe, updatedAt: thisMonthSafe,
    },
    {
      id: "user-2", email: "bob@example.test", name: "Bob Example",
      passwordHash: "hash", role: "customer", emailVerifiedAt: daysAgo(40),
      createdAt: daysAgo(40), updatedAt: daysAgo(40),
    },
    {
      id: "user-3", email: "carol@example.test", name: "Carol Example",
      passwordHash: "hash", role: "customer",
      createdAt: thisMonthSafe, updatedAt: thisMonthSafe,
    },
  ]);
  const mk = (id: string, createdAt: Date, paymentStatus: string, totalMinor: number, currency: string) => ({
    id, orderNumber: `ORD-${id}`, email: "buyer@example.test", customerName: "Buyer",
    country: "FR", userId: id === "order-1" || id === "order-2" ? "user-1" : id === "order-4" ? "user-3" : null,
    status: "paid", paymentStatus, fulfillmentStatus: "not_started",
    subtotalMinor: totalMinor, taxMinor: 0, totalMinor, currency,
    idempotencyKey: `idem-${id}`, termsVersion: "2026-01-01", isDemo: true,
    createdAt, updatedAt: createdAt,
  });
  await handle.db.insert(orders).values([
    mk("order-1", todayAnchor, "paid", 1000, "USD"),
    mk("order-2", thisMonthSafe, "pending", 500, "USD"),
    mk("order-3", daysAgo(40), "paid", 2000, "EUR"),
    mk("order-4", thisMonthSafe, "paid", 700, "USD"),
  ]);
  await handle.db.insert(orderItems).values({
    id: "item-1", orderId: "order-1", planId: "plan-1", planName: "France 10GB",
    quantity: 2, unitPriceMinor: 500, totalMinor: 1000, costMinor: 250,
    supplierKey: "mock", supplierProductId: "fr-10gb", dataMb: 10240, validityDays: 30,
    currency: "USD", createdAt: thisMonthSafe,
  });
  await handle.db.insert(refunds).values({
    id: "refund-1", orderId: "order-1", amountMinor: 1000, currency: "USD",
    reason: "test", status: "requested", idempotencyKey: "refund-idem-1",
    createdAt: thisMonthSafe, updatedAt: thisMonthSafe,
  });
  await handle.db.insert(supportTickets).values([
    { id: "ticket-1", userId: "user-1", requesterEmail: "alice@example.test", subject: "Help", status: "open", createdAt: thisMonthSafe, updatedAt: thisMonthSafe },
    { id: "ticket-2", userId: "user-2", requesterEmail: "bob@example.test", subject: "Closed", status: "closed", createdAt: daysAgo(10), updatedAt: daysAgo(10) },
  ]);
  await handle.db.insert(fulfillmentJobs).values({
    id: "job-1", orderId: "order-1", orderItemId: "item-1", status: "failed",
    idempotencyKey: "job-idem-1", createdAt: thisMonthSafe, updatedAt: thisMonthSafe,
  });
  await handle.db.insert(auditLogs).values({
    id: "audit-1", actorType: "user", actorId: "admin-1", action: "admin.plan.update",
    entityType: "plan", entityId: "plan-1", metadata: {}, createdAt: thisMonthSafe,
  });
});

afterAll(async () => {
  await handle.close();
});

describe("resolveCommerceRange", () => {
  it("uses UTC day boundaries", () => {
    const today = resolveCommerceRange("today");
    expect(today.from?.getTime()).toBe(todayUtc.getTime());
    expect(today.to.getTime() - today.from!.getTime()).toBe(86_400_000);
    const seven = resolveCommerceRange("7d");
    expect(Math.round((seven.to.getTime() - seven.from!.getTime()) / 86_400_000)).toBe(7);
    expect(seven.from?.getTime()).toBe(todayUtc.getTime() - 6 * 86_400_000);
    expect(resolveCommerceRange("30d").from?.getTime()).toBe(todayUtc.getTime() - 29 * 86_400_000);
    expect(resolveCommerceRange("90d").from?.getTime()).toBe(todayUtc.getTime() - 89 * 86_400_000);
  });

  it("returns an unbounded month-bucket range for all time", () => {
    const all = resolveCommerceRange("all");
    expect(all.from).toBeNull();
    expect(all.bucket).toBe("month");
  });

  it("falls back to 7d for unknown keys", () => {
    expect(resolveCommerceRange("nonsense").key).toBe("7d");
  });
});

describe("getCommerceKpis", () => {
  it("returns zeroes on an empty database", async () => {
    const empty = await createDatabase({ dataDir: "memory://", connectionString: "" });
    try {
      await runMigrations(empty.client, empty.dialect);
      const kpis = await getCommerceKpis(empty.db);
      expect(kpis).toEqual({
        ordersTotal: 0,
        ordersToday: 0,
        ordersThisMonth: 0,
        customersTotal: 0,
        customersNewThisMonth: 0,
        publishedPlans: 0,
        destinationsTotal: 0,
        pendingRefunds: 0,
        openSupportTickets: 0,
        failedJobs: 0,
      });
    } finally {
      await empty.close();
    }
  });

  it("counts seeded rows with UTC boundaries", async () => {
    const kpis = await getCommerceKpis(handle.db);
    expect(kpis.ordersTotal).toBe(4);
    expect(kpis.ordersToday).toBe(1);
    expect(kpis.ordersThisMonth).toBe(3);
    expect(kpis.customersTotal).toBe(3);
    expect(kpis.customersNewThisMonth).toBe(2);
    expect(kpis.publishedPlans).toBe(2);
    expect(kpis.destinationsTotal).toBe(1);
    expect(kpis.pendingRefunds).toBe(1);
    expect(kpis.openSupportTickets).toBe(1);
    expect(kpis.failedJobs).toBe(1);
  });
});

describe("series zero-fill", () => {
  it("produces exactly `days` points for the 7d/30d/90d ranges", async () => {
    for (const key of ["7d", "30d", "90d"] as const) {
      const series = await getOrdersSeries(handle.db, resolveCommerceRange(key));
      const expected = key === "7d" ? 7 : key === "30d" ? 30 : 90;
      expect(series).toHaveLength(expected);
    }
    const registrations = await getRegistrationsSeries(handle.db, resolveCommerceRange("7d"));
    expect(registrations).toHaveLength(7);
  });

  it("emits month buckets for all-time ranges", async () => {
    const series = await getOrdersSeries(handle.db, resolveCommerceRange("all"));
    expect(series.length).toBeGreaterThanOrEqual(2);
    expect(series[0].bucket).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("getDemoOrderValue", () => {
  it("sums only paid orders and keeps currencies separate", async () => {
    const value = await getDemoOrderValue(handle.db, resolveCommerceRange("all"));
    expect(value.byCurrency).toHaveLength(2);
    expect(value.primaryCurrency).toBe("USD");
    expect(value.totalMinor).toBe(1000 + 700 + 2000);
    const usd = value.byCurrency.find((row) => row.currency === "USD");
    expect(usd?.totalMinor).toBe(1700);
  });
});

describe("listCustomers", () => {
  it("filters by name or email and reports DEMO paid value", async () => {
    const result = await listCustomers(handle.db, { q: "alice", page: 1, pageSize: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].email).toBe("alice@example.test");
    expect(result.items[0].orders).toBe(2);
    expect(result.items[0].paidValueMinor).toBe(1000);
    expect(result.total).toBe(1);
  });

  it("paginates server-side", async () => {
    const page1 = await listCustomers(handle.db, { page: 1, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page1.totalPages).toBe(2);
    const page2 = await listCustomers(handle.db, { page: 2, pageSize: 2 });
    expect(page2.items).toHaveLength(1);
  });
});

describe("getCatalogueAnalytics", () => {
  it("reports status counts, zero-order published plans, and catalogue changes", async () => {
    const catalogue = await getCatalogueAnalytics(handle.db);
    expect(catalogue.plansByStatus.published).toBe(2);
    expect(catalogue.plansByStatus.draft).toBe(1);
    expect(catalogue.zeroOrderPlans).toBe(1);
    expect(catalogue.zeroOrderPlanList.map((plan) => plan.name)).toContain("France ZeroOrders");
    expect(catalogue.recentChanges.some((change) => change.action === "admin.plan.update")).toBe(true);
  });
});
