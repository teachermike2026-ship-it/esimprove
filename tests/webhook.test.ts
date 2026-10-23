import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import {
  emailEvents,
  esims,
  fulfillmentJobs,
  orderItems,
  orders,
  payments,
  webhookEvents,
} from "@/lib/db/schema";
import { addCartItem, getOrCreateCart } from "@/lib/cart";
import { createCheckout } from "@/lib/checkout";
import {
  createMockPaymentEvent,
  signedMockWebhook,
} from "@/lib/integrations/payments/mock";
import { handlePaymentWebhook } from "@/lib/payments";
import { retryFulfillmentJob, runFulfillmentJobs } from "@/lib/fulfillment";
import { newId } from "@/lib/ids";
import { makeTestDb } from "./helpers/db";

describe("mock payment webhooks", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  afterAll(async () => {
    await handle.close();
  });

  async function makeCheckout(email: string, key: string) {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst();
    expect(plan).toBeTruthy();
    await addCartItem(db, cart.cartId, plan!.id, 1);
    const result = await createCheckout(db, {
      cartToken: cart.token,
      email,
      name: "Webhook Traveler",
      country: "US",
      idempotencyKey: key,
    });
    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.id, result.paymentId))
      .limit(1);
    expect(paymentRows[0]).toBeTruthy();
    return { result, payment: paymentRows[0]! };
  }

  it("rejects missing, invalid, and tampered signatures", async () => {
    const { payment, result } = await makeCheckout("signature@example.com", "webhook-signature");
    const event = createMockPaymentEvent({
      paymentId: payment.providerPaymentId,
      orderId: result.orderId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      type: "payment.succeeded",
    });
    const signed = signedMockWebhook(event);

    await expect(handlePaymentWebhook(handle.db, signed.rawBody, null)).rejects.toThrow(
      "Missing mock webhook signature",
    );
    await expect(handlePaymentWebhook(handle.db, signed.rawBody, "bad-signature")).rejects.toThrow(
      "Invalid mock webhook signature",
    );
    await expect(
      handlePaymentWebhook(handle.db, `${signed.rawBody} `, signed.signature),
    ).rejects.toThrow("Invalid mock webhook signature");
    await expect(
      handlePaymentWebhook(handle.db, "{not-json", signedMockWebhook({ ...event }).signature),
    ).rejects.toThrow();
  });

  it("processes a signed success event once and provisions a demo eSIM", async () => {
    const { payment, result } = await makeCheckout("success@example.com", "webhook-success");
    const event = createMockPaymentEvent({
      paymentId: payment.providerPaymentId,
      orderId: result.orderId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      type: "payment.succeeded",
    });
    const signed = signedMockWebhook(event);
    const first = await handlePaymentWebhook(handle.db, signed.rawBody, signed.signature);
    expect(first.ok).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(first.eventType).toBe("payment.succeeded");
    expect(first.fulfillment?.jobs.processed).toBe(1);

    const paid = await handle.db.select().from(payments).where(eq(payments.id, payment.id)).limit(1);
    expect(paid[0]?.status).toBe("paid");
    const order = await handle.db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId))
      .limit(1);
    expect(order[0]?.paymentStatus).toBe("paid");
    expect(order[0]?.fulfillmentStatus).toBe("delivered");
    expect((await handle.db.select().from(esims)).length).toBe(1);
    expect((await handle.db.select().from(emailEvents)).length).toBe(1);
    expect((await handle.db.select().from(webhookEvents)).length).toBe(1);

    const replay = await handlePaymentWebhook(handle.db, signed.rawBody, signed.signature);
    expect(replay.duplicate).toBe(true);
    expect((await handle.db.select().from(webhookEvents)).length).toBe(1);
    expect((await handle.db.select().from(esims)).length).toBe(1);
    expect((await handle.db.select().from(emailEvents)).length).toBe(1);

    const newEvent = createMockPaymentEvent({
      paymentId: payment.providerPaymentId,
      orderId: result.orderId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      type: "payment.succeeded",
    });
    const newSigned = signedMockWebhook(newEvent);
    const paidReplay = await handlePaymentWebhook(handle.db, newSigned.rawBody, newSigned.signature);
    expect(paidReplay.duplicate).toBe(true);
    expect((await handle.db.select().from(webhookEvents)).length).toBe(1);
  });

  it("records a failed payment without fulfillment and is idempotent", async () => {
    const { payment, result } = await makeCheckout("failure@example.com", "webhook-failure");
    const event = createMockPaymentEvent({
      paymentId: payment.providerPaymentId,
      orderId: result.orderId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      type: "payment.failed",
    });
    const signed = signedMockWebhook(event);
    const first = await handlePaymentWebhook(handle.db, signed.rawBody, signed.signature);
    expect(first.ok).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(first.fulfillment).toBeUndefined();

    const failed = await handle.db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);
    expect(failed[0]?.status).toBe("failed");
    const order = await handle.db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId))
      .limit(1);
    expect(order[0]?.paymentStatus).toBe("failed");
    expect(order[0]?.status).toBe("failed");
    const jobs = await handle.db
      .select()
      .from(fulfillmentJobs)
      .where(eq(fulfillmentJobs.orderId, result.orderId));
    expect(jobs.length).toBe(0);

    const replay = await handlePaymentWebhook(handle.db, signed.rawBody, signed.signature);
    expect(replay.duplicate).toBe(true);
    const newEvent = createMockPaymentEvent({
      paymentId: payment.providerPaymentId,
      orderId: result.orderId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      type: "payment.failed",
    });
    const newSigned = signedMockWebhook(newEvent);
    const failedReplay = await handlePaymentWebhook(handle.db, newSigned.rawBody, newSigned.signature);
    expect(failedReplay.duplicate).toBe(true);
  });

  it("rejects amount mismatches, unknown payments, and invalid transitions", async () => {
    const { payment, result } = await makeCheckout("mismatch@example.com", "webhook-mismatch");
    const mismatch = createMockPaymentEvent({
      paymentId: payment.providerPaymentId,
      orderId: result.orderId,
      amountMinor: payment.amountMinor + 1,
      currency: payment.currency,
      type: "payment.succeeded",
    });
    const signedMismatch = signedMockWebhook(mismatch);
    await expect(
      handlePaymentWebhook(handle.db, signedMismatch.rawBody, signedMismatch.signature),
    ).rejects.toThrow("amount or currency");

    const unknown = createMockPaymentEvent({
      paymentId: "mock_pay_unknown",
      orderId: result.orderId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      type: "payment.succeeded",
    });
    const signedUnknown = signedMockWebhook(unknown);
    await expect(
      handlePaymentWebhook(handle.db, signedUnknown.rawBody, signedUnknown.signature),
    ).rejects.toThrow("unknown payment");

    const success = createMockPaymentEvent({
      paymentId: payment.providerPaymentId,
      orderId: result.orderId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      type: "payment.succeeded",
    });
    const signedSuccess = signedMockWebhook(success);
    await handlePaymentWebhook(handle.db, signedSuccess.rawBody, signedSuccess.signature);

    const invalid = createMockPaymentEvent({
      paymentId: payment.providerPaymentId,
      orderId: result.orderId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      type: "payment.failed",
    });
    const signedInvalid = signedMockWebhook(invalid);
    await expect(
      handlePaymentWebhook(handle.db, signedInvalid.rawBody, signedInvalid.signature),
    ).rejects.toThrow("Invalid payment transition");
  });
});

