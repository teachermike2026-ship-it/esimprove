const DEFAULT_SITE_URL = "http://localhost:3000";

function envFlag(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() === "true" || value === "1";
}

export const appEnv = process.env.APP_ENV ?? "local";
// Netlify sets NETLIFY=true in every build/runtime. Treat it as production so a
// missing APP_ENV cannot silently run a deployed demo configuration.
export const isProduction = appEnv === "production" || Boolean(process.env.NETLIFY);
export const demoMode = process.env.DEMO_MODE !== "false";
export const seedDemoData = process.env.SEED_DEMO_DATA !== "false";

export const siteUrl = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
export const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "eSIMprove";

export const flags = {
  paymentsLive: envFlag("PAYMENTS_LIVE_ENABLED"),
  supplierLive: envFlag("SUPPLIER_LIVE_ENABLED"),
  emailLive: envFlag("EMAIL_LIVE_ENABLED"),
  catalogueSync: envFlag("CATALOGUE_SYNC_ENABLED"),
  analytics: envFlag("ANALYTICS_ENABLED"),
  stagingAccess: envFlag("STAGING_ACCESS_ENABLED"),
  maintenanceBanner: envFlag("MAINTENANCE_BANNER_ENABLED"),
  admin2faRequired: process.env.ADMIN_2FA_REQUIRED !== "false",
};

export function canonicalUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${normalized === "/" ? "" : normalized}`;
}

export function assertProductionSafe(): void {
  if (!isProduction) return;

  const problems: string[] = [];
  if (demoMode) problems.push("DEMO_MODE must be false in production");
  if (seedDemoData) problems.push("SEED_DEMO_DATA must be false in production");
  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL is required in production");
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    problems.push("AUTH_SECRET must be at least 32 characters in production");
  }
  if (!process.env.ACTIVATION_KEK_V1) {
    problems.push("ACTIVATION_KEK_V1 is required in production");
  }
  if (!process.env.MOCK_PAYMENT_WEBHOOK_SECRET) {
    problems.push("MOCK_PAYMENT_WEBHOOK_SECRET is required in production");
  }
  if (!process.env.INTERNAL_JOB_SECRET) {
    problems.push("INTERNAL_JOB_SECRET is required in production");
  }
  if (!process.env.RATE_LIMIT_HASH_SECRET) {
    problems.push("RATE_LIMIT_HASH_SECRET is required in production");
  }
  if (siteUrl.includes("localhost") || !siteUrl.startsWith("https://")) {
    problems.push("SITE_URL must be the verified HTTPS public origin");
  } else {
    try {
      new URL(siteUrl);
    } catch {
      problems.push("SITE_URL must be a valid absolute URL");
    }
  }
  if (flags.paymentsLive) problems.push("PAYMENTS_LIVE_ENABLED is not implemented in this build");
  if (flags.supplierLive) problems.push("SUPPLIER_LIVE_ENABLED is not implemented in this build");
  if (flags.emailLive) problems.push("EMAIL_LIVE_ENABLED is not implemented in this build");
  if (flags.catalogueSync) problems.push("CATALOGUE_SYNC_ENABLED is not implemented in this build");
  if (flags.analytics) problems.push("ANALYTICS_ENABLED is not implemented in this build");
  if (flags.stagingAccess) problems.push("STAGING_ACCESS_ENABLED is not implemented in this build");
  if (!flags.admin2faRequired) problems.push("ADMIN_2FA_REQUIRED must be true in production");

  if (problems.length > 0) {
    throw new Error(`Unsafe production configuration: ${problems.join("; ")}`);
  }
}

export function authSecret(): string {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 32) return value;
  if (isProduction) throw new Error("AUTH_SECRET must be at least 32 characters in production");
  return "local-demo-only-auth-secret-change-me";
}

export function activationKek(): { key: Buffer; version: number } {
  const encoded = process.env.ACTIVATION_KEK_V1;
  const version = Number(process.env.ACTIVATION_KEK_ACTIVE_VERSION || "1");
  if (!encoded) {
    throw new Error(
      "ACTIVATION_KEK_V1 is missing. Run `npm run db:setup` to create a local demo key.",
    );
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("ACTIVATION_KEK_V1 must be a base64-encoded 32-byte key");
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("ACTIVATION_KEK_ACTIVE_VERSION must be a positive integer");
  }
  return { key, version };
}

export function mockWebhookSecret(): string {
  const value = process.env.MOCK_PAYMENT_WEBHOOK_SECRET;
  if (value) return value;
  if (isProduction) throw new Error("MOCK_PAYMENT_WEBHOOK_SECRET is required in production");
  return "local-demo-only-mock-webhook-secret";
}

export function internalJobSecret(): string {
  const value = process.env.INTERNAL_JOB_SECRET;
  if (value) return value;
  if (isProduction) throw new Error("INTERNAL_JOB_SECRET is required in production");
  return "local-demo-only-internal-job-secret";
}

export function rateLimitHashSecret(): string {
  const value = process.env.RATE_LIMIT_HASH_SECRET;
  if (value) return value;
  if (isProduction) throw new Error("RATE_LIMIT_HASH_SECRET is required in production");
  return "local-demo-only-rate-limit-secret";
}

export function sessionCookieName(): string {
  return `${process.env.SESSION_COOKIE_PREFIX || "esimprove"}_session`;
}

export const integrationModes = {
  supplier: flags.supplierLive ? "live-disabled" : "mock-sandbox",
  payments: flags.paymentsLive ? "live-disabled" : "mock-sandbox",
  email: flags.emailLive ? "live-disabled" : "local-logger",
} as const;
