/**
 * Dynamic Whop checkout creation, tested against a FAKE Whop SDK.
 *
 * `@whop/sdk` is replaced with an in-memory stub, so no request can reach
 * Whop. The API key and IDs are synthetic placeholders.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ body: Record<string, unknown>; options: Record<string, unknown> }> = [];
let nextResponse: unknown = null;
let nextError: unknown = null;

vi.mock("@whop/sdk", () => {
  class WhopClient {
    checkoutConfigurations = {
      create: async (body: Record<string, unknown>, options: Record<string, unknown>) => {
        calls.push({ body, options });
        if (nextError) throw nextError;
        return nextResponse;
      },
    };
  }
  return {
    WhopClient,
    WhopEnvironment: { Production: "https://production.invalid", Sandbox: "https://sandbox.invalid" },
  };
});

import { cardAvailability, createWhopCheckout } from "@/lib/integrations/payment/whop";
import { PaymentUnavailableError } from "@/lib/integrations/payments/types";

const FAKE_ENV = {
  WHOP_COMPANY_API_KEY: "apik_synthetic_not_real",
  WHOP_SANDBOX: "true",
  WHOP_PRODUCT_ID: "prod_synthetic01",
  WHOP_ACCOUNT_ID: "biz_synthetic01",
  WHOP_PLAN_VARIANT_MAP: "{}",
};

const input = {
  orderId: "order_synthetic01",
  orderNumber: "ESP-0001",
  paymentId: "pay_synthetic01",
  amountMinor: 2858,
  currency: "USD",
  customerEmail: "traveler@example.com",
  returnUrl: "https://esimprove.example/checkout/success?order=ESP-0001",
  taxMinor: 0,
  items: [
    {
      planId: "plan_local_1",
      planSlug: "japan-5gb-30d",
      planName: "Japan 5 GB / 30 days",
      quantity: 1,
      unitPriceMinor: 2858,
    },
  ],
};

function response(overrides: Record<string, unknown> = {}, variant: Record<string, unknown> = {}) {
  return {
    id: "ch_synthetic01",
    purchase_url: "https://whop.com/checkout/ch_synthetic01",
    effective_payment_method_configuration: {
      enabled: ["card"],
      disabled: [],
      include_platform_defaults: true,
    },
    variant: {
      id: "plan_inline01",
      initial_price: 28.58,
      currency: "usd",
      billing_type: "one_time",
      ...variant,
    },
    ...overrides,
  };
}

describe("dynamic Whop checkout (fake SDK)", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    calls.length = 0;
    nextError = null;
    nextResponse = response();
    for (const [key, value] of Object.entries(FAKE_ENV)) {
      saved[key] = process.env[key];
      process.env[key] = value;
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("creates one checkout per order priced exactly at the order total", async () => {
    const session = await createWhopCheckout(input);
    expect(session).toEqual({
      providerPaymentId: "ch_synthetic01",
      checkoutUrl: "https://whop.com/checkout/ch_synthetic01",
    });
    expect(calls).toHaveLength(1);
    const { body, options } = calls[0]!;
    expect(body).toMatchObject({
      account_id: "biz_synthetic01",
      redirect_url: input.returnUrl,
      variant: {
        product_id: "prod_synthetic01",
        billing_type: "one_time",
        initial_price: 28.58,
        currency: "usd",
        visibility: "hidden",
        force_create_new_plan: false,
      },
      metadata: {
        esimprove_order_id: "order_synthetic01",
        esimprove_payment_id: "pay_synthetic01",
        esimprove_order_number: "ESP-0001",
      },
    });
    expect(body).not.toHaveProperty("variant_id");
    expect(options).toEqual({ idempotencyKey: "esimprove_checkout_pay_synthetic01" });
  });

  it("explicitly requests card on top of Whop's platform defaults", async () => {
    await createWhopCheckout(input);
    expect(calls[0]!.body).toMatchObject({
      payment_method_configuration: { enabled: ["card"], disabled: ["crypto"], include_platform_defaults: true },
    });
  });

  it("refuses to redirect when Whop resolves the checkout without card", async () => {
    nextResponse = response({
      effective_payment_method_configuration: { enabled: [], disabled: ["card"], include_platform_defaults: true },
    });
    await expect(createWhopCheckout(input)).rejects.toThrow(/Card payments are not available/);

    nextResponse = response({
      effective_payment_method_configuration: { enabled: ["paypal"], include_platform_defaults: false },
    });
    await expect(createWhopCheckout(input)).rejects.toThrow(/Card payments are not available/);
  });

  it("still redirects when card availability is only unconfirmed", async () => {
    nextResponse = response({ effective_payment_method_configuration: null });
    await expect(createWhopCheckout(input)).resolves.toMatchObject({
      checkoutUrl: "https://whop.com/checkout/ch_synthetic01",
    });
  });

  it("classifies card availability from the effective configuration", () => {
    expect(cardAvailability({ enabled: ["card"] })).toBe("available");
    expect(cardAvailability({ enabled: ["card"], disabled: ["card"] })).toBe("disabled");
    expect(cardAvailability({ include_platform_defaults: false })).toBe("disabled");
    expect(cardAvailability({ include_platform_defaults: true })).toBe("unconfirmed");
    expect(cardAvailability(null)).toBe("unconfirmed");
  });

  it("uses no static per-plan link when a product is configured", async () => {
    process.env.WHOP_PLAN_VARIANT_MAP = JSON.stringify({ "japan-5gb-30d": "plan_static01" });
    await createWhopCheckout(input);
    expect(calls[0]!.body).toHaveProperty("variant.product_id", "prod_synthetic01");
    expect(calls[0]!.body).not.toHaveProperty("variant_id");
  });

  it("falls back to an explicit variant only when no product is configured", async () => {
    delete process.env.WHOP_PRODUCT_ID;
    process.env.WHOP_PLAN_VARIANT_MAP = JSON.stringify({ "japan-5gb-30d": "plan_static01" });
    nextResponse = response({}, { id: "plan_static01" });
    await createWhopCheckout(input);
    expect(calls[0]!.body).toMatchObject({ variant_id: "plan_static01" });
  });

  it("refuses when neither a product nor a variant is configured", async () => {
    delete process.env.WHOP_PRODUCT_ID;
    await expect(createWhopCheckout(input)).rejects.toThrow(/WHOP_PRODUCT_ID/);
    expect(calls).toHaveLength(0);
  });

  it("rejects a checkout whose returned price or currency differs", async () => {
    nextResponse = response({}, { initial_price: 25 });
    await expect(createWhopCheckout(input)).rejects.toThrow(/does not match/);
    nextResponse = response({}, { currency: "eur" });
    await expect(createWhopCheckout(input)).rejects.toThrow(/does not match/);
    nextResponse = response({}, { billing_type: "renewal" });
    await expect(createWhopCheckout(input)).rejects.toThrow(/does not match/);
  });

  it("never redirects to a non-Whop URL", async () => {
    nextResponse = response({ purchase_url: "https://evil.example/pay" });
    await expect(createWhopCheckout(input)).rejects.toThrow(/valid checkout URL/);
    nextResponse = response({ purchase_url: "http://whop.com/checkout/x" });
    await expect(createWhopCheckout(input)).rejects.toThrow(/valid checkout URL/);
  });

  it("turns provider errors into a safe message without the API key", async () => {
    nextError = Object.assign(new Error("403 apik_synthetic_not_real forbidden"), { statusCode: 403 });
    const error = await createWhopCheckout(input).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PaymentUnavailableError);
    expect(String((error as Error).message)).not.toContain("apik_");
  });

  it("rejects orders it cannot price exactly before calling Whop", async () => {
    await expect(createWhopCheckout({ ...input, taxMinor: 100 })).rejects.toThrow(/tax/);
    await expect(createWhopCheckout({ ...input, amountMinor: 3000 })).rejects.toThrow(
      /does not match the selected plan/,
    );
    await expect(
      createWhopCheckout({ ...input, items: [...input.items, ...input.items] }),
    ).rejects.toThrow(/does not match the selected plan/);
    await expect(
      createWhopCheckout({ ...input, items: [{ ...input.items[0]!, quantity: 0 }] }),
    ).rejects.toThrow(/invalid quantity/);
    expect(calls).toHaveLength(0);
  });

  it("prices a multi-plan order as one dynamic checkout at the exact total", async () => {
    nextResponse = response({}, { initial_price: 57.16 });
    await createWhopCheckout({
      ...input,
      amountMinor: 5716,
      items: [{ ...input.items[0]!, quantity: 2 }],
    });
    expect(calls[0]!.body).toMatchObject({
      variant: { initial_price: 57.16, title: "ESIMPROVE eSIM order", product_id: "prod_synthetic01" },
    });
  });

  it("keeps the one-plan limit for fixed per-plan variants", async () => {
    delete process.env.WHOP_PRODUCT_ID;
    process.env.WHOP_PLAN_VARIANT_MAP = JSON.stringify({ "japan-5gb-30d": "plan_static01" });
    await expect(
      createWhopCheckout({ ...input, amountMinor: 5716, items: [{ ...input.items[0]!, quantity: 2 }] }),
    ).rejects.toThrow(/needs WHOP_PRODUCT_ID/);
    expect(calls).toHaveLength(0);
  });
});
