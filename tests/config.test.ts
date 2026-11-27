import { afterEach, describe, expect, it, vi } from "vitest";

const SAFE_ENV: Record<string, string> = {
  NETLIFY: "true",
  APP_ENV: "production",
  DATABASE_ENV: "production",
  DEMO_MODE: "false",
  SEED_DEMO_DATA: "false",
  SITE_URL: "https://shop.example.test",
  DATABASE_URL: "postgres://demo:demo@db.example.test:5432/demo",
  DATABASE_SSL: "require",
  DATABASE_POOL_MAX: "3",
  AUTH_SECRET: "a-production-auth-secret-that-is-long-enough",
  ACTIVATION_KEK_V1: Buffer.alloc(32, 9).toString("base64"),
  ACTIVATION_KEK_ACTIVE_VERSION: "1",
  SUPPLIER_CREDENTIAL_KEK: Buffer.alloc(32, 5).toString("base64"),
  SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK: "false",
  MOCK_PAYMENT_WEBHOOK_SECRET: "production-webhook-secret",
  INTERNAL_JOB_SECRET: "production-internal-job-secret",
  RATE_LIMIT_HASH_SECRET: "production-rate-limit-secret",
  ANALYTICS_HASH_SECRET: "production-analytics-hash-secret-distinct",
  ADMIN_2FA_REQUIRED: "true",
  PAYMENTS_LIVE_ENABLED: "false",
  SUPPLIER_LIVE_ENABLED: "false",
  EMAIL_LIVE_ENABLED: "false",
  CATALOGUE_SYNC_ENABLED: "false",
  ANALYTICS_ENABLED: "false",
  STAGING_ACCESS_ENABLED: "false",
};

const PREVIEW_ENV: Record<string, string> = {
  ...SAFE_ENV,
  APP_ENV: "preview",
  DATABASE_ENV: "preview",
  DEMO_MODE: "true",
  SEED_DEMO_DATA: "true",
  SITE_URL: "https://deploy-preview--esimprove.netlify.app",
  MOCK_PAYMENT_WEBHOOK_SECRET: "preview-webhook-secret",
};

function stub(overrides: Record<string, string> = {}): void {
  for (const [key, value] of Object.entries({ ...SAFE_ENV, ...overrides })) {
    vi.stubEnv(key, value);
  }
}

