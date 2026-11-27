/**
 * eSIM Access ordering + fulfillment with SIMULATED supplier responses only.
 * No request reaches eSIM Access: the HTTP client gets a fake fetch, and the
 * fulfillment worker gets an in-memory adapter through the test seam.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import {
  emailEvents,
  esims,
  fulfillmentJobs,
  orderItems,
  orders,
  plans,
  supplierTransactions,
} from "@/lib/db/schema";
import { addCartItem, getOrCreateCart } from "@/lib/cart";
import { createCheckout } from "@/lib/checkout";
import { simulateMockPayment } from "@/lib/payments";
import { runOutboxAndJobs, supplierTransactionId } from "@/lib/fulfillment";
import { setSupplierAdapterOverride } from "@/lib/integrations/supplier";
import { setSupplierBalanceFetcherOverride } from "@/lib/fulfillment-readiness";
import {
  EsimAccessSupplierAdapter,
  esimAccessError,
} from "@/lib/integrations/supplier/esimaccess-orders";
import {
  ProviderError,
  type CreateSupplierOrderInput,
  type SupplierAdapter,
  type SupplierEsim,
} from "@/lib/integrations/supplier/types";
import { newId } from "@/lib/ids";
import { makeTestDb } from "./helpers/db";

const CREDENTIALS = { accessCode: "ac_synthetic", secretKey: "sk_synthetic" };

function profile(n: number): SupplierEsim {
  const tail = String(n).padStart(4, "0");
  return {
    supplierEsimId: `2512010000${tail}`,
    iccid: `894310817000077${tail}`,
    lpa: `LPA:1$rsp-eu.example.test$MATCH${tail}`,
    smdpAddress: "rsp-eu.example.test",
    matchingId: `MATCH${tail}`,
    status: "GOT_RESOURCE",
  };
}

let nextProfile = 1;

/** In-memory stand-in for eSIM Access: async allocation, idempotent by transactionId. */
class FakeEsimAccess implements SupplierAdapter {
  readonly key = "esimaccess";
  readonly mode = "live" as const;
  readonly isMock = false;
  readonly capabilities = { createOrder: true };
  readonly retry = { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1, backoffMultiplier: 1 };
  readonly timeoutMs = 1000;
  readonly apiVersion = "fake";
  orders = new Map<string, { orderNo: string; count: number; checks: number }>();
  createCalls: CreateSupplierOrderInput[] = [];
  allocationPolls = 1;
  failWith: ProviderError | null = null;
  profileCount: number | null = null;

  async createOrder(input: CreateSupplierOrderInput) {
    this.createCalls.push(input);
    if (this.failWith) throw this.failWith;
    const existing = this.orders.get(input.transactionId);
    if (existing) return { supplierOrderId: existing.orderNo, status: "ordered", esims: [] };
    const orderNo = `B${Date.now()}${this.orders.size}`;
    this.orders.set(input.transactionId, { orderNo, count: input.quantity, checks: 0 });
    return { supplierOrderId: orderNo, status: "ordered", esims: [] };
  }

  async getEsims(orderNo: string) {
    const order = [...this.orders.values()].find((o) => o.orderNo === orderNo);
    if (!order) throw new ProviderError("supplier_error", "unknown order", false);
    order.checks += 1;
    if (order.checks <= this.allocationPolls) throw esimAccessError("200010", "Profile is being downloaded");
    return Array.from({ length: this.profileCount ?? order.count }, () => profile(nextProfile++));
  }

  async getOrder(orderNo: string) {
    return { supplierOrderId: orderNo, status: "allocated", esims: await this.getEsims(orderNo) };
  }

  async healthCheck() {
    return { ok: true, message: "fake", checkedAt: new Date() };
  }
}