describe("multi-item fulfillment", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  afterAll(async () => {
    await handle.close();
  });

  it("keeps the order in processing until every item is delivered", async () => {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const planRows = await db.query.plans.findMany({ limit: 2 });
    expect(planRows.length).toBe(2);
    await addCartItem(db, cart.cartId, planRows[0]!.id, 1);
    await addCartItem(db, cart.cartId, planRows[1]!.id, 1);
    const result = await createCheckout(db, {
      cartToken: cart.token,
      email: "multi@example.com",
      name: "Multi Traveler",
      country: "US",
      idempotencyKey: "multi-item-checkout",
    });
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, result.orderId));
    expect(items.length).toBe(2);

    await db
      .update(orders)
      .set({ paymentStatus: "paid", status: "processing", fulfillmentStatus: "queued" })
      .where(eq(orders.id, result.orderId));

    for (const item of items) {
      await db.insert(fulfillmentJobs).values({
        id: newId("job"),
        orderId: result.orderId,
        orderItemId: item.id,
        status: "queued",
        attempts: 0,
        maxAttempts: 8,
        nextAttemptAt: new Date(Date.now() - 60_000),
        idempotencyKey: newId("jobkey"),
      });
    }

    const first = await runFulfillmentJobs(db, { maxJobs: 1 });
    expect(first.processed).toBe(1);
    expect(first.failed).toBe(0);
    const midway = await db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId))
      .limit(1);
    expect(midway[0]?.status).toBe("processing");
    expect(midway[0]?.fulfillmentStatus).toBe("queued");
    expect((await db.select().from(esims)).length).toBe(1);
    expect((await db.select().from(emailEvents)).length).toBe(1);

    const second = await runFulfillmentJobs(db, { maxJobs: 1 });
    expect(second.processed).toBe(1);
    expect(second.failed).toBe(0);
    const delivered = await db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId))
      .limit(1);
    expect(delivered[0]?.status).toBe("delivered");
    expect(delivered[0]?.fulfillmentStatus).toBe("delivered");
    expect((await db.select().from(esims)).length).toBe(2);
    expect((await db.select().from(emailEvents)).length).toBe(2);
  });
});

