import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import {
  auditLogs,
  destinations,
  orderAccessTokens,
  plans,
  regions,
  users,
} from "@/lib/db/schema";
import { addCartItem, getOrCreateCart } from "@/lib/cart";
import { createCheckout } from "@/lib/checkout";
import {
  getDestinationBySlug,
  getDestinations,
  getFeaturedPlans,
  getPlanBySlug,
  getPlanPriceRange,
  getPlans,
  getPlansForDestination,
  getRegions,
} from "@/lib/catalog";
import { canViewOrder, getOrderByNumber, getOrderViewByNumber } from "@/lib/orders";
import { hashToken } from "@/lib/crypto";
import { decryptSecret } from "@/lib/crypto";
import { verifyPassword } from "@/lib/auth/password";
import { totpCode, verifyTotp } from "@/lib/auth/totp";
import { demoDestinations, demoPlans, demoRegions } from "@/data/demo-catalog";
import { makeTestDb } from "./helpers/db";

describe("demo seed and catalogue", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  afterAll(async () => {
    await handle.close();
  });

  it("seeds the expected demo catalogue idempotently", async () => {
    const db = handle.db;
    const regionRows = await db.select().from(regions);
    const destinationRows = await db.select().from(destinations);
    const planRows = await db.select().from(plans);
    expect(regionRows.length).toBe(demoRegions.length);
    expect(destinationRows.length).toBe(demoDestinations.length);
    expect(planRows.length).toBe(demoPlans.length);
    expect(regionRows.length).toBe(8);
    expect(destinationRows.length).toBe(33);
    expect(planRows.length).toBe(99);
    expect(planRows.every((plan) => plan.isDemo)).toBe(true);
    expect(planRows.every((plan) => plan.supplierKey === "mock")).toBe(true);
    expect(planRows.every((plan) => plan.priceMinor > 0)).toBe(true);
    expect(planRows.every((plan) => plan.priceMinor >= plan.costMinor)).toBe(true);

    const { seedDemoData } = await import("@/lib/db/seed");
    const again = await seedDemoData(db, {
      adminEmail: "admin@demo.local",
      adminPassword: "DemoAdmin!2345",
      adminTotpSecret: "JBSWY3DPEHPK3PXP",
    });
    expect(again.regions).toBe(8);
    expect(again.destinations).toBe(33);
    expect(again.plans).toBe(99);
    expect(again.adminCreated).toBe(false);
    expect((await db.select().from(regions)).length).toBe(8);
    expect((await db.select().from(destinations)).length).toBe(33);
    expect((await db.select().from(plans)).length).toBe(99);
  });

  it("creates a demo admin with a verifiable password and TOTP secret", async () => {
    const db = handle.db;
    const rows = await db.select().from(users).where(eq(users.email, "admin@demo.local")).limit(1);
    const admin = rows[0];
    expect(admin).toBeTruthy();
    expect(admin!.role).toBe("admin");
    expect(admin!.totpEnabled).toBe(true);
    expect(await verifyPassword("DemoAdmin!2345", admin!.passwordHash)).toBe(true);
    expect(await verifyPassword("wrong-password", admin!.passwordHash)).toBe(false);
    const secret = decryptSecret(admin!.totpSecretEncrypted!);
    expect(secret).toBe("JBSWY3DPEHPK3PXP");
    expect(verifyTotp(secret, totpCode(secret))).toBe(true);
    const audits = await db.select().from(auditLogs);
    expect(audits.some((audit) => audit.action === "demo.seed")).toBe(true);
  });

  it("queries regions, destinations, plans, and search filters", async () => {
    const db = handle.db;
    const regionRows = await getRegions(db);
    expect(regionRows.length).toBe(8);
    expect(regionRows.every((region) => region.destinationCount > 0)).toBe(true);
    expect(regionRows.every((region) => region.planCount > 0)).toBe(true);
    expect(regionRows.every((region) => region.fromPriceMinor !== null)).toBe(true);

    const destinationRows = await getDestinations(db);
    expect(destinationRows.length).toBe(33);
    const japan = destinationRows.find((destination) => destination.slug === "japan");
    expect(japan).toBeTruthy();
    expect(japan!.planCount).toBeGreaterThan(0);

    const popular = await getDestinations(db, { popular: true });
    expect(popular.length).toBeGreaterThan(0);
    expect(popular.every((destination) => destination.popular)).toBe(true);
    const asia = await getDestinations(db, { regionSlug: "asia" });
    expect(asia.length).toBeGreaterThan(0);
    expect(asia.every((destination) => destination.regionSlug === "asia")).toBe(true);

    const allPlans = await getPlans(db, { limit: 500 });
    expect(allPlans.length).toBe(99);
    expect(allPlans.every((plan) => plan.status === "published")).toBe(true);
    expect(allPlans.every((plan) => plan.isDemo)).toBe(true);

    const japanSearch = await getPlans(db, { q: "Japan", limit: 100 });
    expect(japanSearch.some((plan) => plan.destinationSlug === "japan")).toBe(true);

    const asiaPlans = await getPlans(db, { region: "asia", limit: 100 });
    expect(asiaPlans.length).toBeGreaterThan(0);
    expect(asiaPlans.every((plan) => plan.regionSlug === "asia")).toBe(true);

    const cheap = await getPlans(db, { maxPrice: 10, limit: 100 });
    expect(cheap.every((plan) => plan.priceMinor <= 1000)).toBe(true);

    const featured = await getFeaturedPlans(db, 6);
    expect(featured.length).toBeGreaterThan(0);
    expect(featured.length).toBeLessThanOrEqual(6);

    const range = await getPlanPriceRange(db);
    expect(range.min).toBeGreaterThan(0);
    expect(range.max).toBeGreaterThanOrEqual(range.min);

    const destination = await getDestinationBySlug(db, "japan");
    expect(destination?.destination.name).toBe("Japan");
    expect(await getDestinationBySlug(db, "missing-destination")).toBeNull();

    const destinationPlans = await getPlansForDestination(db, destination!.destination.id);
    expect(destinationPlans.length).toBeGreaterThan(0);
    expect(destinationPlans.every((plan) => plan.destinationSlug === "japan")).toBe(true);

    const plan = allPlans[0]!;
    expect((await getPlanBySlug(db, plan.slug))?.id).toBe(plan.id);
    expect(await getPlanBySlug(db, "missing-plan")).toBeNull();
  });
});

