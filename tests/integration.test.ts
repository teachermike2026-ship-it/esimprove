import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import { emailEvents, esims, orders } from "@/lib/db/schema";
import { addCartItem, getOrCreateCart, getCartView } from "@/lib/cart";
import { createCheckout } from "@/lib/checkout";
import { simulateMockPayment } from "@/lib/payments";
import { makeTestDb } from "./helpers/db";

describe("checkout and fulfillment integration", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  afterAll(async () => {
    await handle.close();
  });

  it("creates an order, records a signed mock payment, provisions a mock eSIM, and logs an email", async () => {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst();
    expect(plan).toBeTruthy();
    await addCartItem(db, cart.cartId, plan!.id, 1);

    const view = await getCartView(db, cart.token);
    expect(view?.lines.length).toBe(1);
    expect(view?.totalMinor).toBe(plan!.priceMinor);

    const result = await createCheckout(db, {
      cartToken: cart.token,
      email: "traveler@example.com",
      name: "Demo Traveler",
      country: "US",
      idempotencyKey: "integration-checkout-1",
    });
    expect(result.orderNumber).toMatch(/^ES-/);
    expect(result.totalMinor).toBe(plan!.priceMinor);

    const payment = await simulateMockPayment(db, result.paymentId, "success");
    expect(payment.ok).toBe(true);
    expect(payment.duplicate).toBe(false);
    expect(payment.fulfillment?.jobs.processed).toBe(1);

    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId))
      .limit(1);
    expect(orderRows[0]?.paymentStatus).toBe("paid");
    expect(orderRows[0]?.fulfillmentStatus).toBe("delivered");

    const esimRows = await db.select().from(esims);
    expect(esimRows.length).toBe(1);
    expect(esimRows[0]?.lpaCiphertext).not.toContain("LPA:");

    const emailRows = await db.select().from(emailEvents);
    expect(emailRows.length).toBe(1);
    expect(emailRows[0]?.status).toBe("logged");
    expect(emailRows[0]?.bodyText).toContain("token=[redacted]");
    expect(emailRows[0]?.bodyText).not.toMatch(/token=[A-Za-z0-9_-]{10,}/);
  });

  it("returns the same order for a repeated idempotency key", async () => {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst();
    await addCartItem(db, cart.cartId, plan!.id, 1);
    const first = await createCheckout(db, {
      cartToken: cart.token,
      email: "repeat@example.com",
      name: "Repeat Traveler",
      country: "GB",
      idempotencyKey: "integration-checkout-2",
    });
    const second = await createCheckout(db, {
      cartToken: cart.token,
      email: "repeat@example.com",
      name: "Repeat Traveler",
      country: "GB",
      idempotencyKey: "integration-checkout-2",
    });
    expect(second.orderId).toBe(first.orderId);
    expect(second.orderNumber).toBe(first.orderNumber);
  });
});
