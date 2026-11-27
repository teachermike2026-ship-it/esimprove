/**
 * Whop adapter additions (embedded checkout metadata, refunds, CSP), tested
 * against a FAKE `@whop/sdk`. Nothing here can reach Whop; keys are synthetic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const checkoutCalls: Array<{ body: Record<string, unknown>; options: Record<string, unknown> }> = [];
const refundCalls: Array<{ body: Record<string, unknown>; options: Record<string, unknown> }> = [];
const clientEnvironments: string[] = [];

vi.mock("@whop/sdk", () => {
  class WhopClient {
    constructor(options: { environment: string }) {
      clientEnvironments.push(options.environment);
    }
    checkoutConfigurations = {
      create: async (body: Record<string, unknown>, options: Record<string, unknown>) => {
        checkoutCalls.push({ body, options });
        return {
          id: "ch_synthetic01",
          purchase_url: "https://sandbox.whop.com/checkout/ch_synthetic01",
          effective_payment_method_configuration: { enabled: ["card"], disabled: [], include_platform_defaults: true },
          variant: { id: "plan_inline01", initial_price: 28.58, currency: "usd", billing_type: "one_time" },
        };
      },
    };
    payments = {
      refund: async (body: Record<string, unknown>, options: Record<string, unknown>) => {
        refundCalls.push({ body, options });
        return { id: body.id, status: "paid", substatus: "refunded" };
      },
    };
  }
  return {
    WhopClient,
    WhopEnvironment: { Production: "https://production.invalid", Sandbox: "https://sandbox.invalid" },
  };
});

import { createWhopCheckout, getWhopRuntimeConfig, refundWhopPayment } from "@/lib/integrations/payment/whop";
import { PaymentUnavailableError } from "@/lib/integrations/payments/types";
import { WhopPaymentProvider } from "@/lib/integrations/payments/whop";
import { buildContentSecurityPolicy, WHOP_ELEMENTS_CSP } from "@/lib/security-headers";
import { contentSecurityPolicy } from "@whop/elements";

const ENV_KEYS = [
  "WHOP_API_KEY",
  "WHOP_COMPANY_ID",
  "WHOP_COMPANY_API_KEY",
  "WHOP_ACCOUNT_ID",
  "WHOP_SANDBOX",
  "WHOP_PRODUCT_ID",
  "WHOP_PLAN_VARIANT_MAP",
  "PAYMENTS_LIVE_ENABLED",
];

const input = {
  orderId: "order_synthetic01",
  orderNumber: "ESP-0001",
  paymentId: "pay_synthetic01",
  amountMinor: 2858,
  currency: "USD",
  customerEmail: "traveler@example.com",
  returnUrl: "http://localhost:3000/checkout/success?order=ESP-0001",
  taxMinor: 0,
  items: [{ planId: "plan_local_1", planSlug: "japan-5gb-30d", planName: "Japan 5 GB / 30 days", quantity: 1, unitPriceMinor: 2858 }],
};

describe("Whop sandbox adapter (fake SDK)", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    checkoutCalls.length = 0;
    refundCalls.length = 0;
    clientEnvironments.length = 0;
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.WHOP_API_KEY = "apik_synthetic_sandbox_key";
    process.env.WHOP_COMPANY_ID = "biz_synthetic01";
    process.env.WHOP_SANDBOX = "true";
    process.env.WHOP_PRODUCT_ID = "prod_synthetic01";
    process.env.WHOP_PLAN_VARIANT_MAP = "{}";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("reads WHOP_API_KEY / WHOP_COMPANY_ID and keeps the legacy names as fallbacks", () => {
    expect(getWhopRuntimeConfig()).toMatchObject({ apiKey: "apik_synthetic_sandbox_key", accountId: "biz_synthetic01", sandbox: true });
    delete process.env.WHOP_API_KEY;
    delete process.env.WHOP_COMPANY_ID;
    process.env.WHOP_COMPANY_API_KEY = "apik_legacy";
    process.env.WHOP_ACCOUNT_ID = "biz_legacy";
    expect(getWhopRuntimeConfig()).toMatchObject({ apiKey: "apik_legacy", accountId: "biz_legacy" });
  });

  it("creates a sandbox checkout with an inline one-time plan, order metadata and an idempotency key", async () => {
    const session = await createWhopCheckout(input);
    expect(session.providerPaymentId).toBe("ch_synthetic01");
    expect(clientEnvironments).toEqual(["https://sandbox.invalid"]);
    const call = checkoutCalls[0]!;
    expect(call.options).toEqual({ idempotencyKey: "esimprove_checkout_pay_synthetic01" });
    expect(call.body.account_id).toBe("biz_synthetic01");
    expect(call.body.variant).toMatchObject({
      product_id: "prod_synthetic01",
      billing_type: "one_time",
      initial_price: 28.58,
      currency: "usd",
    });
    expect(call.body.metadata).toMatchObject({ orderId: "order_synthetic01", planId: "plan_local_1" });
    // No crypto wording or customer data in the product, plan or metadata...
    const { payment_method_configuration: methods, ...described } = call.body;
    expect(JSON.stringify(described)).not.toMatch(/crypto|usdt|bep-?20|traveler@example\.com/i);
    // ...and Whop's own crypto method is switched off: crypto is a separate gate.
    expect(methods).toEqual({ enabled: ["card"], disabled: ["crypto"], include_platform_defaults: true });
  });

  it("refunds a confirmed sandbox payment once per payment through the SDK", async () => {
    const provider = new WhopPaymentProvider();
    const result = await provider.refundPayment({
      providerPaymentId: "pay_synthetic99",
      idempotencyKey: "esimprove_refund_pay_local1",
      metadata: { orderId: "order_synthetic01" },
    });
    expect(result.providerStatus).toBe("refunded");
    expect(refundCalls).toEqual([
      {
        body: { id: "pay_synthetic99", metadata: { orderId: "order_synthetic01" } },
        options: { idempotencyKey: "esimprove_refund_pay_local1" },
      },
    ]);
  });

  it("refuses to refund a checkout reference or a live payment while live payments are off", async () => {
    await expect(
      refundWhopPayment({ providerPaymentId: "ch_synthetic01", idempotencyKey: "k", metadata: {} }),
    ).rejects.toBeInstanceOf(PaymentUnavailableError);
    process.env.WHOP_SANDBOX = "false";
    await expect(
      refundWhopPayment({ providerPaymentId: "pay_synthetic99", idempotencyKey: "k", metadata: {} }),
    ).rejects.toThrow(/Live Whop refunds are disabled/);
    expect(refundCalls).toHaveLength(0);
  });
});

describe("Whop Elements content security policy", () => {
  it("matches the sources published by @whop/elements", () => {
    for (const environment of ["sandbox", "production"] as const) {
      const expected = contentSecurityPolicy({ environment, wallets: false, bankConnections: false }).directives;
      expect([...WHOP_ELEMENTS_CSP[environment].frame]).toEqual([...expected["frame-src"]]);
      expect([...WHOP_ELEMENTS_CSP[environment].script]).toEqual([...expected["script-src"]]);
      expect([...WHOP_ELEMENTS_CSP[environment].connect]).toEqual([...expected["connect-src"]]);
    }
  });

  it("allows Whop only when asked, and only the sandbox API in sandbox", () => {
    const normal = buildContentSecurityPolicy({ nonce: "abc" });
    expect(normal).toContain("frame-src 'none'");
    expect(normal).not.toContain("whop");
    const sandbox = buildContentSecurityPolicy({ nonce: "abc", whopElements: "sandbox" });
    expect(sandbox).toContain("frame-src https://cdn.whop.com");
    expect(sandbox).toContain("https://sandbox-api.whop.com");
    expect(sandbox).not.toContain("https://api.whop.com");
  });
});

describe("sandbox and live credential separation", () => {
  const env = (extra: Record<string, string>) => ({
    WHOP_API_KEY: "apik_live_key",
    WHOP_COMPANY_ID: "biz_live",
    WHOP_PRODUCT_ID: "prod_live",
    WHOP_WEBHOOK_SECRET: "ws_live",
    WHOP_SANDBOX_API_KEY: "apik_sandbox_key",
    WHOP_SANDBOX_COMPANY_ID: "biz_sandbox",
    WHOP_SANDBOX_PRODUCT_ID: "prod_sandbox",
    WHOP_SANDBOX_WEBHOOK_SECRET: "ws_sandbox",
    ...extra,
  }) as unknown as NodeJS.ProcessEnv;

  it("uses only the WHOP_SANDBOX_* values in sandbox mode", async () => {
    const { whopCredentials } = await import("@/lib/config");
    const c = whopCredentials(env({ WHOP_SANDBOX: "true" }));
    expect(c).toMatchObject({ apiKey: "apik_sandbox_key", companyId: "biz_sandbox", productId: "prod_sandbox", webhookSecret: "ws_sandbox" });
    expect(Object.values(c.sources)).toEqual(["sandbox-vars", "sandbox-vars", "sandbox-vars", "sandbox-vars"]);
  });

  it("never reads WHOP_SANDBOX_* values in live mode", async () => {
    const { whopCredentials } = await import("@/lib/config");
    const c = whopCredentials(env({ WHOP_SANDBOX: "false" }));
    expect(c).toMatchObject({ apiKey: "apik_live_key", companyId: "biz_live", productId: "prod_live", webhookSecret: "ws_live" });
    expect(Object.values(c.sources)).toEqual(["standard-vars", "standard-vars", "standard-vars", "standard-vars"]);
  });
});
