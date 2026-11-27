/** Live email readiness (Resend) and the Apple Pay domain-association route. */
import { afterEach, describe, expect, it } from "vitest";
import { liveEmailProblems } from "@/lib/config";
import { GET } from "@/app/api/apple-pay-domain-association/route";

describe("live email readiness", () => {
  const ready = {
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "re_synthetic_key_123",
    EMAIL_FROM: "ESIMPROVE Support <support@esimprove.com>",
  } as unknown as NodeJS.ProcessEnv;

  it("accepts a complete Resend configuration (no longer blocks the site)", () => {
    expect(liveEmailProblems(ready)).toEqual([]);
  });

  it("names each missing setting without printing values", () => {
    const problems = liveEmailProblems({} as NodeJS.ProcessEnv).join(" ");
    expect(problems).toMatch(/EMAIL_PROVIDER=resend/);
    expect(problems).toMatch(/RESEND_API_KEY/);
    expect(problems).toMatch(/EMAIL_FROM/);
    const wrongKey = liveEmailProblems({ ...ready, RESEND_API_KEY: "sk_live_wrong" } as NodeJS.ProcessEnv);
    expect(wrongKey.join(" ")).not.toContain("sk_live_wrong");
  });
});

describe("Apple Pay domain association file", () => {
  const saved = process.env.APPLE_PAY_DOMAIN_ASSOCIATION;
  afterEach(() => {
    if (saved === undefined) delete process.env.APPLE_PAY_DOMAIN_ASSOCIATION;
    else process.env.APPLE_PAY_DOMAIN_ASSOCIATION = saved;
  });

  it("returns 404 until the content from Whop is configured", async () => {
    delete process.env.APPLE_PAY_DOMAIN_ASSOCIATION;
    expect(GET().status).toBe(404);
  });

  it("serves the configured content as plain text", async () => {
    process.env.APPLE_PAY_DOMAIN_ASSOCIATION = "7B2270737049...";
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe("7B2270737049...");
  });
});

describe("health readiness summary", () => {
  it("reports payment, wallet, email and supplier readiness without any secret value", async () => {
    const saved = { ...process.env };
    try {
      process.env.PAYMENT_PROVIDER = "whop";
      process.env.WHOP_SANDBOX = "true";
      process.env.WHOP_SANDBOX_API_KEY = "apik_secret_value_should_not_leak";
      process.env.WHOP_SANDBOX_WEBHOOK_SECRET = "ws_secret_value_should_not_leak";
      process.env.EMAIL_LIVE_ENABLED = "true";
      process.env.RESEND_API_KEY = "re_secret_value_should_not_leak";
      const { paymentReadiness } = await import("@/lib/payment-readiness");
      const report = paymentReadiness();
      const json = JSON.stringify(report);
      expect(json).not.toMatch(/should_not_leak/);
      expect(report.webhook.secretConfigured).toBe(true);
      expect(report.applePay.requestedFromWhop).toBe(true);
      expect(report.googlePay.requestedFromWhop).toBe(true);
      // Feature flags are read once at module load, so only the shape is checked here.
      expect(report).toHaveProperty("email");
      expect(report).toHaveProperty("supplier");
      expect(report).toHaveProperty("usdt");
    } finally {
      process.env = saved;
    }
  });
});