describe("eSIM Access HTTP adapter (fake fetch)", () => {
  it("orders with an idempotent transaction id, price check and period", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const adapter = new EsimAccessSupplierAdapter(CREDENTIALS, (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ success: true, errorCode: null, obj: { orderNo: "B2512010001" } }), { status: 200 });
    }) as typeof fetch);
    const order = await adapter.createOrder({
      transactionId: supplierTransactionId("fulfillment:orderitem_x"),
      productId: "CKH002",
      planName: "Spain 3GB 30Days",
      customerEmail: "c@example.com",
      quantity: 2,
      unitPriceRaw: 16000,
      periodNum: 1,
    });
    expect(order).toMatchObject({ supplierOrderId: "B2512010001", esims: [] });
    expect(calls[0]!.url).toBe("https://api.esimaccess.com/api/v1/open/esim/order");
    expect(calls[0]!.body).toMatchObject({
      amount: 32000,
      packageInfoList: [{ packageCode: "CKH002", count: 2, price: 16000, periodNum: 1 }],
    });
    expect(String(calls[0]!.body.transactionId).length).toBeLessThanOrEqual(50);
  });

  it("parses allocated profiles and classifies supplier errors", async () => {
    const respond = (body: unknown) =>
      new EsimAccessSupplierAdapter(CREDENTIALS, (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch);
    const esimList = [
      {
        esimTranNo: "23120118156818",
        orderNo: "B1",
        iccid: "8943108170000775671",
        ac: "LPA:1$rsp-eu.redteamobile.com$43DE23C67EE747BCAD6B63E8B67B261F",
        esimStatus: "GOT_RESOURCE",
        expiredTime: "2026-12-29T18:34:17+0000",
      },
    ];
    const ok = await respond({ success: true, obj: { esimList } }).getEsims("B1");
    expect(ok[0]).toMatchObject({ supplierEsimId: "23120118156818", smdpAddress: "rsp-eu.redteamobile.com" });
    expect(ok[0]!.expiresAt?.toISOString()).toBe("2026-12-29T18:34:17.000Z");

    await expect(respond({ success: false, errorCode: "200010" }).getEsims("B1")).rejects.toMatchObject({ code: "allocating", retryable: true });
    await expect(respond({ success: false, errorCode: "200007" }).createOrder({ transactionId: "t", productId: "P", planName: "p", customerEmail: "e", quantity: 1 })).rejects.toMatchObject({ code: "insufficient_balance", retryable: false });
    await expect(respond({ success: false, errorCode: "200005" }).createOrder({ transactionId: "t", productId: "P", planName: "p", customerEmail: "e", quantity: 1 })).rejects.toMatchObject({ code: "price_mismatch" });
    await expect(respond({ success: true, obj: { esimList: [{ ...esimList[0], ac: "garbage" }] } }).getEsims("B1")).rejects.toMatchObject({ code: "invalid_response" });
    await expect(respond({ success: true, obj: { esimList: [] } }).getEsims("B1")).rejects.toMatchObject({ code: "allocating" });
  });
});

