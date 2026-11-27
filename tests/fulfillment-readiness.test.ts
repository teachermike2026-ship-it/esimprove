/**
 * Checkout guard: customers can only pay when the supplier can fulfil.
 * Synthetic data only; no request reaches eSIM Access.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/lib/db/client";
import { cryptoPayments, orderItems, orders, payments, plans } from "@/lib/db/schema";
import {
  checkFulfillmentReadiness,
  ESIM_ACCESS_BALANCE_PATH,
  fetchEsimAccessBalanceMinor,
  reservedSupplierCostMinor,
  setSupplierBalanceFetcherOverride,
} from "@/lib/fulfillment-readiness";
import { setSupplierAdapterOverride } from "@/lib/integrations/supplier";
import type { SupplierAdapter } from "@/lib/integrations/supplier/types";
import { newId } from "@/lib/ids";
import { makeTestDb } from "./helpers/db";

const enabled = () => setSupplierAdapterOverride(() => ({}) as SupplierAdapter);
const line = (unitCostMinor: number, quantity = 1) => ({ supplierKey: "esimaccess", unitCostMinor, quantity });

describe("eSIM Access balance query", () => {
  it("is a signed read-only call and converts 1/10,000 USD to cents", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push(String(url));
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["RT-Signature"]).toMatch(/^[0-9a-f]{64}$/);
      return new Response(JSON.stringify({ success: true, obj: { balance: 1234567 } }), { status: 200 });
    }) as unknown as typeof fetch;
    const cents = await fetchEsimAccessBalanceMinor({ accessCode: "a", secretKey: "s" }, fetchImpl);
    expect(cents).toBe(12345); // $123.4567 -> $123.45 (rounded down)
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(ESIM_ACCESS_BALANCE_PATH);
  });

  it("rejects a missing or negative balance", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ success: true, obj: { balance: -5 } }), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchEsimAccessBalanceMinor({ accessCode: "a", secretKey: "s" }, fetchImpl)).rejects.toThrow(/invalid balance/);
  });
});

describe("checkout fulfillment readiness", () => {
  let handle: DatabaseHandle;
  let planId: string;

  beforeAll(async () => {
    handle = await makeTestDb();
    planId = (await handle.db.select().from(plans).limit(1))[0]!.id;
  });
  afterEach(() => {
    setSupplierAdapterOverride(null);
    setSupplierBalanceFetcherOverride(null);
  });
  afterAll(async () => handle.close());

  async function order(opts: { paid?: boolean; crypto?: "pending" | "expired" | "confirming"; fulfillment?: string; cost: number }) {
    const id = newId("order");
    const now = new Date();
    await handle.db.insert(orders).values({
      id,
      orderNumber: `T-${id.slice(-8)}`,
      email: "r@example.com",
      customerName: "R",
      country: "US",
      status: opts.paid ? "processing" : "pending_payment",
      paymentStatus: opts.paid ? "paid" : "pending",
      fulfillmentStatus: opts.fulfillment ?? "not_started",
      subtotalMinor: 500,
      taxMinor: 0,
      totalMinor: 500,
      currency: "USD",
      idempotencyKey: id,
      termsVersion: "test",
    } as typeof orders.$inferInsert);
    await handle.db.insert(orderItems).values({
      id: newId("orderitem"),
      orderId: id,
      planId,
      planName: "Test",
      quantity: 1,
      unitPriceMinor: 500,
      totalMinor: 500,
      costMinor: opts.cost,
      supplierKey: "esimaccess",
      supplierProductId: "PKG",
      dataMb: 1024,
      validityDays: 7,
      currency: "USD",
    } as typeof orderItems.$inferInsert);
    if (opts.crypto) {
      const paymentId = newId("pay");
      await handle.db.insert(payments).values({
        id: paymentId,
        orderId: id,
        provider: "crypto",
        providerPaymentId: paymentId,
        status: "pending",
        amountMinor: 500,
        currency: "USD",
        checkoutUrl: "/checkout/crypto/test",
      } as typeof payments.$inferInsert);
      await handle.db.insert(cryptoPayments).values({
        id: newId("cpay"),
        orderId: id,
        paymentId,
        status: opts.crypto === "expired" ? "pending" : opts.crypto,
        expiresAt: new Date(now.getTime() + (opts.crypto === "expired" ? -60_000 : 30 * 60_000)),
        reference: id,
        chainId: 56,
        tokenContract: "0x55d398326f99059ff775485246999027b3197955",
        receivingAddress: "0x0000000000000000000000000000000000000001",
        amountRaw: `${5_000_000 + Math.floor(Math.random() * 1_000_000)}000000000000`,
        amountUsdt: "5.0001",
        originalAmountMinor: 500,
        originalCurrency: "USD",
      } as unknown as typeof cryptoPayments.$inferInsert);
    }
    return id;
  }

  it("refuses real supplier plans while live ordering is disabled", async () => {
    const r = await checkFulfillmentReadiness(handle.db, [line(160)]);
    expect(r).toMatchObject({ ok: false, reason: "supplier_disabled" });
    expect(r.ok ? "" : r.message).toMatch(/No payment was taken/);
  });

  it("refuses when the supplier balance is zero (the current real account state)", async () => {
    enabled();
    setSupplierBalanceFetcherOverride(async () => 0);
    expect(await checkFulfillmentReadiness(handle.db, [line(160, 2)])).toMatchObject({
      ok: false,
      reason: "insufficient_balance",
      balanceMinor: 0,
      requiredMinor: 320,
    });
  });

  it("fails closed when the balance cannot be read", async () => {
    enabled();
    setSupplierBalanceFetcherOverride(async () => {
      throw new Error("network");
    });
    expect(await checkFulfillmentReadiness(handle.db, [line(160)])).toMatchObject({ ok: false, reason: "balance_unavailable" });
  });

  it("counts balance already committed to paid and in-progress crypto orders", async () => {
    const before = await reservedSupplierCostMinor(handle.db);
    await order({ paid: true, cost: 100 }); // paid, not issued: reserved
    await order({ crypto: "pending", cost: 200 }); // awaiting crypto payment: reserved
    await order({ crypto: "confirming", cost: 300 }); // tx seen: reserved
    await order({ crypto: "expired", cost: 999 }); // abandoned: not reserved
    await order({ paid: true, fulfillment: "delivered", cost: 999 }); // issued: not reserved
    const excluded = await order({ paid: true, cost: 50 });
    expect(await reservedSupplierCostMinor(handle.db)).toBe(before + 650);
    expect(await reservedSupplierCostMinor(handle.db, { excludeOrderId: excluded })).toBe(before + 600);

    enabled();
    const reserved = await reservedSupplierCostMinor(handle.db);
    setSupplierBalanceFetcherOverride(async () => reserved + 159);
    expect(await checkFulfillmentReadiness(handle.db, [line(160)])).toMatchObject({ ok: false, reason: "insufficient_balance" });
    setSupplierBalanceFetcherOverride(async () => reserved + 160);
    expect(await checkFulfillmentReadiness(handle.db, [line(160)])).toMatchObject({ ok: true, requiredMinor: 160 });
  });
});
