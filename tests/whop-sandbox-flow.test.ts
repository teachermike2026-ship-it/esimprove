/**
 * Card checkout flow rules with SYNTHETIC, locally signed Whop webhooks and
 * the mock supplier. Nothing here contacts Whop or uses a real credential.
 */
import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import { cartItems, esims, orderEvents, orderItems, orders, outboxEvents, payments, plans } from "@/lib/db/schema";
import { addCartItem, getOrCreateCart } from "@/lib/cart";
import { CheckoutError, createCheckout } from "@/lib/checkout";
import { newId } from "@/lib/ids";
import { handleWhopWebhook } from "@/lib/payments/whop-webhooks";
import { runOutboxAndJobs } from "@/lib/fulfillment";
import { setSupplierAdapterOverride } from "@/lib/integrations/supplier";
import { MockSupplierAdapter } from "@/lib/integrations/supplier/mock";
import { ProviderError, type CreateSupplierOrderInput } from "@/lib/integrations/supplier/types";
import { makeTestDb } from "./helpers/db";

const SECRET = "ws_synthetic_flow_secret_not_real";

function sign(body: string, webhookId: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", Buffer.from(SECRET, "utf8")).update(`${webhookId}.${timestamp}.${body}`).digest("base64");
  return { "webhook-id": webhookId, "webhook-timestamp": timestamp, "webhook-signature": `v1,${signature}` };
}

let counter = 0;
const nextId = () => `msg_flow${String(++counter).padStart(6, "0")}`;

function envelope(type: string, data: unknown, id: string) {
  return JSON.stringify({ id, api_version: "v1", api_version_date: "2026-11-23-3", account_id: "biz_synthetic", timestamp: new Date().toISOString(), type, data });
}

const money = (minor: number) => ({ amount: (minor / 100).toFixed(2), currency: "usd", decimals: 2, display_decimals: 2 });

interface Order {
  orderId: string;
  localPaymentId: string;
  checkoutId: string;
  providerPaymentId: string;
  amountMinor: number;
}

