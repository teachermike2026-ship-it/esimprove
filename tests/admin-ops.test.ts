/**
 * Admin operations: Needs Attention, order filters, revenue, supplier status,
 * Email Center safeguards and internal timeline privacy. Local test data only
 * (in-memory database, mock supplier, fake network). No real email is sent.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import { auditLogs, emailEvents, orders, plans, providerBalanceSnapshots } from "@/lib/db/schema";
import { addCartItem, getOrCreateCart } from "@/lib/cart";
import { createCheckout } from "@/lib/checkout";
import { simulateMockPayment } from "@/lib/payments";
import { runOutboxAndJobs } from "@/lib/fulfillment";
import { getNeedsAttention, getRevenueReport, listOrdersFiltered, orderStatusCounts, resolveRevenueRange } from "@/lib/admin-ops";
import { checkSupplierNow, getSupplierStatus, getPlanMargins } from "@/lib/supplier-ops";
import { allowedTestRecipients, checkResend, maskEmail, renderTestTemplate, sendTestEmail } from "@/lib/email-ops";
import { isInternalOrderEvent } from "@/components/order-detail";
import { makeTestDb } from "./helpers/db";

describe("admin operations (test data)", () => {
  let handle: DatabaseHandle;
  beforeAll(async () => {
    handle = await makeTestDb();
  }, 180_000);
  afterAll(async () => handle.close());

  async function order(key: string, pay: boolean) {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst({ where: eq(plans.supplierKey, "mock") });
    await addCartItem(db, cart.cartId, plan!.id, 1);
    const result = await createCheckout(db, { cartToken: cart.token, idempotencyKey: key });
    if (pay) {
      await simulateMockPayment(db, result.paymentId, "success");
      await runOutboxAndJobs(db);
      await runOutboxAndJobs(db);
    }
    return result;
  }

  it("flags a paid order that waited too long without delivery, and nothing for a delivered one", async () => {
    const delivered = await order("ops-delivered", true);
    const stuck = await order("ops-stuck", false);
    // Simulate: paid 30 minutes ago, still not delivered.
    await handle.db
      .update(orders)
      .set({ paymentStatus: "paid", fulfillmentStatus: "queued", paidAt: new Date(Date.now() - 30 * 60_000) })
      .where(eq(orders.id, stuck.orderId));
    const items = await getNeedsAttention(handle.db);
    expect(items.find((i) => i.orderId === stuck.orderId)).toMatchObject({ kind: "paid_not_delivered", severity: "high" });
    expect(items.find((i) => i.orderId === stuck.orderId)!.ageMinutes).toBeGreaterThanOrEqual(29);
    expect(items.some((i) => i.orderId === delivered.orderId)).toBe(false);
  });

  it("flags a delivered order with no eSIM record as critical", async () => {
    const broken = await order("ops-broken", false);
    await handle.db
      .update(orders)
      .set({ paymentStatus: "paid", fulfillmentStatus: "delivered", paidAt: new Date() })
      .where(eq(orders.id, broken.orderId));
    const items = await getNeedsAttention(handle.db);
    expect(items.find((i) => i.orderId === broken.orderId && i.kind === "delivered_without_esim")?.severity).toBe("critical");
    // Critical items come first.
    expect(items[0]!.severity).toBe("critical");
  });

  it("filters and counts orders", async () => {
    const paid = await listOrdersFiltered(handle.db, { payment: "paid" });
    expect(paid.rows.every((row) => row.paymentStatus === "paid")).toBe(true);
    const search = await listOrdersFiltered(handle.db, { q: paid.rows[0]!.orderNumber.toLowerCase() });
    expect(search.rows.map((r) => r.orderNumber)).toContain(paid.rows[0]!.orderNumber);
    const counts = await orderStatusCounts(handle.db);
    expect(counts.payment.paid).toBeGreaterThanOrEqual(1);
  });

  it("revenue counts paid orders only and supplier cost only for delivered eSIMs", async () => {
    const pending = await order("ops-unpaid", false);
    const range = resolveRevenueRange("7d");
    const report = await getRevenueReport(handle.db, range.from, range.to);
    const all = await handle.db.select().from(orders);
    const paidTotal = all
      .filter((o) => ["paid", "refunded", "partially_refunded", "disputed"].includes(o.paymentStatus) && o.paidAt && o.paidAt >= range.from)
      .reduce((sum, o) => sum + o.totalMinor, 0);
    expect(report.grossMinor).toBe(paidTotal);
    expect(all.find((o) => o.id === pending.orderId)!.paymentStatus).toBe("pending");
    expect(report.netSalesMinor).toBe(report.grossMinor - report.confirmedRefundsMinor);
    expect(report.estimatedProfitMinor).toBe(report.netSalesMinor - report.supplierCostMinor - report.estimatedPaymentFeesMinor);
    expect(report.byDay.length).toBe(7);
  });

  it("never invents a supplier balance: a failed check keeps the last known value", async () => {
    const ok = await checkSupplierNow(handle.db, { fetcher: async () => 12_345 });
    expect(ok).toMatchObject({ ok: true, balanceMinor: 12_345 });
    const failed = await checkSupplierNow(handle.db, {
      fetcher: async () => {
        throw new Error("timeout talking to supplier with key abcdefghijklmnopqrstuvwxyz123456");
      },
    });
    expect(failed.ok).toBe(false);
    expect(failed.message).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    const status = await getSupplierStatus(handle.db);
    expect(status.lastBalanceMinor).toBe(12_345);
    expect(status.apiStatus).toBe("error");
    expect(status.recentErrors.length).toBeGreaterThanOrEqual(1);
  });

  it("raises a low-balance alert once, not on every check", async () => {
    await checkSupplierNow(handle.db, { fetcher: async () => 100 });
    await checkSupplierNow(handle.db, { fetcher: async () => 100 });
    const alerts = await handle.db.select().from(auditLogs).where(eq(auditLogs.action, "alert.supplier.low_balance"));
    expect(alerts).toHaveLength(1);
    const snap = await handle.db.select().from(providerBalanceSnapshots);
    expect(snap.find((s) => s.providerKey === "esimaccess")?.balanceMinor).toBe(100);
  });

  it("reports plan gross margins (not net profit)", async () => {
    const margins = await getPlanMargins(handle.db, 5);
    for (const plan of margins.lowest) expect(plan.grossMarginMinor).toBe(plan.priceMinor - plan.costMinor);
  });

  it("test emails go only to administrator-controlled recipients, after confirmation", async () => {
    const saved = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
    process.env.RESEND_API_KEY = "re_synthetic_key";
    process.env.EMAIL_FROM = "ESIMPROVE Support <support@esimprove.com>";
    try {
      const base = { adminId: "admin_1", adminEmail: "owner@esimprove.com", template: "order.confirmation" };
      expect(await sendTestEmail(handle.db, { ...base, recipient: "owner@esimprove.com", confirmed: false })).toMatchObject({ ok: false });
      expect(await sendTestEmail(handle.db, { ...base, recipient: "customer@example.com", confirmed: true })).toMatchObject({ ok: false });
      const requests: string[] = [];
      const fakeFetch = (async (url: string, init?: RequestInit) => {
        requests.push(`${url} ${String(init?.body ?? "")}`);
        return new Response(JSON.stringify({ id: "resend_msg_123" }), { status: 200 });
      }) as unknown as typeof fetch;
      const sent = await sendTestEmail(handle.db, { ...base, recipient: "OWNER@esimprove.com", confirmed: true }, { fetchImpl: fakeFetch });
      expect(sent).toMatchObject({ ok: true, providerMessageId: "resend_msg_123" });
      expect(requests).toHaveLength(1);
      expect(requests[0]).toContain("[TEST]");
      const row = (await handle.db.select().from(emailEvents).where(eq(emailEvents.providerMessageId, "resend_msg_123")))[0]!;
      expect(row.status).toBe("sent");
      expect(row.template).toBe("admin.test.order.confirmation");
    } finally {
      process.env.RESEND_API_KEY = saved.key;
      process.env.EMAIL_FROM = saved.from;
      if (saved.key === undefined) delete process.env.RESEND_API_KEY;
      if (saved.from === undefined) delete process.env.EMAIL_FROM;
    }
  });
});

describe("Email Center helpers", () => {
  it("masks recipients", () => {
    expect(maskEmail("traveler@example.com")).toBe("tr***@ex***.com");
    expect(maskEmail("")).toBe("");
  });

  it("labels test templates as tests with sample data", () => {
    const t = renderTestTemplate("refund.approved");
    expect(t.subject.startsWith("[TEST]")).toBe(true);
    expect(t.text).toMatch(/sample data, not a real order/);
  });

  it("restricts test recipients to the admin and EMAIL_TEST_RECIPIENT", () => {
    const saved = process.env.EMAIL_TEST_RECIPIENT;
    process.env.EMAIL_TEST_RECIPIENT = "inbox@esimprove.com";
    try {
      expect(allowedTestRecipients("Owner@Esimprove.com")).toEqual(["owner@esimprove.com", "inbox@esimprove.com"]);
    } finally {
      if (saved === undefined) delete process.env.EMAIL_TEST_RECIPIENT;
      else process.env.EMAIL_TEST_RECIPIENT = saved;
    }
  });

  it("checks Resend read-only and reports domain verification without exposing the key", async () => {
    const saved = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
    process.env.RESEND_API_KEY = "re_secret_should_not_leak";
    process.env.EMAIL_FROM = "Support <support@esimprove.com>";
    try {
      const calls: Array<{ url: string; method: string }> = [];
      const fakeFetch = (async (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method ?? "GET" });
        return new Response(JSON.stringify({ data: [{ name: "esimprove.com", status: "verified" }] }), { status: 200 });
      }) as unknown as typeof fetch;
      const check = await checkResend({ fetchImpl: fakeFetch });
      expect(check).toMatchObject({ status: "ok", senderDomain: "esimprove.com", senderDomainVerified: true });
      expect(calls).toEqual([{ url: "https://api.resend.com/domains", method: "GET" }]);
      expect(JSON.stringify(check)).not.toContain("re_secret_should_not_leak");
      const unauthorized = await checkResend({ fetchImpl: (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch });
      expect(unauthorized.status).toBe("unauthorized");
    } finally {
      process.env.RESEND_API_KEY = saved.key;
      process.env.EMAIL_FROM = saved.from;
      if (saved.key === undefined) delete process.env.RESEND_API_KEY;
      if (saved.from === undefined) delete process.env.EMAIL_FROM;
    }
  });
});

describe("order timeline privacy", () => {
  it("hides internal entries (alerts, notes, review reasons) from customers", () => {
    expect(isInternalOrderEvent("admin.alert")).toBe(true);
    expect(isInternalOrderEvent("admin.note")).toBe(true);
    expect(isInternalOrderEvent("refund.review_required")).toBe(true);
    expect(isInternalOrderEvent("fulfillment.delivered")).toBe(false);
    expect(isInternalOrderEvent("payment.succeeded")).toBe(false);
  });
});