describe("catalogue administration guards", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  afterAll(async () => {
    await handle.close();
  });

  it("blocks deleting regions with destinations, destinations with plans, and sold plans", async () => {
    const db = handle.db;
    const {
      createPlan,
      createRegion,
      deleteDestination,
      deletePlan,
      deleteRegion,
    } = await import("@/lib/catalogue");

    // Seeded catalogue: regions contain destinations, destinations contain plans.
    const seededRegions = await db.select().from(regions).limit(1);
    await expect(deleteRegion(db, seededRegions[0]!.id, "admin_guard_test")).rejects.toThrow(
      /still contains/,
    );
    const seededDestinations = await db.select().from(destinations).limit(1);
    await expect(
      deleteDestination(db, seededDestinations[0]!.id, "admin_guard_test"),
    ).rejects.toThrow(/still contains/);

    // Create a fresh region/destination/plan chain and sell the plan.
    const createdRegion = await createRegion(db, {
      name: "Guard Test Region",
      slug: "guard-test-region",
      description: "Region reserved for catalogue guard tests.",
      accent: "teal",
      sortOrder: 999,
      actorId: "admin_guard_test",
    });
    const { createDestination } = await import("@/lib/catalogue");
    const createdDestination = await createDestination(db, {
      regionId: createdRegion.id,
      name: "Guard Test Destination",
      slug: "guard-test-destination",
      countryCode: "GT",
      summary: "Destination reserved for catalogue guard tests.",
      description: "Destination reserved for catalogue guard tests.",
      popular: false,
      actorId: "admin_guard_test",
    });
    const createdPlan = await createPlan(db, {
      destinationId: createdDestination.id,
      name: "Guard Test Plan",
      slug: "guard-test-plan",
      supplierKey: "mock",
      supplierProductId: "guard-test-product",
      dataMb: 500,
      validityDays: 7,
      cost: "1.00",
      markupBps: 2000,
      currency: "USD",
      taxBps: 0,
      coverageSummary: "Guard coverage summary.",
      networkSummary: "Guard network summary.",
      description: "Guard test plan description for the audit trail.",
      status: "draft",
      isDemo: true,
      actorId: "admin_guard_test",
    });

    // The unsold plan deletes cleanly, then its destination and region do too.
    await deletePlan(db, createdPlan.id, "admin_guard_test");
    await deleteDestination(db, createdDestination.id, "admin_guard_test");
    await deleteRegion(db, createdRegion.id, "admin_guard_test");

    const auditRows = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.actorId, "admin_guard_test"));
    const actions = auditRows.map((row) => row.action);
    expect(actions).toContain("admin.region.create");
    expect(actions).toContain("admin.destination.create");
    expect(actions).toContain("admin.plan.create");
    expect(actions).toContain("admin.plan.delete");
    expect(actions).toContain("admin.destination.delete");
    expect(actions).toContain("admin.region.delete");

    // Selling a plan locks it against deletion.
    const soldRegion = await createRegion(db, {
      name: "Guard Sold Region",
      slug: "guard-sold-region",
      description: "Region reserved for the sold-plan guard test.",
      accent: "teal",
      sortOrder: 998,
      actorId: "admin_guard_test",
    });
    const soldDestination = await createDestination(db, {
      regionId: soldRegion.id,
      name: "Guard Sold Destination",
      slug: "guard-sold-destination",
      countryCode: "GS",
      summary: "Destination reserved for the sold-plan guard test.",
      description: "Destination reserved for the sold-plan guard test.",
      popular: false,
      actorId: "admin_guard_test",
    });
    const soldPlan = await createPlan(db, {
      destinationId: soldDestination.id,
      name: "Guard Sold Plan",
      slug: "guard-sold-plan",
      supplierKey: "mock",
      supplierProductId: "guard-sold-product",
      dataMb: 1000,
      validityDays: 14,
      cost: "2.00",
      markupBps: 2000,
      currency: "USD",
      taxBps: 0,
      coverageSummary: "Guard sold coverage summary.",
      networkSummary: "Guard sold network summary.",
      description: "Guard sold plan description for the audit trail.",
      status: "published",
      isDemo: true,
      actorId: "admin_guard_test",
    });
    const cart = await getOrCreateCart(db);
    await addCartItem(db, cart.cartId, soldPlan.id, 1);
    await createCheckout(db, {
      cartToken: cart.token,
      email: "guard@example.com",
      name: "Guard Buyer",
      country: "US",
      idempotencyKey: "guard-sold-checkout",
    });
    await expect(deletePlan(db, soldPlan.id, "admin_guard_test")).rejects.toThrow(/sold in/i);
    // The destination/region are also locked while the sold plan exists.
    await expect(
      deleteDestination(db, soldDestination.id, "admin_guard_test"),
    ).rejects.toThrow(/still contains/);
    await expect(deleteRegion(db, soldRegion.id, "admin_guard_test")).rejects.toThrow(
      /still contains/,
    );
  }, 60_000);
});