describe("card checkout flow (synthetic Whop sandbox events)", () => {
  let handle: DatabaseHandle;
  // Creating the in-memory database is slow on a loaded machine; allow 3 minutes.
  beforeAll(async () => {
    handle = await makeTestDb();
  }, 180_000);
  afterAll(async () => handle.close());
  afterEach(() => setSupplierAdapterOverride(null));

  async function makeOrder(key: string): Promise<Order> {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst({ where: eq(plans.status, "published") });
    await addCartItem(db, cart.cartId, plan!.id, 1);
    const result = await createCheckout(db, { cartToken: cart.token, email: `${key}@example.com`, name: "Flow Test", country: "US", idempotencyKey: key });
    const localPaymentId = newId("pay");
    const checkoutId = `ch_${key.replace(/[^a-z0-9]/gi, "")}`;
    await db.insert(payments).values({
      id: localPaymentId,
      orderId: result.orderId,
      provider: "whop",
      providerPaymentId: checkoutId,
      status: "pending",
      amountMinor: result.totalMinor,
      currency: result.currency,
      checkoutUrl: "https://sandbox.whop.com/checkout/synthetic",
    });
    return { orderId: result.orderId, localPaymentId, checkoutId, providerPaymentId: `pay_${key.replace(/[^a-z0-9]/gi, "")}`, amountMinor: result.totalMinor };
  }

  function paymentData(order: Order, overrides: Record<string, unknown> = {}) {
    return {
      id: order.providerPaymentId,
      status: "paid",
      currency: "usd",
      total: money(order.amountMinor),
      subtotal: money(order.amountMinor),
      tax_amount: null,
      tax_behavior: null,
      checkout_configuration_id: order.checkoutId,
      product_id: null,
      variant_id: "plan_synthetic",
      // Only the documented keys, as new checkouts send them.
      metadata: { orderId: order.orderId, planId: "plan_x", esimprove_payment_id: order.localPaymentId },
      ...overrides,
    };
  }

  const deliver = (type: string, data: unknown, id = nextId()) => {
    const body = envelope(type, data, id);
    return handleWhopWebhook(handle.db, body, sign(body, id), SECRET, { runFulfillment: false });
  };
  const orderRow = async (id: string) => (await handle.db.select().from(orders).where(eq(orders.id, id)).limit(1))[0]!;
  const events = async (id: string, type: string) =>
    handle.db.select().from(orderEvents).where(and(eq(orderEvents.orderId, id), eq(orderEvents.type, type)));

  it("rejects a tampered cart price and never creates the order", async () => {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst({ where: eq(plans.status, "published") });
    await addCartItem(db, cart.cartId, plan!.id, 1);
    await db.update(cartItems).set({ unitPriceMinor: 1 }).where(eq(cartItems.cartId, cart.cartId));
    const attempt = createCheckout(db, { cartToken: cart.token, email: "tamper@example.com", name: "T", country: "US", idempotencyKey: "tamper-1" });
    await expect(attempt).rejects.toMatchObject({ code: "price_changed" });
    expect(await db.select().from(orders).where(eq(orders.idempotencyKey, "tamper-1"))).toHaveLength(0);
  });

  it("refuses a plan that is not orderable", async () => {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst({ where: eq(plans.status, "published") });
    await addCartItem(db, cart.cartId, plan!.id, 1);
    await db.update(plans).set({ status: "draft" }).where(eq(plans.id, plan!.id));
    try {
      await expect(
        createCheckout(db, { cartToken: cart.token, email: "draft@example.com", name: "D", country: "US", idempotencyKey: "draft-1" }),
      ).rejects.toBeInstanceOf(CheckoutError);
    } finally {
      await db.update(plans).set({ status: "published" }).where(eq(plans.id, plan!.id));
    }
  });

  it("logs pending and 3-D Secure events without changing status, once", async () => {
    const order = await makeOrder("flow-pending");
    const id = nextId();
    const first = await deliver("payment.pending", paymentData(order, { status: "pending" }), id);
    const again = await deliver("payment.pending", paymentData(order, { status: "pending" }), id);
    await deliver("payment.requires_action", paymentData(order, { status: "open" }));
    expect(first.duplicate).toBe(false);
    expect(again.duplicate).toBe(true);
    expect((await orderRow(order.orderId)).paymentStatus).toBe("pending");
    expect(await events(order.orderId, "payment.pending")).toHaveLength(2);
  });

  it("treats a canceled payment as failed and never fulfils it", async () => {
    const order = await makeOrder("flow-canceled");
    await deliver("payment.canceled", paymentData(order, { status: "void" }));
    expect((await orderRow(order.orderId)).paymentStatus).toBe("failed");
    const queued = await handle.db.select().from(outboxEvents).where(eq(outboxEvents.aggregateId, order.orderId));
    expect(queued).toHaveLength(0);
  });

  it("pays with the documented orderId metadata, issues the eSIM once, then flags it on refund", async () => {
    const order = await makeOrder("flow-refund");
    const paid = await deliver("payment.succeeded", paymentData(order));
    expect(paid.reviewRequired).toBeUndefined();
    await runOutboxAndJobs(handle.db);
    await runOutboxAndJobs(handle.db);
    const items = await handle.db.select().from(orderItems).where(eq(orderItems.orderId, order.orderId));
    const issued = await handle.db.select().from(esims).where(eq(esims.orderItemId, items[0]!.id));
    expect(issued).toHaveLength(1);

    const refund = {
      id: "rfnd_flow01",
      amount: order.amountMinor / 100,
      currency: "usd",
      status: "succeeded",
      payment: { id: order.providerPaymentId, metadata: { orderId: order.orderId, esimprove_payment_id: order.localPaymentId } },
    };
    await deliver("refund.created", refund);
    expect((await orderRow(order.orderId)).paymentStatus).toBe("refunded");
    const flagged = await handle.db.select().from(esims).where(eq(esims.orderItemId, items[0]!.id));
    expect(flagged[0]!.status).toBe("refund_flagged");
    expect((await events(order.orderId, "admin.alert")).length).toBeGreaterThan(0);
  });

  it("flags a disputed payment for an admin", async () => {
    const order = await makeOrder("flow-dispute");
    await deliver("payment.succeeded", paymentData(order));
    await deliver("dispute.created", {
      id: "dspt_flow01",
      amount: order.amountMinor / 100,
      currency: "USD",
      status: "needs_response",
      reason: "fraudulent",
      payment: { id: order.providerPaymentId },
    });
    expect((await orderRow(order.orderId)).paymentStatus).toBe("disputed");
    const alerts = await events(order.orderId, "admin.alert");
    expect(alerts.some((event) => (event.metadata as { kind?: string }).kind === "payment.disputed")).toBe(true);
  });

  it("holds an amount mismatch for review, alerts an admin and does not fulfil", async () => {
    const order = await makeOrder("flow-mismatch");
    const result = await deliver("payment.succeeded", paymentData(order, { total: money(order.amountMinor - 100), subtotal: money(order.amountMinor - 100) }));
    expect(result.reviewRequired).toBeTruthy();
    expect((await orderRow(order.orderId)).paymentStatus).toBe("pending");
    const alerts = await events(order.orderId, "admin.alert");
    expect(alerts.some((event) => (event.metadata as { kind?: string }).kind === "payment.review_required")).toBe(true);
  });

  it("marks a paid order whose supplier fails as needing attention and alerts an admin", async () => {
    class FailingSupplier extends MockSupplierAdapter {
      override async createOrder(_input: CreateSupplierOrderInput): Promise<never> {
        void _input;
        throw new ProviderError("insufficient_balance", "Simulated supplier rejection", false);
      }
    }
    setSupplierAdapterOverride(() => new FailingSupplier());
    const order = await makeOrder("flow-supplier");
    await deliver("payment.succeeded", paymentData(order));
    await runOutboxAndJobs(handle.db);
    await runOutboxAndJobs(handle.db);
    const row = await orderRow(order.orderId);
    expect(row.paymentStatus).toBe("paid");
    expect(row.fulfillmentStatus).toBe("manual_review");
    const alerts = await events(order.orderId, "admin.alert");
    expect(alerts.some((event) => (event.metadata as { kind?: string }).kind === "fulfillment.needs_attention")).toBe(true);
  });
});