describe("production configuration safety", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("fails closed when a Netlify deploy does not declare its context", async () => {
    stub({
      APP_ENV: "local",
      DATABASE_ENV: "local",
      DEMO_MODE: "true",
      SEED_DEMO_DATA: "true",
      SITE_URL: "http://localhost:3000",
    });
    const { assertProductionSafe } = await import("@/lib/config");
    expect(() => assertProductionSafe()).toThrow(/APP_ENV must be set explicitly/);
  });

  it("accepts a complete production configuration without live flags", async () => {
    stub();
    const { assertProductionSafe, isProduction, mockCommerceAllowed } = await import(
      "@/lib/config"
    );
    expect(isProduction).toBe(true);
    expect(mockCommerceAllowed).toBe(false);
    expect(() => assertProductionSafe()).not.toThrow();
  });

  it("accepts a safe demo preview deploy", async () => {
    stub(PREVIEW_ENV);
    const { assertProductionSafe, isPreview, isProduction, mockCommerceAllowed, noIndex } =
      await import("@/lib/config");
    expect(isPreview).toBe(true);
    expect(isProduction).toBe(false);
    expect(mockCommerceAllowed).toBe(true);
    expect(noIndex).toBe(true);
    expect(() => assertProductionSafe()).not.toThrow();
  });

  it("rejects a live flag that is not implemented", async () => {
    stub({ PAYMENTS_LIVE_ENABLED: "true" });
    const { assertProductionSafe } = await import("@/lib/config");
    expect(() => assertProductionSafe()).toThrow(/PAYMENTS_LIVE_ENABLED/);
  });

  const WHOP_LIVE = {
    PAYMENT_PROVIDER: "whop",
    PAYMENTS_LIVE_ENABLED: "true",
    WHOP_COMPANY_API_KEY: "apik_synthetic_not_real",
    WHOP_WEBHOOK_SECRET: "ws_synthetic_not_real",
    WHOP_SANDBOX: "false",
    WHOP_PRODUCT_ID: "prod_synthetic01",
    APP_URL: "https://shop.example.test",
  };

  it("accepts a complete live Whop production configuration", async () => {
    stub(WHOP_LIVE);
    const { assertProductionSafe, onlineCheckoutAvailable } = await import("@/lib/config");
    expect(() => assertProductionSafe()).not.toThrow();
    expect(onlineCheckoutAvailable()).toBe(true);
  });

  it("rejects live Whop without the live gate, product, or webhook secret", async () => {
    stub({ ...WHOP_LIVE, PAYMENTS_LIVE_ENABLED: "false" });
    let config = await import("@/lib/config");
    expect(() => config.assertProductionSafe()).toThrow(/requires PAYMENTS_LIVE_ENABLED=true/);
    vi.unstubAllEnvs();
    vi.resetModules();

    stub({ ...WHOP_LIVE, WHOP_PRODUCT_ID: "not-a-product" });
    config = await import("@/lib/config");
    expect(() => config.assertProductionSafe()).toThrow(/WHOP_PRODUCT_ID must be a Whop product ID/);
    vi.unstubAllEnvs();
    vi.resetModules();

    stub({ ...WHOP_LIVE, WHOP_WEBHOOK_SECRET: "" });
    config = await import("@/lib/config");
    expect(() => config.assertProductionSafe()).toThrow(/WHOP_WEBHOOK_SECRET is required/);
  });

  it("rejects an insecure public origin", async () => {
    stub({ SITE_URL: "http://shop.example.test" });
    const { assertProductionSafe } = await import("@/lib/config");
    expect(() => assertProductionSafe()).toThrow(/HTTPS public origin/);
  });

  it("rejects a preview deploy pointed at a production database context", async () => {
    stub({ ...PREVIEW_ENV, DATABASE_ENV: "production" });
    const { assertProductionSafe } = await import("@/lib/config");
    expect(() => assertProductionSafe()).toThrow(/DATABASE_ENV \(production\) must match APP_ENV/);
  });

  it("rejects demo mode in production", async () => {
    stub({ DEMO_MODE: "true" });
    const { assertProductionSafe } = await import("@/lib/config");
    expect(() => assertProductionSafe()).toThrow(/DEMO_MODE must be false in production/);
  });

  it("rejects disabled TLS for a deployed database", async () => {
    stub({ DATABASE_SSL: "disable" });
    const { assertProductionSafe } = await import("@/lib/config");
    expect(() => assertProductionSafe()).toThrow(/DATABASE_SSL must not be disabled/);
  });

  it("rejects the activation KEK fallback for supplier credentials in production", async () => {
    stub({ SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK: "true" });
    const { assertProductionSafe } = await import("@/lib/config");
    expect(() => assertProductionSafe()).toThrow(/must be false in production/);
  });

  it("requires a dedicated analytics hash secret in a deployed environment", async () => {
    stub({ ANALYTICS_HASH_SECRET: "" });
    const { analyticsHashSecret, assertProductionSafe } = await import("@/lib/config");
    expect(() => analyticsHashSecret()).toThrow(/ANALYTICS_HASH_SECRET must be at least 32 characters/);
    expect(() => assertProductionSafe()).toThrow(/ANALYTICS_HASH_SECRET/);
  });

  it("rejects an analytics hash secret that reuses the rate limit or auth secret", async () => {
    stub({
      ANALYTICS_HASH_SECRET: "production-rate-limit-secret-0123456789",
      RATE_LIMIT_HASH_SECRET: "production-rate-limit-secret-0123456789",
    });
    const { assertProductionSafe } = await import("@/lib/config");
    expect(() => assertProductionSafe()).toThrow(/distinct from RATE_LIMIT_HASH_SECRET/);

    stub({ ANALYTICS_HASH_SECRET: "a-production-auth-secret-that-is-long-enough" });
    const { assertProductionSafe: assertSafeAgain } = await import("@/lib/config");
    expect(() => assertSafeAgain()).toThrow(/distinct from AUTH_SECRET/);
  });
});