describe("order access control", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  afterAll(async () => {
    await handle.close();
  });

  it("allows access with a valid token or admin role and denies others", async () => {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst();
    await addCartItem(db, cart.cartId, plan!.id, 1);
    const result = await createCheckout(db, {
      cartToken: cart.token,
      email: "access@example.com",
      name: "Access Traveler",
      country: "US",
      idempotencyKey: "access-checkout",
    });
    const order = await getOrderByNumber(db, result.orderNumber);
    expect(order).toBeTruthy();
    expect(await canViewOrder(db, order!, { token: result.accessToken })).toBe(true);
    expect(await canViewOrder(db, order!, { token: "wrong-token" })).toBe(false);
    expect(await canViewOrder(db, order!, {})).toBe(false);
    expect(await canViewOrder(db, order!, { role: "admin" })).toBe(true);
    expect(await canViewOrder(db, order!, { userId: "not-the-owner" })).toBe(false);

    const view = await getOrderViewByNumber(db, result.orderNumber);
    expect(view?.items.length).toBe(1);
    expect(view?.events.some((event) => event.type === "order.created")).toBe(true);

    await db
      .update(orderAccessTokens)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(orderAccessTokens.tokenHash, hashToken(result.accessToken)));
    expect(await canViewOrder(db, order!, { token: result.accessToken })).toBe(false);
  });

  it("returns null for unknown orders", async () => {
    expect(await getOrderByNumber(handle.db, "ES-000000-000000")).toBeNull();
    expect(await getOrderViewByNumber(handle.db, "ES-000000-000000")).toBeNull();
  });
});
