import { afterEach, describe, expect, it, vi } from "vitest";

const SAFE_ENV: Record<string, string> = {
  NETLIFY: "true",
  APP_ENV: "production",
  DEMO_MODE: "false",
  SEED_DEMO_DATA: "false",
  SITE_URL: "https://shop.example.test",
  DATABASE_URL: "postgres://demo:demo@db.example.test:5432/demo",
  AUTH_SECRET: "a-production-auth-secret-that-is-long-enough",
  ACTIVATION_KEK_V1: Buffer.alloc(32, 9).toString("base64"),
  ACTIVATION_KEK_ACTIVE_VERSION: "1",
  MOCK_PAYMENT_WEBHOOK_SECRET: "production-webhook-secret",
  INTERNAL_JOB_SECRET: "production-internal-job-secret",
  RATE_LIMIT_HASH_SECRET: "production-rate-limit-secret",
  ADMIN_2FA_REQUIRED: "true",
  PAYMENTS_LIVE_ENABLED: "false",
  SUPPLIER_LIVE_ENABLED: "false",
  EMAIL_LIVE_ENABLED: "false",
  CATALOGUE_SYNC_ENABLED: "false",
  ANALYTICS_ENABLED: "false",
  STAGING_ACCESS_ENABLED: "false",
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

  it("fails closed on Netlify with demo defaults", async () => {
    stub({
      APP_ENV: "local",
      DEMO_MODE: "true",
      SEED_DEMO_DATA: "true",
      SITE_URL: "http://localhost:3000",
    });
    const { assertProductionSafe } = await import("@/lib/config");
    expect(() => assertProductionSafe()).toThrow(/Unsafe production configuration/);
  });

  it("accepts a complete production configuration without live flags", async () => {
    stub();
    const { assertProductionSafe, isProduction } = await import("@/lib/config");
    expect(isProduction).toBe(true);
    expect(() => assertProductionSafe()).not.toThrow();
  });

  it("rejects a live flag that is not implemented", async () => {
    stub({ PAYMENTS_LIVE_ENABLED: "true" });
    const { assertProductionSafe } = await import("@/lib/config");
    expect(() => assertProductionSafe()).toThrow(/PAYMENTS_LIVE_ENABLED/);
  });

  it("rejects an insecure public origin", async () => {
    stub({ SITE_URL: "http://shop.example.test" });
    const { assertProductionSafe } = await import("@/lib/config");
    expect(() => assertProductionSafe()).toThrow(/HTTPS public origin/);
  });
});
