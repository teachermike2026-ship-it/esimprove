import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import {
  auditLogs,
  coupons,
  orders,
  passwordResets,
  users,
} from "@/lib/db/schema";
import { addCartItem, getOrCreateCart } from "@/lib/cart";
import { createCheckout } from "@/lib/checkout";
import { applyRefund, listRefundsForOrder, requestRefund } from "@/lib/refunds";
import { createInvoiceForOrder, getInvoiceByOrderId } from "@/lib/invoices";
import {
  createNotification,
  listNotificationsForUser,
  markAllNotificationsRead,
} from "@/lib/notifications";
import { addSupportMessage, createSupportTicket, getSupportTicket } from "@/lib/support";
import { validateCoupon } from "@/lib/coupons";
import { hasConsent, recordConsent } from "@/lib/consents";
import { getOrCreateUserPreferences, updateUserPreferences } from "@/lib/user-preferences";
import {
  canTransitionFulfillment,
  canTransitionOrder,
  canTransitionPayment,
  deriveOrderStatus,
} from "@/lib/state";
import { hasPermission, isStaffRole } from "@/lib/auth/roles";
import { hashToken, randomToken } from "@/lib/crypto";
import { simulateMockPayment } from "@/lib/payments";
import {
  canViewOrder,
  createOrderAccessToken,
} from "@/lib/orders";
import { makeTestDb } from "./helpers/db";

