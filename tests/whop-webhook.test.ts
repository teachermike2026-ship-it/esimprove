/**
 * Whop webhook handling with SYNTHETIC payloads only.
 *
 * Payloads follow the public OpenAPI shapes (Payment / RefundLegacy / Dispute,
 * api_version_date 2026-11-23-3) and are signed locally with a fake `ws_`
 * secret using the Standard Webhooks scheme the Whop SDK verifies. Nothing
 * here contacts Whop or uses a real credential.
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { WebhookVerificationError } from "@whop/sdk/helpers";
import type { DatabaseHandle } from "@/lib/db/client";
import {
  esims,
  orderEvents,
  orderItems,
  orders,
  outboxEvents,
  paymentProviderCases,
  payments,
} from "@/lib/db/schema";
import { addCartItem, getOrCreateCart } from "@/lib/cart";
import { createCheckout } from "@/lib/checkout";
import { newId } from "@/lib/ids";
import { handleWhopWebhook } from "@/lib/payments/whop-webhooks";
import { setWhopPaymentLedgerOverride } from "@/lib/integrations/payment/whop";
import { runOutboxAndJobs } from "@/lib/fulfillment";
import { fulfillmentJobs } from "@/lib/db/schema";
import {
  WhopWebhookPayloadError,
  decimalNumberToMinor,
  decimalStringToMinor,
  parseWhopWebhook,
} from "@/lib/integrations/payment/whop-webhook";
import { makeTestDb } from "./helpers/db";

const SECRET = "ws_synthetic_test_secret_not_a_real_key";
const VERSION = "2026-11-23-3";

function sign(body: string, webhookId: string, secret = SECRET, offsetSeconds = 0) {
  const timestamp = String(Math.floor(Date.now() / 1000) + offsetSeconds);
  const signature = createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(`${webhookId}.${timestamp}.${body}`)
    .digest("base64");
  return {
    "webhook-id": webhookId,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  };
}

function envelope(type: string, data: unknown, webhookId: string) {
  return JSON.stringify({
    id: webhookId,
    api_version: "v1",
    api_version_date: VERSION,
    account_id: "biz_synthetic",
    timestamp: new Date().toISOString(),
    type,
    data,
  });
}

function money(amountMinor: number, currency = "usd") {
  return {
    amount: (amountMinor / 100).toFixed(2),
    currency,
    decimals: 2,
    display_decimals: 2,
  };
}

interface WhopOrder {
  orderId: string;
  localPaymentId: string;
  checkoutId: string;
  providerPaymentId: string;
  amountMinor: number;
}

function paymentData(order: WhopOrder, overrides: Record<string, unknown> = {}) {
  return {
    id: order.providerPaymentId,
    status: "paid",
    currency: "usd",
    total: money(order.amountMinor),
    subtotal: money(order.amountMinor),
    tax_amount: null,
    tax_behavior: null,
    checkout_configuration_id: order.checkoutId,
    product_id: "prod_synthetic",
    variant_id: "plan_synthetic",
    metadata: {
      esimprove_order_id: order.orderId,
      esimprove_payment_id: order.localPaymentId,
    },
    ...overrides,
  };
}

let webhookCounter = 0;
function nextWebhookId() {
  webhookCounter += 1;
  return `msg_synthetic${String(webhookCounter).padStart(6, "0")}`;
}

describe("Whop webhooks (synthetic payloads)", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  afterAll(async () => {
    await handle.close();
  });

  /** Create a real local order, then attach a Whop payment row as checkout would. */
  async function makeWhopOrder(key: string): Promise<WhopOrder> {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst();
    await addCartItem(db, cart.cartId, plan!.id, 1);
    const result = await createCheckout(db, {
      cartToken: cart.token,
      email: `${key}@example.com`,
      name: "Whop Traveler",
      country: "US",
      idempotencyKey: key,
    });
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
      checkoutUrl: "https://whop.com/checkout/synthetic",
    });
    return {
      orderId: result.orderId,
      localPaymentId,
      checkoutId,
      providerPaymentId: `pay_${key.replace(/[^a-z0-9]/gi, "")}`,
      amountMinor: result.totalMinor,
    };
  }

  async function deliver(type: string, data: unknown, webhookId = nextWebhookId()) {
    const body = envelope(type, data, webhookId);
    return handleWhopWebhook(handle.db, body, sign(body, webhookId), SECRET);
  }

  async function orderRow(orderId: string) {
    return (await handle.db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0]!;
  }

  async function fulfillmentRequests(orderId: string) {
    return handle.db
      .select()
      .from(outboxEvents)
      .where(
        and(eq(outboxEvents.aggregateId, orderId), eq(outboxEvents.topic, "fulfillment.requested")),
      );
  }

  it("marks a verified, exactly matching paid payment as paid once", async () => {
    const order = await makeWhopOrder("whop-paid");
    const webhookId = nextWebhookId();
    const first = await deliver("payment.succeeded", paymentData(order), webhookId);
    expect(first.duplicate).toBe(false);
    expect(first.reviewRequired).toBeUndefined();
    expect((await orderRow(order.orderId)).paymentStatus).toBe("paid");

    // Same webhook-id (a Whop retry): recognised as a duplicate.
    const retry = await deliver("payment.succeeded", paymentData(order), webhookId);
    expect(retry.duplicate).toBe(true);

    // A different delivery for the same payment cannot queue fulfillment again.
    const second = await deliver("payment.succeeded", paymentData(order));
    expect(second.duplicate).toBe(true);
    expect(await fulfillmentRequests(order.orderId)).toHaveLength(1);

    const stored = await handle.db
      .select()
      .from(payments)
      .where(eq(payments.id, order.localPaymentId))
      .limit(1);
    expect(stored[0]?.providerPaymentId).toBe(order.providerPaymentId);
  });

  it("processes concurrent deliveries of the same webhook-id exactly once", async () => {
    const order = await makeWhopOrder("whop-concurrent");
    const webhookId = nextWebhookId();
    const body = envelope("payment.succeeded", paymentData(order), webhookId);
    const headers = sign(body, webhookId);
    const results = await Promise.all([
      handleWhopWebhook(handle.db, body, headers, SECRET),
      handleWhopWebhook(handle.db, body, headers, SECRET),
      handleWhopWebhook(handle.db, body, headers, SECRET),
    ]);
    expect(results.filter((result) => !result.duplicate)).toHaveLength(1);
    expect(await fulfillmentRequests(order.orderId)).toHaveLength(1);
  });

  it("only marks paid when status is exactly 'paid'", async () => {
    const order = await makeWhopOrder("whop-open");
    const held = await deliver("payment.succeeded", paymentData(order, { status: "open" }));
    expect(held.reviewRequired).toMatch(/not "paid"/);
    expect((await orderRow(order.orderId)).paymentStatus).toBe("pending");
    expect(await fulfillmentRequests(order.orderId)).toHaveLength(0);
  });

  it("holds discounted, overpaid, or re-priced payments for review", async () => {
    const discounted = await makeWhopOrder("whop-discount");
    const result = await deliver(
      "payment.succeeded",
      paymentData(discounted, { total: money(discounted.amountMinor - 100) }),
    );
    expect(result.reviewRequired).toMatch(/lower than the order price/);
    expect((await orderRow(discounted.orderId)).paymentStatus).toBe("pending");

    const overpaid = await makeWhopOrder("whop-over");
    const over = await deliver(
      "payment.succeeded",
      paymentData(overpaid, { total: money(overpaid.amountMinor + 1) }),
    );
    expect(over.reviewRequired).toMatch(/higher than the order price/);

    const repriced = await makeWhopOrder("whop-reprice");
    const re = await deliver(
      "payment.succeeded",
      paymentData(repriced, { subtotal: money(repriced.amountMinor + 500) }),
    );
    expect(re.reviewRequired).toMatch(/subtotal/);

    const otherCheckout = await makeWhopOrder("whop-checkout");
    const other = await deliver(
      "payment.succeeded",
      paymentData(otherCheckout, { checkout_configuration_id: "ch_someoneelse" }),
    );
    expect(other.reviewRequired).toMatch(/different checkout/);
  });

  it("accepts exclusive tax on top of the price but not missing totals", async () => {
    const taxed = await makeWhopOrder("whop-tax");
    const ok = await deliver(
      "payment.succeeded",
      paymentData(taxed, {
        total: money(taxed.amountMinor + 250),
        tax_amount: money(250),
        tax_behavior: "exclusive",
      }),
    );
    expect(ok.reviewRequired).toBeUndefined();
    expect((await orderRow(taxed.orderId)).paymentStatus).toBe("paid");

    const missing = await makeWhopOrder("whop-nototal");
    const held = await deliver("payment.succeeded", paymentData(missing, { total: null }));
    expect(held.reviewRequired).toMatch(/total is missing/);
  });

  it("accepts Whop currency values such as usdt and whop_usd but still requires a match", async () => {
    for (const currency of ["usdt", "whop_usd"]) {
      const order = await makeWhopOrder(`whop-${currency.replace("_", "")}`);
      const result = await deliver(
        "payment.succeeded",
        paymentData(order, { currency, total: money(order.amountMinor, currency), subtotal: null }),
      );
      expect(result.reviewRequired).toMatch(/currency does not match/);
      expect((await orderRow(order.orderId)).paymentStatus).toBe("pending");
    }
  });

  it("rejects bad signatures and malformed payloads", async () => {
    const order = await makeWhopOrder("whop-sig");
    const webhookId = nextWebhookId();
    const body = envelope("payment.succeeded", paymentData(order), webhookId);
    expect(() =>
      parseWhopWebhook(body, sign(body, webhookId, "ws_wrong_secret"), SECRET),
    ).toThrow(WebhookVerificationError);
    const tampered = body.replace('"paid"', '"void"');
    expect(() => parseWhopWebhook(tampered, sign(body, webhookId), SECRET)).toThrow(
      WebhookVerificationError,
    );

    const upperCurrency = envelope(
      "payment.succeeded",
      paymentData(order, { currency: "USD" }),
      webhookId,
    );
    expect(() =>
      parseWhopWebhook(upperCurrency, sign(upperCurrency, webhookId), SECRET),
    ).toThrow(WhopWebhookPayloadError);

    const legacy = JSON.stringify({
      ...JSON.parse(body),
      api_version: "v2",
    });
    expect(() => parseWhopWebhook(legacy, sign(legacy, webhookId), SECRET)).toThrow(
      WhopWebhookPayloadError,
    );
  });

  it("ignores payments that do not belong to ESIMPROVE and unhandled event types", async () => {
    const order = await makeWhopOrder("whop-foreign");
    const foreign = await deliver("payment.succeeded", paymentData(order, { metadata: null }));
    expect(foreign.ignored).toMatch(/no ESIMPROVE references/);
    expect((await orderRow(order.orderId)).paymentStatus).toBe("pending");

    const other = await deliver("membership.activated", { id: "mem_synthetic" });
    expect(other.ignored).toMatch(/not handled/);
  });

  it("records refunds, moves status, and never queues fulfillment", async () => {
    const order = await makeWhopOrder("whop-refund");
    await deliver("payment.succeeded", paymentData(order));
    expect(await fulfillmentRequests(order.orderId)).toHaveLength(1);

    const refundBase = {
      id: "rf_synthetic1",
      amount: 1,
      currency: "usd",
      status: "pending",
      provider: "stripe",
      payment: { id: order.providerPaymentId, metadata: null },
      created_at: new Date().toISOString(),
    };
    const pending = await deliver("refund.created", refundBase);
    expect(pending.caseId).toBeTruthy();
    expect((await orderRow(order.orderId)).paymentStatus).toBe("paid");

    const partialId = nextWebhookId();
    const partial = await deliver("refund.updated", { ...refundBase, status: "succeeded" }, partialId);
    expect(partial.duplicate).toBe(false);
    expect((await orderRow(order.orderId)).paymentStatus).toBe("partially_refunded");

    // Retry of the same delivery changes nothing.
    const retry = await deliver("refund.updated", { ...refundBase, status: "succeeded" }, partialId);
    expect(retry.duplicate).toBe(true);

    const rest = (order.amountMinor - 100) / 100;
    await deliver("refund.created", {
      ...refundBase,
      id: "rf_synthetic2",
      amount: rest,
      status: "succeeded",
    });
    expect((await orderRow(order.orderId)).paymentStatus).toBe("refunded");

    const cases = await handle.db
      .select()
      .from(paymentProviderCases)
      .where(eq(paymentProviderCases.orderId, order.orderId));
    expect(cases).toHaveLength(2);
    expect(cases.every((row) => row.kind === "refund" && !row.needsReview)).toBe(true);
    expect(await fulfillmentRequests(order.orderId)).toHaveLength(1);
  });

  it("flags refunds above the payment for review when Whop cannot confirm them", async () => {
    const order = await makeWhopOrder("whop-refund-review");
    await deliver("payment.succeeded", paymentData(order));
    await deliver("refund.created", {
      id: "rf_review1",
      amount: (order.amountMinor * 2 + 1) / 100,
      currency: "usd",
      status: "succeeded",
      payment: { id: order.providerPaymentId },
    });
    const row = (
      await handle.db
        .select()
        .from(paymentProviderCases)
        .where(eq(paymentProviderCases.providerCaseId, "rf_review1"))
    )[0]!;
    expect(row.needsReview).toBe(true);
    expect((await orderRow(order.orderId)).paymentStatus).toBe("paid");
  });

  it("flags refunds in a different currency for review", async () => {
    const order = await makeWhopOrder("whop-refund-currency");
    await deliver("payment.succeeded", paymentData(order));
    await deliver("refund.created", {
      id: "rf_currency1",
      amount: order.amountMinor / 100,
      currency: "eur",
      status: "succeeded",
      payment: { id: order.providerPaymentId },
    });
    const row = (
      await handle.db
        .select()
        .from(paymentProviderCases)
        .where(eq(paymentProviderCases.providerCaseId, "rf_currency1"))
    )[0]!;
    expect(row.needsReview).toBe(true);
    expect((await orderRow(order.orderId)).paymentStatus).toBe("paid");
  });

  it("treats an above-price USD refund as full when Whop confirms the buyer-currency refund", async () => {
    const order = await makeWhopOrder("whop-refund-fx");
    await deliver("payment.succeeded", paymentData(order));
    // Real sandbox case: $4.28 order, Whop total $4.71, refunded 124092/124092 VND.
    setWhopPaymentLedgerOverride(async (id) => ({
      providerPaymentId: id,
      currency: "USD",
      subtotalMinor: order.amountMinor,
      totalMinor: order.amountMinor + 43,
      refundedMinor: order.amountMinor + 43,
      presentmentCurrency: "VND",
      presentmentTotalMinor: 124092,
      presentmentRefundedMinor: 124092,
      substatus: "refunded",
      metadataOrderId: order.orderId,
    }));
    try {
      await deliver("refund.created", {
        id: "rf_fx1",
        amount: (order.amountMinor + 43) / 100,
        currency: "usd",
        status: "succeeded",
        payment: { id: order.providerPaymentId },
      });
    } finally {
      setWhopPaymentLedgerOverride(async () => null);
    }
    const row = (
      await handle.db.select().from(paymentProviderCases).where(eq(paymentProviderCases.providerCaseId, "rf_fx1"))
    )[0]!;
    expect(row.needsReview).toBe(false);
    expect((await orderRow(order.orderId)).paymentStatus).toBe("refunded");
  });

  it("keeps an above-price refund on review when Whop cannot confirm it", async () => {
    const order = await makeWhopOrder("whop-refund-fx-unconfirmed");
    await deliver("payment.succeeded", paymentData(order));
    await deliver("refund.created", {
      id: "rf_fx2",
      amount: (order.amountMinor + 43) / 100,
      currency: "usd",
      status: "succeeded",
      payment: { id: order.providerPaymentId },
    });
    const row = (
      await handle.db.select().from(paymentProviderCases).where(eq(paymentProviderCases.providerCaseId, "rf_fx2"))
    )[0]!;
    expect(row.needsReview).toBe(true);
    expect((await orderRow(order.orderId)).paymentStatus).toBe("paid");
  });

  it("records disputes as a risk status without new fulfillment", async () => {
    const order = await makeWhopOrder("whop-dispute");
    await deliver("payment.succeeded", paymentData(order));
    const dispute = {
      id: "dspt_synthetic1",
      amount: order.amountMinor / 100,
      currency: "USD",
      status: "needs_response",
      reason: "fraudulent",
      payment: { id: order.providerPaymentId },
    };
    const webhookId = nextWebhookId();
    const created = await deliver("dispute.created", dispute, webhookId);
    expect(created.duplicate).toBe(false);
    expect((await orderRow(order.orderId)).paymentStatus).toBe("disputed");
    expect((await deliver("dispute.created", dispute, webhookId)).duplicate).toBe(true);

    await deliver("dispute.updated", { ...dispute, status: "won" });
    expect((await orderRow(order.orderId)).paymentStatus).toBe("disputed");
    const row = (
      await handle.db
        .select()
        .from(paymentProviderCases)
        .where(eq(paymentProviderCases.providerCaseId, "dspt_synthetic1"))
    )[0]!;
    expect(row.providerStatus).toBe("won");
    expect(await fulfillmentRequests(order.orderId)).toHaveLength(1);
  });

  describe("refund reconciliation", () => {
    function refund(order: WhopOrder, id: string, amountMinor: number, status = "succeeded", currency = "usd") {
      return { id, amount: amountMinor / 100, currency, status, payment: { id: order.providerPaymentId } };
    }
    async function caseRow(id: string) {
      return (await handle.db.select().from(paymentProviderCases).where(eq(paymentProviderCases.providerCaseId, id)))[0]!;
    }
    function ledgerFor(order: WhopOrder, presentmentRefunded: number, extra: Record<string, unknown> = {}) {
      return async (id: string) => ({
        providerPaymentId: id,
        currency: "USD",
        subtotalMinor: order.amountMinor,
        totalMinor: order.amountMinor,
        refundedMinor: presentmentRefunded === 0 ? 0 : Math.round((order.amountMinor * presentmentRefunded) / 100000),
        presentmentCurrency: "EUR",
        presentmentTotalMinor: 100000,
        presentmentRefundedMinor: presentmentRefunded,
        substatus: presentmentRefunded >= 100000 ? "refunded" : "partially_refunded",
        metadataOrderId: order.orderId,
        ...extra,
      });
    }

    it("does not double count the same refund re-sent under a new webhook ID", async () => {
      const order = await makeWhopOrder("rr-same-case");
      await deliver("payment.succeeded", paymentData(order));
      await deliver("refund.created", refund(order, "rf_same1", 100));
      await deliver("refund.updated", refund(order, "rf_same1", 100));
      expect((await orderRow(order.orderId)).paymentStatus).toBe("partially_refunded");
      const cases = await handle.db.select().from(paymentProviderCases).where(eq(paymentProviderCases.orderId, order.orderId));
      expect(cases).toHaveLength(1);
    });

    it("detects a cumulative over-refund across several refunds and keeps it on review", async () => {
      const order = await makeWhopOrder("rr-cumulative");
      await deliver("payment.succeeded", paymentData(order));
      await deliver("refund.created", refund(order, "rf_cum1", order.amountMinor - 50));
      expect((await orderRow(order.orderId)).paymentStatus).toBe("partially_refunded");
      await deliver("refund.created", refund(order, "rf_cum2", 100));
      expect((await caseRow("rf_cum2")).needsReview).toBe(true);
      expect((await orderRow(order.orderId)).paymentStatus).toBe("partially_refunded");
    });

    it("puts a confirmed refund that is later reported failed into manual review", async () => {
      const order = await makeWhopOrder("rr-reversed");
      await deliver("payment.succeeded", paymentData(order));
      await deliver("refund.created", refund(order, "rf_rev1", order.amountMinor));
      expect((await orderRow(order.orderId)).paymentStatus).toBe("refunded");
      await deliver("refund.updated", refund(order, "rf_rev1", order.amountMinor, "failed"));
      const row = await caseRow("rf_rev1");
      expect(row.needsReview).toBe(true);
      expect(row.reviewReason).toMatch(/now reported as "failed"/);
      // Status never moves backwards automatically.
      expect((await orderRow(order.orderId)).paymentStatus).toBe("refunded");
    });

    it("records a refund that simply failed without changing anything", async () => {
      const order = await makeWhopOrder("rr-failed");
      await deliver("payment.succeeded", paymentData(order));
      await deliver("refund.created", refund(order, "rf_fail1", order.amountMinor, "failed"));
      const row = await caseRow("rf_fail1");
      expect(row.needsReview).toBe(false);
      expect((await orderRow(order.orderId)).paymentStatus).toBe("paid");
    });

    it("uses Whop's buyer-currency totals: partial first, then full, flagging eSIMs only on full", async () => {
      const order = await makeWhopOrder("rr-ledger");
      await deliver("payment.succeeded", paymentData(order));
      await runOutboxAndJobs(handle.db);
      const esimStatuses = async () =>
        (
          await handle.db
            .select({ status: esims.status })
            .from(esims)
            .innerJoin(orderItems, eq(orderItems.id, esims.orderItemId))
            .where(eq(orderItems.orderId, order.orderId))
        ).map((row) => row.status);
      const before = await esimStatuses();
      try {
        setWhopPaymentLedgerOverride(ledgerFor(order, 40000));
        await deliver("refund.created", refund(order, "rf_led1", Math.round(order.amountMinor * 0.4)));
        expect((await orderRow(order.orderId)).paymentStatus).toBe("partially_refunded");
        expect(await esimStatuses()).toEqual(before);

        setWhopPaymentLedgerOverride(ledgerFor(order, 100000));
        await deliver("refund.created", refund(order, "rf_led2", order.amountMinor - Math.round(order.amountMinor * 0.4) + 3));
        expect((await orderRow(order.orderId)).paymentStatus).toBe("refunded");
        expect((await caseRow("rf_led2")).needsReview).toBe(false);
        expect((await esimStatuses()).every((status) => status === "refund_flagged")).toBe(true);
      } finally {
        setWhopPaymentLedgerOverride(async () => null);
      }
    });

    it("sends a refund to review when Whop's payment points to a different order", async () => {
      const order = await makeWhopOrder("rr-mismatch");
      await deliver("payment.succeeded", paymentData(order));
      try {
        setWhopPaymentLedgerOverride(ledgerFor(order, 100000, { metadataOrderId: "order_someone_else" }));
        await deliver("refund.created", refund(order, "rf_mis1", order.amountMinor));
      } finally {
        setWhopPaymentLedgerOverride(async () => null);
      }
      expect((await caseRow("rf_mis1")).needsReview).toBe(true);
      expect((await orderRow(order.orderId)).paymentStatus).toBe("paid");
    });
  });

  it("acknowledges refunds and disputes for payments ESIMPROVE does not know", async () => {
    const result = await deliver("dispute.created", {
      id: "dspt_foreign",
      amount: 10,
      currency: "usd",
      status: "needs_response",
      payment: { id: "pay_foreign" },
    });
    expect(result.ignored).toMatch(/does not belong/);
  });

  it("pays the order when a declined card is retried successfully in the same checkout", async () => {
    const order = await makeWhopOrder("whop-retry");
    await deliver(
      "payment.failed",
      paymentData(order, { id: "pay_declined01", status: "open" }),
    );
    expect((await orderRow(order.orderId)).paymentStatus).toBe("failed");
    const afterFail = await handle.db
      .select()
      .from(payments)
      .where(eq(payments.id, order.localPaymentId))
      .limit(1);
    // The checkout reference is kept so the later success still matches it.
    expect(afterFail[0]?.providerPaymentId).toBe(order.checkoutId);

    const paid = await deliver("payment.succeeded", paymentData(order));
    expect(paid.reviewRequired).toBeUndefined();
    expect((await orderRow(order.orderId)).paymentStatus).toBe("paid");
    expect(await fulfillmentRequests(order.orderId)).toHaveLength(1);
  });

  it("holds payments for a different Whop product for review", async () => {
    const saved = process.env.WHOP_PRODUCT_ID;
    process.env.WHOP_PRODUCT_ID = "prod_synthetic";
    try {
      const wrong = await makeWhopOrder("whop-product");
      const held = await deliver("payment.succeeded", paymentData(wrong, { product_id: "prod_other" }));
      expect(held.reviewRequired).toMatch(/different Whop product/);
      expect((await orderRow(wrong.orderId)).paymentStatus).toBe("pending");

      const right = await makeWhopOrder("whop-product-ok");
      const ok = await deliver("payment.succeeded", paymentData(right));
      expect(ok.reviewRequired).toBeUndefined();
      expect((await orderRow(right.orderId)).paymentStatus).toBe("paid");
    } finally {
      if (saved === undefined) delete process.env.WHOP_PRODUCT_ID;
      else process.env.WHOP_PRODUCT_ID = saved;
    }
  });

  it("can defer fulfillment so the webhook answers quickly", async () => {
    const order = await makeWhopOrder("whop-defer");
    const webhookId = nextWebhookId();
    const body = envelope("payment.succeeded", paymentData(order), webhookId);
    const result = await handleWhopWebhook(handle.db, body, sign(body, webhookId), SECRET, {
      runFulfillment: false,
    });
    expect(result.fulfillmentQueued).toBe(true);
    const before = await handle.db
      .select()
      .from(fulfillmentJobs)
      .where(eq(fulfillmentJobs.orderId, order.orderId));
    expect(before).toHaveLength(0);

    await runOutboxAndJobs(handle.db);
    const after = await handle.db
      .select()
      .from(fulfillmentJobs)
      .where(eq(fulfillmentJobs.orderId, order.orderId));
    expect(after.length).toBeGreaterThan(0);

    // A retried delivery after fulfillment started queues nothing new.
    const retry = await handleWhopWebhook(handle.db, body, sign(body, webhookId), SECRET, {
      runFulfillment: false,
    });
    expect(retry.duplicate).toBe(true);
    expect(await fulfillmentRequests(order.orderId)).toHaveLength(1);
  });

  it("rejects signed webhooks outside the 5-minute timestamp window", async () => {
    const order = await makeWhopOrder("whop-stale");
    const webhookId = nextWebhookId();
    const body = envelope("payment.succeeded", paymentData(order), webhookId);
    expect(() => parseWhopWebhook(body, sign(body, webhookId, SECRET, -6 * 60), SECRET)).toThrow(
      WebhookVerificationError,
    );
    expect(() => parseWhopWebhook(body, sign(body, webhookId, SECRET, 6 * 60), SECRET)).toThrow(
      WebhookVerificationError,
    );
    expect(() => parseWhopWebhook(body, sign(body, webhookId, SECRET, -60), SECRET)).not.toThrow();
  });

  it("notes whether the Whop buyer email matches the order, without blocking", async () => {
    const order = await makeWhopOrder("whop-email");
    const result = await deliver(
      "payment.succeeded",
      paymentData(order, { customer_email: "someone-else@example.com" }),
    );
    expect(result.reviewRequired).toBeUndefined();
    expect((await orderRow(order.orderId)).paymentStatus).toBe("paid");
    const events = await handle.db
      .select()
      .from(orderEvents)
      .where(and(eq(orderEvents.orderId, order.orderId), eq(orderEvents.type, "payment.succeeded")));
    expect(events[0]?.metadata).toMatchObject({ customerEmailMatchesOrder: false });
    expect(JSON.stringify(events[0]?.metadata)).not.toContain("someone-else@example.com");
  });

  it("converts amounts exactly or not at all", () => {
    expect(decimalStringToMinor("28.58", "USD")).toBe(2858);
    expect(decimalStringToMinor("28.580", "USD")).toBe(2858);
    expect(decimalStringToMinor("28.585", "USD")).toBeNull();
    expect(decimalStringToMinor("100", "JPY")).toBe(100);
    expect(decimalNumberToMinor(10.43, "USD")).toBe(1043);
    expect(decimalNumberToMinor(10.431, "USD")).toBeNull();
  });
});
