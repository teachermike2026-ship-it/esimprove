import { describe, expect, it } from "vitest";
import { MockSupplierAdapter } from "@/lib/integrations/supplier/mock";
import { DisabledLiveSupplierAdapter } from "@/lib/integrations/supplier/disabled";
import { DisabledStripePaymentProvider } from "@/lib/integrations/payments/disabled";
import { DisabledLiveEmailTransport } from "@/lib/integrations/email/disabled";
import { IntegrationDisabledError } from "@/lib/integrations/supplier/types";
import { MockPaymentProvider, signMockWebhook, signedMockWebhook } from "@/lib/integrations/payments/mock";

const input = {
  transactionId: "tx-demo-001",
  productId: "demo-product-japan-1gb-7d",
  planName: "Japan 1 GB · 7 days",
  customerEmail: "demo@example.com",
  quantity: 1,
};

describe("mock supplier adapter", () => {
  it("is deterministic for the same transaction and product", async () => {
    const adapter = new MockSupplierAdapter();
    const first = await adapter.createOrder(input);
    const second = await adapter.createOrder(input);
    expect(first.supplierOrderId).toMatch(/^mock_ord_/);
    expect(first.esims.length).toBe(1);
    expect(first.esims[0]?.iccid).toMatch(/^89\d{18}$/);
    expect(first.esims[0]?.lpa).toContain("rsp.demo.invalid");
    expect(first.supplierOrderId).toBe(second.supplierOrderId);
    expect(first.esims[0]?.iccid).toBe(second.esims[0]?.iccid);
    expect(first.esims[0]?.lpa).toBe(second.esims[0]?.lpa);
    expect(String(first.raw?.label)).toContain("MOCK SUPPLIER");
  });

  it("can retrieve the same order and eSIMs after creation", async () => {
    const adapter = new MockSupplierAdapter();
    const created = await adapter.createOrder(input);
    const retrieved = await adapter.getOrder(created.supplierOrderId);
    expect(retrieved.supplierOrderId).toBe(created.supplierOrderId);
    expect(retrieved.esims[0]?.iccid).toBe(created.esims[0]?.iccid);
    const esims = await adapter.getEsims(created.supplierOrderId);
    expect(esims).toHaveLength(1);
    expect(esims[0]?.lpa).toBe(created.esims[0]?.lpa);
  });

  it("varies output for different transactions and rejects bad input", async () => {
    const adapter = new MockSupplierAdapter();
    const first = await adapter.createOrder(input);
    const second = await adapter.createOrder({ ...input, transactionId: "tx-demo-002" });
    expect(first.supplierOrderId).not.toBe(second.supplierOrderId);
    expect(first.esims[0]?.iccid).not.toBe(second.esims[0]?.iccid);
    await expect(adapter.createOrder({ ...input, transactionId: "" })).rejects.toThrow();
    await expect(adapter.createOrder({ ...input, productId: "" })).rejects.toThrow();
    await expect(adapter.getOrder("not-a-mock-order")).rejects.toThrow("Unknown mock supplier order");
  });

  it("can simulate one transient failure", async () => {
    const adapter = new MockSupplierAdapter({ failFirstAttempt: true });
    await expect(adapter.createOrder(input)).rejects.toThrow("MOCK_SUPPLIER_FAIL_ONCE");
    const second = await adapter.createOrder(input);
    expect(second.esims.length).toBe(1);
  });

  it("reports mock health without a network call", async () => {
    const adapter = new MockSupplierAdapter();
    const health = await adapter.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.message).toContain("No network");
    expect(adapter.isMock).toBe(true);
    expect(adapter.mode).toBe("sandbox");
  });
});

describe("disabled live adapters", () => {
  it("blocks live supplier operations", async () => {
    const adapter = new DisabledLiveSupplierAdapter();
    expect(adapter.isMock).toBe(false);
    await expect(adapter.createOrder(input)).rejects.toBeInstanceOf(IntegrationDisabledError);
    await expect(adapter.getOrder("any")).rejects.toBeInstanceOf(IntegrationDisabledError);
    await expect(adapter.getEsims("any")).rejects.toBeInstanceOf(IntegrationDisabledError);
    expect((await adapter.healthCheck()).ok).toBe(false);
  });

  it("blocks live payment and email operations", async () => {
    const payments = new DisabledStripePaymentProvider();
    expect(payments.isMock).toBe(false);
    await expect(
      payments.createCheckout({
        orderId: "order",
        orderNumber: "ES-1",
        amountMinor: 100,
        currency: "USD",
        customerEmail: "demo@example.com",
        returnUrl: "http://localhost:3000/checkout/success",
      }),
    ).rejects.toBeInstanceOf(IntegrationDisabledError);
    expect(() => payments.verifyWebhook("{}", "sig")).toThrow(IntegrationDisabledError);

    const email = new DisabledLiveEmailTransport();
    expect(email.isMock).toBe(false);
    await expect(
      email.send({
        to: "demo@example.com",
        subject: "Demo",
        text: "No real email",
        template: "test",
      }),
    ).rejects.toBeInstanceOf(IntegrationDisabledError);
  });
});

describe("mock payment signatures", () => {
  it("verifies a correctly signed event", () => {
    const provider = new MockPaymentProvider();
    const event = {
      eventId: "evt_demo",
      type: "payment.succeeded" as const,
      paymentId: "mock_pay_demo",
      orderId: "order_demo",
      amountMinor: 1234,
      currency: "USD",
      createdAt: new Date().toISOString(),
    };
    const signed = signedMockWebhook(event);
    const verified = provider.verifyWebhook(signed.rawBody, signed.signature);
    expect(verified.eventId).toBe(event.eventId);
    expect(verified.type).toBe("payment.succeeded");
    expect(provider.isMock).toBe(true);
  });

  it("rejects missing and invalid signatures", () => {
    const provider = new MockPaymentProvider();
    expect(() => provider.verifyWebhook("{}", null)).toThrow("Missing mock webhook signature");
    expect(() => provider.verifyWebhook("{}", "bad")).toThrow("Invalid mock webhook signature");
  });

  it("rejects malformed payloads even with a valid signature", () => {
    const provider = new MockPaymentProvider();
    const raw = JSON.stringify({ eventId: "evt_only" });
    const signature = signMockWebhook(raw);
    expect(() => provider.verifyWebhook(raw, signature)).toThrow("Invalid mock webhook payload");
    const invalidJson = "{not-json";
    const invalidSignature = signMockWebhook(invalidJson);
    expect(() => provider.verifyWebhook(invalidJson, invalidSignature)).toThrow();
  });
});