describe("phase 2 backend foundations", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  afterAll(async () => {
    await handle.close();
  });

  describe("extended payment and fulfillment lifecycle", () => {
    it("allows refund, dispute, and cancellation payment transitions", () => {
      expect(canTransitionPayment("paid", "partially_refunded")).toBe(true);
      expect(canTransitionPayment("paid", "disputed")).toBe(true);
      expect(canTransitionPayment("pending", "cancelled")).toBe(true);
      expect(canTransitionPayment("authorized", "cancelled")).toBe(true);
      expect(canTransitionPayment("partially_refunded", "refunded")).toBe(true);
      expect(canTransitionPayment("disputed", "refunded")).toBe(true);
      expect(canTransitionPayment("refunded", "refunded")).toBe(false);
      expect(canTransitionPayment("cancelled", "paid")).toBe(false);
    });

    it("allows manual review fulfillment transitions and derives order status", () => {
      expect(canTransitionFulfillment("failed", "manual_review")).toBe(true);
      expect(canTransitionFulfillment("manual_review", "queued")).toBe(true);
      expect(canTransitionFulfillment("manual_review", "cancelled")).toBe(true);
      expect(canTransitionFulfillment("cancelled", "queued")).toBe(false);
      expect(canTransitionFulfillment("delivered", "queued")).toBe(false);
      expect(canTransitionOrder("delivered", "cancelled")).toBe(false);

      expect(deriveOrderStatus("partially_refunded", "delivered")).toBe("delivered");
      expect(deriveOrderStatus("disputed", "delivered")).toBe("delivered");
      expect(deriveOrderStatus("paid", "manual_review")).toBe("processing");
    });
  });

  describe("refund workflow", () => {
    it("requests, approves, and applies a full refund against a paid order", async () => {
      const db = handle.db;
      const cart = await getOrCreateCart(db);
      const plan = await db.query.plans.findFirst();
      expect(plan).toBeTruthy();
      await addCartItem(db, cart.cartId, plan!.id, 1);
      const checkout = await createCheckout(db, {
        cartToken: cart.token,
        email: "refund-phase2@example.com",
        name: "Phase Two Refund",
        country: "US",
        idempotencyKey: "phase2-refund-checkout",
      });
      await simulateMockPayment(db, checkout.paymentId, "success");

      const requested = await requestRefund(db, {
        orderId: checkout.orderId,
        amountMinor: checkout.totalMinor,
        reason: "Phase 2 automated refund check",
        actorType: "admin",
      });
      expect(requested.status).toBe("requested");

      const approved = await applyRefund(db, requested.id);
      expect(approved.status).toBe("approved");

      const refundsForOrder = await listRefundsForOrder(db, checkout.orderId);
      expect(refundsForOrder).toHaveLength(1);
      expect(refundsForOrder[0]?.status).toBe("approved");

      await expect(applyRefund(db, requested.id)).rejects.toThrow("twice");

      const approvalAudits = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, "refund"),
            eq(auditLogs.entityId, requested.id),
            eq(auditLogs.action, "admin.refund.approve"),
          ),
        );
      expect(approvalAudits).toHaveLength(1);
      expect(approvalAudits[0]?.actorType).toBe("admin");
    });

    it("prevents cumulative refunds from exceeding the captured total", async () => {
      const db = handle.db;
      const cart = await getOrCreateCart(db);
      const plan = await db.query.plans.findFirst();
      expect(plan).toBeTruthy();
      await addCartItem(db, cart.cartId, plan!.id, 1);
      const checkout = await createCheckout(db, {
        cartToken: cart.token,
        email: "refund-cumulative@example.com",
        name: "Cumulative Refund",
        country: "US",
        idempotencyKey: "phase2-refund-cumulative-checkout",
      });
      await simulateMockPayment(db, checkout.paymentId, "success");

      const half = Math.max(1, Math.floor(checkout.totalMinor / 2));
      const first = await requestRefund(db, {
        orderId: checkout.orderId,
        amountMinor: half,
        reason: "First partial refund",
        actorType: "admin",
      });
      await applyRefund(db, first.id, { actorType: "admin", actorId: "admin-test" });

      await expect(
        requestRefund(db, {
          orderId: checkout.orderId,
          amountMinor: checkout.totalMinor,
          reason: "Over-refund attempt",
          actorType: "admin",
        }),
      ).rejects.toThrow(/remaining refundable/);

      if (checkout.totalMinor > half) {
        const remainder = checkout.totalMinor - half;
        const second = await requestRefund(db, {
          orderId: checkout.orderId,
          amountMinor: remainder,
          reason: "Remaining partial refund",
          actorType: "admin",
        });
        const applied = await applyRefund(db, second.id, {
          actorType: "admin",
          actorId: "admin-test",
        });
        expect(applied.status).toBe("approved");
        const orderRows = await db
          .select()
          .from(orders)
          .where(eq(orders.id, checkout.orderId))
          .limit(1);
        expect(orderRows[0]?.paymentStatus).toBe("refunded");
      }
    });
  });

  describe("coupons", () => {
    it("validates demo coupons and rejects disabled or unknown codes", async () => {
      const db = handle.db;
      await db.insert(coupons).values({
        id: "coupon_phase2_enabled",
        code: "PHASE2TEST",
        kind: "percent",
        value: 1000,
        status: "enabled",
        isDemo: true,
      });
      const enabled = await validateCoupon(db, { code: "phase2test", subtotalMinor: 2000 });
      expect(enabled.ok).toBe(true);
      expect(enabled.discountMinor).toBe(200);

      const disabled = await validateCoupon(db, { code: "PHASE2DISABLED", subtotalMinor: 2000 });
      expect(disabled.ok).toBe(false);

      const unknown = await validateCoupon(db, { code: "NOPE", subtotalMinor: 2000 });
      expect(unknown.ok).toBe(false);
    });
  });

  describe("customer-facing backend records", () => {
    it("stores notifications, consents, preferences, support tickets, and invoices", async () => {
      const db = handle.db;
      const userRows = await db.select().from(users);
      const userId = userRows[0]!.id;

      const notification = await createNotification(db, {
        userId,
        type: "order.delivered",
        title: "Demo notification",
        body: "Phase 2 notification record",
      });
      expect(notification.type).toBe("order.delivered");
      await markAllNotificationsRead(db, userId);
      const unread = await listNotificationsForUser(db, userId);
      expect(unread[0]?.read).toBe(true);

      const consentVersion = "v1-phase2";
      await recordConsent(db, {
        userId,
        purpose: "marketing",
        version: consentVersion,
        accepted: true,
        ipHash: "hash",
        userAgent: "agent",
      });
      expect(await hasConsent(db, userId, "marketing", consentVersion)).toBe(true);

      const preferences = await getOrCreateUserPreferences(db, userId);
      expect(preferences.marketingOptIn).toBe(false);
      const updated = await updateUserPreferences(db, userId, { marketingOptIn: true });
      expect(updated.marketingOptIn).toBe(true);

      const ticket = await createSupportTicket(db, {
        userId,
        orderId: null,
        subject: "Phase 2 support check",
        priority: "normal",
        message: "Phase 2 support message",
      });
      await addSupportMessage(db, {
        ticketId: ticket.id,
        authorType: "customer",
        authorId: userId,
        body: "Phase 2 support follow-up",
      });
      const loaded = await getSupportTicket(db, ticket.id);
      // createSupportTicket seeds the opening customer message, addSupportMessage appends the reply.
      expect(loaded?.messages).toHaveLength(2);

      const order = await db.select().from(orders).limit(1);
      const created = await createInvoiceForOrder(db, order[0]!.id);
      expect(created.status).toBe("issued");
      const fetched = await getInvoiceByOrderId(db, order[0]!.id);
      expect(fetched?.id).toBe(created.id);
    });

    it("stores password reset tokens hashed and expiring", async () => {
      const db = handle.db;
      const user = await db.select().from(users).limit(1);
      const token = randomToken(32);
      const tokenHash = hashToken(token);
      expect(tokenHash).not.toBe(token);
      const reset = {
        id: "reset_phase2_test",
        userId: user[0]!.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        consumedAt: null,
        createdAt: new Date(),
      };
      await db.insert(passwordResets).values(reset);
      const found = await db
        .select()
        .from(passwordResets)
        .where(eq(passwordResets.tokenHash, tokenHash))
        .limit(1);
      expect(found[0]?.id).toBe("reset_phase2_test");
      expect(found[0]?.consumedAt).toBeNull();
    });
  });

  describe("order access authorization", () => {
    it("allows owners, administrators, and valid access tokens only", async () => {
      const db = handle.db;
      const order = (await db.select().from(orders).limit(1))[0]!;
      const token = await createOrderAccessToken(db, order.id);

      expect(await canViewOrder(db, order, { role: "admin" })).toBe(true);
      expect(await canViewOrder(db, order, { role: "super_admin" })).toBe(true);
      expect(await canViewOrder(db, order, { role: "finance" })).toBe(false);
      expect(await canViewOrder(db, order, { role: "customer" })).toBe(false);
      expect(await canViewOrder(db, order, { token })).toBe(true);
      expect(await canViewOrder(db, order, { token: "not-a-valid-token" })).toBe(false);
      if (order.userId) {
        expect(await canViewOrder(db, order, { userId: order.userId })).toBe(true);
      }
      expect(await canViewOrder(db, order, { userId: "someone-else" })).toBe(false);
    });
  });

  describe("authorization helpers", () => {
    it("grants staff permissions only to the matching roles", () => {
      expect(isStaffRole("admin")).toBe(true);
      expect(isStaffRole("super_admin")).toBe(true);
      expect(isStaffRole("support")).toBe(true);
      expect(isStaffRole("finance")).toBe(true);
      expect(isStaffRole("customer")).toBe(false);
      expect(hasPermission("admin", "refunds.write")).toBe(true);
      expect(hasPermission("super_admin", "refunds.write")).toBe(true);
      expect(hasPermission("support", "refunds.write")).toBe(false);
      // Refund execution is administrator-only in this build; finance remains
      // read-only until a four-eyes approval workflow exists.
      expect(hasPermission("finance", "refunds.write")).toBe(false);
      expect(hasPermission("finance", "orders.read")).toBe(true);
      expect(hasPermission("finance", "orders.write")).toBe(false);
      expect(hasPermission("customer", "refunds.write")).toBe(false);
    });
  });
});