describe("fulfillment retry", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  afterAll(async () => {
    await handle.close();
  });

  it("does not spin on exhausted failed jobs, then retries after reset", async () => {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst();
    await addCartItem(db, cart.cartId, plan!.id, 1);
    const result = await createCheckout(db, {
      cartToken: cart.token,
      email: "retry@example.com",
      name: "Retry Traveler",
      country: "US",
      idempotencyKey: "retry-job-checkout",
    });
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, result.orderId))
      .limit(1);
    expect(items[0]).toBeTruthy();

    await db
      .update(orders)
      .set({ paymentStatus: "paid", status: "processing", fulfillmentStatus: "queued" })
      .where(eq(orders.id, result.orderId));

    const jobId = newId("job");
    await db.insert(fulfillmentJobs).values({
      id: jobId,
      orderId: result.orderId,
      orderItemId: items[0]!.id,
      status: "failed",
      attempts: 8,
      maxAttempts: 8,
      nextAttemptAt: new Date(Date.now() - 60_000),
      lastError: "simulated exhausted job",
      idempotencyKey: newId("jobkey"),
    });

    const skipped = await runFulfillmentJobs(db);
    expect(skipped.processed).toBe(0);

    await retryFulfillmentJob(db, jobId);
    const reset = await db
      .select()
      .from(fulfillmentJobs)
      .where(eq(fulfillmentJobs.id, jobId))
      .limit(1);
    expect(reset[0]?.status).toBe("queued");
    expect(reset[0]?.attempts).toBe(0);

    const processed = await runFulfillmentJobs(db);
    expect(processed.processed).toBe(1);
    expect(processed.failed).toBe(0);
    const delivered = await db
      .select()
      .from(fulfillmentJobs)
      .where(eq(fulfillmentJobs.id, jobId))
      .limit(1);
    expect(delivered[0]?.status).toBe("delivered");

    await expect(retryFulfillmentJob(db, jobId)).rejects.toThrow("Delivered jobs cannot be retried");
  });
});
