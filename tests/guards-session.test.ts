import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DatabaseHandle } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { seedDemoData } from "@/lib/db/seed";
import { eq } from "drizzle-orm";
import { auditLogs, supplierConnections, users } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { createSession } from "@/lib/auth/session";
import { decryptSupplierCredential } from "@/lib/adapters/encryption";
import { addCartItem, getOrCreateCart } from "@/lib/cart";
import { createCheckout } from "@/lib/checkout";
import { loadAuthorizedMockPayment } from "@/lib/payment-access";
import { getAdminOrderDetail } from "@/lib/admin";

const mockState = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name.endsWith("_session") && mockState.token
        ? { name, value: mockState.token }
        : undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
  headers: async () => new Headers({ "user-agent": "vitest" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

type RedirectError = { digest?: string; message?: string };

async function expectRedirect(action: () => Promise<unknown>, fragment: string) {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeTruthy();
  const value = caught as RedirectError;
  const text = `${value.digest ?? ""} ${value.message ?? ""} ${String(caught)}`;
  expect(text.toLowerCase()).toContain(fragment.toLowerCase());
}

async function adminUser(handle: DatabaseHandle) {
  const rows = await handle.db
    .select()
    .from(users)
    .where(eq(users.email, "admin@demo.local"))
    .limit(1);
  return rows[0]!;
}

describe("session-backed admin guards", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await createDatabase({ dataDir: "memory://", connectionString: "" });
    await runMigrations(handle.client, handle.dialect);
    await seedDemoData(handle.db, {
      adminEmail: "admin@demo.local",
      adminPassword: "DemoAdmin!2345",
      adminTotpSecret: "JBSWY3DPEHPK3PXP",
    });
    (globalThis as typeof globalThis & { __esimproveDbPromise?: Promise<DatabaseHandle> })
      .__esimproveDbPromise = Promise.resolve(handle);
  });

  afterAll(async () => {
    const globalWithDb = globalThis as typeof globalThis & {
      __esimproveDbPromise?: Promise<DatabaseHandle>;
    };
    globalWithDb.__esimproveDbPromise = undefined;
    await handle.close();
  });

  it("accepts a real administrator session", async () => {
    const admin = await adminUser(handle);
    mockState.token = (
      await createSession(handle.db, admin.id, { ttlMinutes: 60 })
    ).token;
    const { requireAdmin } = await import("@/lib/auth/guards");
    const user = await requireAdmin();
    expect(user.id).toBe(admin.id);
    expect(user.role).toBe("admin");
  });

  it("stores a supplier credential encrypted and bound to its connection", async () => {
    const admin = await adminUser(handle);
    mockState.token = (
      await createSession(handle.db, admin.id, { ttlMinutes: 60 })
    ).token;
    const { createSupplierConnectionAction } = await import(
      "@/app/admin/integrations/actions"
    );
    const secret = "integration-test-secret-value";
    const form = new FormData();
    form.set("displayName", "Integration Test Supplier");
    form.set("adapterType", "generic-api");
    form.set("environment", "sandbox");
    form.set("baseUrl", "https://api.supplier.example.com/v1");
    form.set("authMethod", "api_key");
    form.set("credentialSecret", secret);

    await expectRedirect(
      () => createSupplierConnectionAction(form),
      "/admin/integrations?created=1",
    );

    const connectionRows = await handle.db
      .select()
      .from(supplierConnections)
      .where(eq(supplierConnections.displayName, "Integration Test Supplier"))
      .limit(1);
    const connection = connectionRows[0];
    expect(connection).toBeTruthy();
    expect(connection!.enabled).toBe(false);
    expect(connection!.status).toBe("disconnected");
    expect(connection!.credentialEncrypted).toBeTruthy();
    expect(connection!.credentialEncrypted!.aadVersion).toBe(1);
    expect(JSON.stringify(connection!.credentialEncrypted)).not.toContain(secret);
    expect(
      decryptSupplierCredential(connection!.id, connection!.credentialEncrypted!),
    ).toBe(secret);

    const auditRows = await handle.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "admin.integration.create"));
    const entry = auditRows.find((row) => row.entityId === connection!.id);
    expect(entry).toBeTruthy();
    expect(entry!.actorId).toBe(admin.id);
    expect(JSON.stringify(entry!.metadata)).not.toContain(secret);
  });

  it("authorizes mock payment access by owner, admin, or order token only", async () => {
    const db = handle.db;
    const ownerId = newId("user");
    const otherId = newId("user");
    const financeId = newId("user");
    await db.insert(users).values([
      {
        id: ownerId,
        email: "payment-owner@example.test",
        name: "Payment Owner",
        passwordHash: "unused",
        role: "customer",
      },
      {
        id: otherId,
        email: "payment-other@example.test",
        name: "Other Customer",
        passwordHash: "unused",
        role: "customer",
      },
      {
        id: financeId,
        email: "payment-finance@example.test",
        name: "Finance User",
        passwordHash: "unused",
        role: "finance",
      },
    ]);

    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst();
    expect(plan).toBeTruthy();
    await addCartItem(db, cart.cartId, plan!.id, 1);
    const checkout = await createCheckout(db, {
      cartToken: cart.token,
      email: "payment-owner@example.test",
      name: "Payment Owner",
      country: "US",
      idempotencyKey: "payment-access-checkout",
      userId: ownerId,
    });

    mockState.token = null;
    expect(await loadAuthorizedMockPayment(db, checkout.paymentId, null)).toBeNull();
    expect(
      await loadAuthorizedMockPayment(db, checkout.paymentId, "not-a-valid-order-token"),
    ).toBeNull();

    mockState.token = (
      await createSession(db, ownerId, { ttlMinutes: 60 })
    ).token;
    const ownerAccess = await loadAuthorizedMockPayment(db, checkout.paymentId, null);
    expect(ownerAccess?.order.id).toBe(checkout.orderId);

    mockState.token = (
      await createSession(db, otherId, { ttlMinutes: 60 })
    ).token;
    expect(await loadAuthorizedMockPayment(db, checkout.paymentId, null)).toBeNull();

    mockState.token = (
      await createSession(db, financeId, { ttlMinutes: 60 })
    ).token;
    expect(await loadAuthorizedMockPayment(db, checkout.paymentId, null)).toBeNull();

    const admin = await adminUser(handle);
    mockState.token = (
      await createSession(db, admin.id, { ttlMinutes: 60 })
    ).token;
    expect(await loadAuthorizedMockPayment(db, checkout.paymentId, null)).not.toBeNull();

    mockState.token = null;
    expect(
      await loadAuthorizedMockPayment(db, checkout.paymentId, checkout.accessToken),
    ).not.toBeNull();

    mockState.token = (
      await createSession(db, otherId, { ttlMinutes: 60 })
    ).token;
    expect(await loadAuthorizedMockPayment(db, checkout.paymentId, null)).toBeNull();
  });

  it("rejects an anonymous request with a login redirect", async () => {
    mockState.token = null;
    const { requireAdmin } = await import("@/lib/auth/guards");
    await expectRedirect(() => requireAdmin("/admin/audit"), "/login");
  });

  it("rejects an invalid session with a login redirect", async () => {
    mockState.token = "not-a-real-session-token";
    const { requireAdmin } = await import("@/lib/auth/guards");
    await expectRedirect(() => requireAdmin("/admin/audit"), "/login");
  });

  it("rejects an expired session with a login redirect", async () => {
    const admin = await adminUser(handle);
    mockState.token = (
      await createSession(handle.db, admin.id, { ttlMinutes: -1 })
    ).token;
    const { requireAdmin } = await import("@/lib/auth/guards");
    await expectRedirect(() => requireAdmin("/admin/audit"), "/login");
  });

  it("rejects a pending two-factor session until verification", async () => {
    const admin = await adminUser(handle);
    mockState.token = (
      await createSession(handle.db, admin.id, {
        ttlMinutes: 10,
        pendingTwoFactor: true,
      })
    ).token;
    const { requireAdmin } = await import("@/lib/auth/guards");
    await expectRedirect(() => requireAdmin("/admin/audit"), "/login/2fa");
  });

  it("blocks a regular user and a finance user from staff-only surfaces", async () => {
    const customerId = newId("user");
    const financeId = newId("user");
    await handle.db.insert(users).values([
      {
        id: customerId,
        email: "guard-customer@example.test",
        name: "Guard Customer",
        passwordHash: "unused",
        role: "customer",
      },
      {
        id: financeId,
        email: "guard-finance@example.test",
        name: "Guard Finance",
        passwordHash: "unused",
        role: "finance",
      },
    ]);

    const { requireAdmin, requirePermission } = await import("@/lib/auth/guards");

    mockState.token = (
      await createSession(handle.db, customerId, { ttlMinutes: 60 })
    ).token;
    await expectRedirect(() => requireAdmin("/admin"), "/portal");

    mockState.token = (
      await createSession(handle.db, financeId, { ttlMinutes: 60 })
    ).token;
    await expectRedirect(() => requireAdmin("/admin/refunds"), "/portal");
    await expectRedirect(
      () => requirePermission("/admin/refunds", "refunds.write"),
      "/portal",
    );

    mockState.token = (
      await createSession(handle.db, customerId, { ttlMinutes: 60 })
    ).token;
    const adminActions = await import("@/app/admin/actions");
    const catalogueActions = await import("@/app/admin/catalogue-actions");
    await expectRedirect(() => adminActions.approveRefundAction(new FormData()), "/portal");
    await expectRedirect(() => adminActions.runJobsAction(), "/portal");
    await expectRedirect(
      () => catalogueActions.upsertDestinationAction(new FormData()),
      "/portal",
    );
    await expectRedirect(
      () => catalogueActions.upsertPlanAction(new FormData()),
      "/portal",
    );
    await expectRedirect(
      () => catalogueActions.deleteRegionAction(new FormData()),
      "/portal",
    );

    mockState.token = (
      await createSession(handle.db, financeId, { ttlMinutes: 60 })
    ).token;
    // A finance user is authenticated staff but must not execute refunds or
    // mutate plans/jobs. These actions must enforce that on the server.
    await expectRedirect(() => adminActions.approveRefundAction(new FormData()), "/portal");
    await expectRedirect(() => adminActions.runJobsAction(), "/portal");
    await expectRedirect(
      () => catalogueActions.upsertRegionAction(new FormData()),
      "/portal",
    );
    await expectRedirect(
      () => catalogueActions.deletePlanAction(new FormData()),
      "/portal",
    );
    await expectRedirect(
      () => catalogueActions.deleteDestinationAction(new FormData()),
      "/portal",
    );

    const integrationActions = await import("@/app/admin/integrations/actions");
    const connectionForm = new FormData();
    connectionForm.set("displayName", "Forbidden supplier");
    connectionForm.set("adapterType", "generic-api");
    connectionForm.set("environment", "sandbox");
    connectionForm.set("baseUrl", "https://supplier.example.com");
    connectionForm.set("authMethod", "api_key");
    connectionForm.set("credentialSecret", "not-a-real-credential");
    await expectRedirect(
      () => integrationActions.createSupplierConnectionAction(connectionForm),
      "/portal",
    );
  });

  it("omits payment records from order detail when the viewer lacks invoices.read", async () => {
    const db = handle.db;
    const order = await db.query.orders.findFirst();
    expect(order).toBeTruthy();

    const withPayments = await getAdminOrderDetail(db, order!.orderNumber);
    expect(withPayments).not.toBeNull();
    expect(withPayments!.payments.length).toBeGreaterThan(0);

    const withoutPayments = await getAdminOrderDetail(db, order!.orderNumber, {
      includePayments: false,
    });
    expect(withoutPayments).not.toBeNull();
    expect(withoutPayments!.payments).toEqual([]);
    expect(withoutPayments!.view.order.id).toBe(withPayments!.view.order.id);
    expect(withoutPayments!.jobs.length).toBe(withPayments!.jobs.length);
    expect(withoutPayments!.emails.length).toBe(withPayments!.emails.length);
  });

  it("routes staff through permitted console sections and rejects admin-only ones", async () => {
    const financeId = newId("user");
    const supportId = newId("user");
    await handle.db.insert(users).values([
      {
        id: financeId,
        email: "staff-finance@example.test",
        name: "Staff Finance",
        passwordHash: "unused",
        role: "finance",
      },
      {
        id: supportId,
        email: "staff-support@example.test",
        name: "Staff Support",
        passwordHash: "unused",
        role: "support",
      },
    ]);
    const { requireStaff } = await import("@/lib/auth/guards");

    mockState.token = (
      await createSession(handle.db, financeId, { ttlMinutes: 60 })
    ).token;
    expect((await requireStaff("/admin", "overview")).role).toBe("finance");
    expect((await requireStaff("/admin/finance", "finance")).role).toBe("finance");
    expect((await requireStaff("/admin/payments", "payments")).role).toBe("finance");
    await expectRedirect(() => requireStaff("/admin/legal", "legal"), "/portal");
    await expectRedirect(() => requireStaff("/admin/plans", "plans"), "/portal");
    await expectRedirect(() => requireStaff("/admin/jobs", "jobs"), "/portal");
    await expectRedirect(() => requireStaff("/admin/audit", "audit"), "/portal");

    mockState.token = (
      await createSession(handle.db, supportId, { ttlMinutes: 60 })
    ).token;
    expect((await requireStaff("/admin", "overview")).role).toBe("support");
    expect((await requireStaff("/admin/orders", "orders")).role).toBe("support");
    expect((await requireStaff("/admin/support", "support")).role).toBe("support");
    await expectRedirect(() => requireStaff("/admin/payments", "payments"), "/portal");
    await expectRedirect(() => requireStaff("/admin/plans", "plans"), "/portal");
    await expectRedirect(() => requireStaff("/admin/audit", "audit"), "/portal");
  });
});