describe("payment-to-fulfillment with eSIM Access (simulated)", () => {
  let handle: DatabaseHandle;
  let fake: FakeEsimAccess;
  let realPlanId: string;

  beforeAll(() => {
    // Simulated supplier balance for the checkout guard (no supplier call).
    setSupplierBalanceFetcherOverride(async () => 1_000_000);
  });

  beforeAll(async () => {
    handle = await makeTestDb();
    const base = (await handle.db.select().from(plans).limit(1))[0]!;
    realPlanId = newId("plan");
    await handle.db.insert(plans).values({
      ...base,
      id: realPlanId,
      slug: "esim-es-3-30-test",
      name: "Spain 3GB 30Days",
      supplierKey: "esimaccess",
      supplierProductId: "CKH002",
      costMinor: 160,
      priceMinor: 512,
      status: "published",
      isDemo: false,
      supplierMetadata: { dataType: 1 },
    });
  });

  afterEach(() => setSupplierAdapterOverride(null));
  afterAll(async () => {
    setSupplierBalanceFetcherOverride(null);
    await handle.close();
  });

  async function paidOrder(key: string, quantity: number, planId = realPlanId) {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    await addCartItem(db, cart.cartId, planId, quantity);
    const checkout = await createCheckout(db, {
      cartToken: cart.token,
      email: `${key}@example.com`,
      name: "Fulfillment Test",
      country: "US",
      idempotencyKey: key,
    });
    await simulateMockPayment(db, checkout.paymentId, "success");
    return checkout.orderId;
  }

  async function state(orderId: string) {
    const order = (await handle.db.select().from(orders).where(eq(orders.id, orderId)))[0]!;
    const items = await handle.db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const jobs = await handle.db.select().from(fulfillmentJobs).where(eq(fulfillmentJobs.orderId, orderId));
    const issued = await handle.db.select().from(esims).where(eq(esims.orderItemId, items[0]!.id));
    return { order, jobs, issued, item: items[0]! };
  }

  async function runDue(orderId: string) {
    await handle.db.update(fulfillmentJobs).set({ nextAttemptAt: new Date(0) }).where(eq(fulfillmentJobs.orderId, orderId));
    await runOutboxAndJobs(handle.db);
  }

  it("orders once, waits for allocation, then delivers one eSIM per unit", async () => {
    fake = new FakeEsimAccess();
    setSupplierAdapterOverride(() => fake);
    const orderId = await paidOrder("ful-happy", 2);

    let s = await state(orderId);
    expect(s.order.paymentStatus).toBe("paid");
    expect(s.jobs[0]!.status).toBe("queued"); // still allocating
    expect(s.jobs[0]!.attempts).toBe(0); // allocation wait does not consume attempts
    expect(s.issued).toHaveLength(0);
    expect(fake.createCalls).toHaveLength(1);
    expect(fake.createCalls[0]).toMatchObject({ productId: "CKH002", quantity: 2, unitPriceRaw: 16000 });

    await runDue(orderId);
    s = await state(orderId);
    expect(fake.createCalls).toHaveLength(1); // no second purchase
    expect(s.jobs[0]!.status).toBe("delivered");
    expect(s.issued).toHaveLength(2);
    expect(s.issued.every((e) => e.lpaCiphertext && !e.lpaCiphertext.includes("LPA:1"))).toBe(true);
    expect(s.order.fulfillmentStatus).toBe("delivered");
    const tx = await handle.db.select().from(supplierTransactions).where(eq(supplierTransactions.supplierKey, "esimaccess"));
    expect(tx.some((row) => row.status === "delivered")).toBe(true);
    const mail = await handle.db.select().from(emailEvents).where(and(eq(emailEvents.orderId, orderId), eq(emailEvents.template, "esim.delivery")));
    expect(mail).toHaveLength(1);

    // Re-running the worker never buys or issues again.
    await runDue(orderId);
    s = await state(orderId);
    expect(fake.createCalls).toHaveLength(1);
    expect(s.issued).toHaveLength(2);
  });

  it("resumes from the recorded supplier order after a crash instead of re-ordering", async () => {
    fake = new FakeEsimAccess();
    fake.allocationPolls = 0;
    setSupplierAdapterOverride(() => fake);
    // First attempt: order placed, then the job "crashes" before storing eSIMs.
    const crashing = new FakeEsimAccess();
    crashing.getEsims = async () => {
      throw new ProviderError("network", "connection reset", true);
    };
    setSupplierAdapterOverride(() => crashing);
    const orderId = await paidOrder("ful-crash", 1);
    expect(crashing.createCalls).toHaveLength(1);
    const recorded = await handle.db.select().from(supplierTransactions).where(eq(supplierTransactions.clientTransactionId, supplierTransactionId(`fulfillment:${(await state(orderId)).item.id}`)));
    expect(recorded).toHaveLength(1);

    // Retry with a working supplier that already knows the order number.
    fake.orders.set(supplierTransactionId(`fulfillment:${(await state(orderId)).item.id}`), {
      orderNo: recorded[0]!.supplierOrderId,
      count: 1,
      checks: 0,
    });
    setSupplierAdapterOverride(() => fake);
    await runDue(orderId);
    const s = await state(orderId);
    expect(fake.createCalls).toHaveLength(0);
    expect(s.issued).toHaveLength(1);
    expect(s.jobs[0]!.status).toBe("delivered");
  });

  it("keeps the payment and sends insufficient balance to manual review", async () => {
    fake = new FakeEsimAccess();
    fake.failWith = esimAccessError("200007", "Insufficient account balance");
    setSupplierAdapterOverride(() => fake);
    const orderId = await paidOrder("ful-balance", 1);
    const s = await state(orderId);
    expect(s.order.paymentStatus).toBe("paid");
    expect(s.jobs[0]!.status).toBe("manual_review");
    expect(s.order.fulfillmentStatus).toBe("manual_review");
    expect(s.issued).toHaveLength(0);
    // Manual-review jobs are not retried automatically.
    await runDue(orderId);
    expect(fake.createCalls).toHaveLength(1);
  });

  it("never issues fake eSIMs for a real package when supplier ordering is disabled", async () => {
    // Checkout itself refuses a real package while ordering is disabled...
    setSupplierAdapterOverride(null); // real routing: SUPPLIER_LIVE_ENABLED is not set in tests
    await expect(paidOrder("ful-disabled-checkout", 1)).rejects.toThrow(/temporarily unavailable/);
    // ...and if ordering is switched off after a customer already paid, the
    // order goes to manual review instead of receiving fake eSIM details.
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    await addCartItem(db, cart.cartId, realPlanId, 1);
    setSupplierAdapterOverride(() => new FakeEsimAccess());
    const checkout = await createCheckout(db, {
      cartToken: cart.token,
      email: "ful-disabled@example.com",
      name: "Fulfillment Test",
      country: "US",
      idempotencyKey: "ful-disabled",
    });
    setSupplierAdapterOverride(null);
    await simulateMockPayment(db, checkout.paymentId, "success");
    const orderId = checkout.orderId;
    const s = await state(orderId);
    expect(s.order.paymentStatus).toBe("paid");
    expect(s.jobs[0]!.status).toBe("manual_review");
    expect(s.jobs[0]!.lastError).toMatch(/not enabled/);
    expect(s.issued).toHaveLength(0);
  });

  it("rejects a supplier response with the wrong number of profiles", async () => {
    fake = new FakeEsimAccess();
    fake.allocationPolls = 0;
    fake.profileCount = 1;
    setSupplierAdapterOverride(() => fake);
    const orderId = await paidOrder("ful-count", 2);
    const s = await state(orderId);
    expect(s.jobs[0]!.status).toBe("manual_review");
    expect(s.issued).toHaveLength(0);
  });

  it("never marks delivered when a profile already belongs to another order", async () => {
    fake = new FakeEsimAccess();
    fake.allocationPolls = 0;
    setSupplierAdapterOverride(() => fake);
    const first = await paidOrder("ful-conflict-a", 1);
    expect((await state(first)).issued).toHaveLength(1);
    // A buggy supplier response re-issues the same profile id for another order.
    nextProfile -= 1;
    const second = await paidOrder("ful-conflict-b", 1);
    const s = await state(second);
    expect(s.jobs[0]!.status).toBe("manual_review");
    expect(s.jobs[0]!.lastError).toMatch(/already assigned/);
    expect(s.issued).toHaveLength(0);
  });

  it("still fulfils demo (mock) plans with one eSIM per unit", async () => {
    setSupplierAdapterOverride(null);
    const mockPlan = (await handle.db.select().from(plans).where(eq(plans.supplierKey, "mock")).limit(1))[0]!;
    const orderId = await paidOrder("ful-mock", 2, mockPlan.id);
    const s = await state(orderId);
    expect(s.jobs[0]!.status).toBe("delivered");
    expect(s.issued).toHaveLength(2);
  });
});
