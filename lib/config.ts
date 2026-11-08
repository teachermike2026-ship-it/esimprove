const DEFAULT_SITE_URL = "http://localhost:3000";

const DEPLOYED_CONTEXTS = ["preview", "staging", "production"] as const;

export type AppEnvironment = "local" | "test" | "preview" | "staging" | "production";
export type DeployedEnvironment = (typeof DEPLOYED_CONTEXTS)[number];

function envFlag(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() === "true" || value === "1";
}

function normalizedEnv(name: string): string {
  return (process.env[name] ?? "").trim().toLowerCase();
}

export const appEnv = (normalizedEnv("APP_ENV") || "local") as AppEnvironment;
// Netlify sets NETLIFY=true for every deploy context. It is not a signal that
// the deploy is production; APP_ENV must identify the context explicitly.
export const isNetlify = normalizedEnv("NETLIFY") === "true";
export const isProduction = appEnv === "production";
export const isPreview = appEnv === "preview";
export const isStaging = appEnv === "staging";
export const isTest = appEnv === "test";
export const isDeployed =
  isNetlify || DEPLOYED_CONTEXTS.includes(appEnv as DeployedEnvironment);
export const isLocal = !isDeployed;

export const demoMode = process.env.DEMO_MODE !== "false";
export const seedDemoData = process.env.SEED_DEMO_DATA !== "false";
// Mock suppliers, payments, and email are safe only outside production. A
// preview or staging deploy must still be demo/noindex, and production must
// never present a simulated payment or delivery as real.
export const mockCommerceAllowed = !isProduction;
export const noIndex = demoMode || isPreview || isStaging;

export const siteUrl = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
export const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Esimprove";

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

/**
 * The database target must declare the same environment as APP_ENV. Netlify
 * environment variables can be scoped per deploy context; this guard prevents
 * a preview/staging deploy from silently using a production connection string.
 */
export const databaseEnv = (
  normalizedEnv("DATABASE_ENV") || (isDeployed ? "" : isTest ? "test" : "local")
) as AppEnvironment;

export function canonicalUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${normalized === "/" ? "" : normalized}`;
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
}

function validateSiteUrl(problems: string[]): void {
  if (siteUrl.includes("localhost") || !siteUrl.startsWith("https://")) {
    problems.push("SITE_URL must be the verified HTTPS public origin");
    return;
  }
  try {
    const parsed = new URL(siteUrl);
    if (parsed.protocol !== "https:" || !parsed.hostname) {
      problems.push("SITE_URL must be a valid absolute HTTPS URL");
    }
  } catch {
    problems.push("SITE_URL must be a valid absolute URL");
  }
}

function validateDatabaseUrl(problems: string[]): void {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    problems.push("DATABASE_URL is required in deployed environments");
    return;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      problems.push("DATABASE_URL must be a postgres:// or postgresql:// connection string");
      return;
    }
    if (isLoopbackHost(parsed.hostname)) {
      problems.push("DATABASE_URL must not point at localhost in a deployed environment");
    }
    if (parsed.searchParams.get("sslmode") === "disable") {
      problems.push("DATABASE_URL must not disable TLS in a deployed environment");
    }
  } catch {
    problems.push("DATABASE_URL must be a valid PostgreSQL connection string");
  }
  if (normalizedEnv("DATABASE_SSL") === "disable") {
    problems.push("DATABASE_SSL must not be disabled in a deployed environment");
  }
  const poolMax = process.env.DATABASE_POOL_MAX;
  if (poolMax !== undefined && poolMax !== "") {
    const parsed = Number(poolMax);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      problems.push("DATABASE_POOL_MAX must be an integer between 1 and 10");
    }
  }
}

function validateDatabaseEnvironment(problems: string[]): void {
  if (!databaseEnv) {
    problems.push("DATABASE_ENV must be set to preview, staging, or production");
    return;
  }
  if (!DEPLOYED_CONTEXTS.includes(databaseEnv as DeployedEnvironment)) {
    problems.push("DATABASE_ENV must be one of preview, staging, or production");
    return;
  }
  if (databaseEnv !== appEnv) {
    problems.push(`DATABASE_ENV (${databaseEnv}) must match APP_ENV (${appEnv})`);
  }
}

function validateSharedDeploymentSecrets(problems: string[]): void {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    problems.push("AUTH_SECRET must be at least 32 characters");
  }
  const activationKek = process.env.ACTIVATION_KEK_V1;
  if (!activationKek) {
    problems.push("ACTIVATION_KEK_V1 is required");
  } else if (Buffer.from(activationKek, "base64").length !== 32) {
    problems.push("ACTIVATION_KEK_V1 must be a base64-encoded 32-byte key");
  }
  const version = Number(process.env.ACTIVATION_KEK_ACTIVE_VERSION || "1");
  if (!Number.isInteger(version) || version < 1) {
    problems.push("ACTIVATION_KEK_ACTIVE_VERSION must be a positive integer");
  }
  if (!process.env.INTERNAL_JOB_SECRET) {
    problems.push("INTERNAL_JOB_SECRET is required");
  }
  if (!process.env.RATE_LIMIT_HASH_SECRET) {
    problems.push("RATE_LIMIT_HASH_SECRET is required");
  }
  const analyticsHashSecret = process.env.ANALYTICS_HASH_SECRET;
  if (!analyticsHashSecret || analyticsHashSecret.length < 32) {
    problems.push("ANALYTICS_HASH_SECRET must be at least 32 characters");
  } else {
    if (analyticsHashSecret === process.env.RATE_LIMIT_HASH_SECRET) {
      problems.push("ANALYTICS_HASH_SECRET must be distinct from RATE_LIMIT_HASH_SECRET");
    }
    if (analyticsHashSecret === process.env.AUTH_SECRET) {
      problems.push("ANALYTICS_HASH_SECRET must be distinct from AUTH_SECRET");
    }
  }
}

function validateLiveFlags(problems: string[]): void {
  if (flags.paymentsLive) problems.push("PAYMENTS_LIVE_ENABLED is not implemented in this build");
  if (flags.supplierLive) problems.push("SUPPLIER_LIVE_ENABLED is not implemented in this build");
  if (flags.emailLive) problems.push("EMAIL_LIVE_ENABLED is not implemented in this build");
  if (flags.catalogueSync) problems.push("CATALOGUE_SYNC_ENABLED is not implemented in this build");
  if (flags.analytics) problems.push("ANALYTICS_ENABLED is not implemented in this build");
  if (flags.stagingAccess) problems.push("STAGING_ACCESS_ENABLED is not implemented in this build");
}

/**
 * Returns actionable, non-secret configuration problems. Values are never
 * included; only variable names and safe context identifiers.
 */
export function getConfigurationProblems(): string[] {
  const problems: string[] = [];

  if (isNetlify && !DEPLOYED_CONTEXTS.includes(appEnv as DeployedEnvironment)) {
    problems.push(
      "APP_ENV must be set explicitly to preview, staging, or production on Netlify; NETLIFY=true alone does not select production",
    );
  }

  if (!isDeployed) return problems;

  validateSiteUrl(problems);
  validateDatabaseUrl(problems);
  validateDatabaseEnvironment(problems);
  validateSharedDeploymentSecrets(problems);
  validateLiveFlags(problems);

  if (!flags.admin2faRequired) {
    problems.push("ADMIN_2FA_REQUIRED must be true in a deployed environment");
  }

  if (isProduction) {
    if (demoMode) problems.push("DEMO_MODE must be false in production");
    if (seedDemoData) problems.push("SEED_DEMO_DATA must be false in production");
    if (!process.env.SUPPLIER_CREDENTIAL_KEK) {
      problems.push("SUPPLIER_CREDENTIAL_KEK is required in production");
    } else if (Buffer.from(process.env.SUPPLIER_CREDENTIAL_KEK, "base64").length !== 32) {
      problems.push("SUPPLIER_CREDENTIAL_KEK must be a base64-encoded 32-byte key");
    }
    if (
      process.env.SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK === "true" ||
      process.env.SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK === "1"
    ) {
      problems.push(
        "SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK must be false in production",
      );
    }
  } else {
    if (isPreview && !demoMode) {
      problems.push("DEMO_MODE must be true in a preview deploy");
    }
    if (!process.env.MOCK_PAYMENT_WEBHOOK_SECRET) {
      problems.push("MOCK_PAYMENT_WEBHOOK_SECRET is required for mock commerce");
    }
  }

  return problems;
}

export function assertProductionSafe(): void {
  const problems = getConfigurationProblems();
  if (problems.length === 0) return;
  const label = isProduction
    ? "Unsafe production configuration"
    : isDeployed
      ? "Unsafe deployment configuration"
      : "Unsafe configuration";
  throw new Error(`${label}: ${problems.join("; ")}`);
}

export function authSecret(): string {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 32) return value;
  if (isDeployed) {
    throw new Error("AUTH_SECRET must be at least 32 characters in a deployed environment");
  }
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
  if (!mockCommerceAllowed) {
    throw new Error("Mock payments are disabled in production");
  }
  const value = process.env.MOCK_PAYMENT_WEBHOOK_SECRET;
  if (value) return value;
  return "local-demo-only-mock-webhook-secret";
}

export function internalJobSecret(): string {
  const value = process.env.INTERNAL_JOB_SECRET;
  if (value) return value;
  if (isDeployed) {
    throw new Error("INTERNAL_JOB_SECRET is required in a deployed environment");
  }
  return "local-demo-only-internal-job-secret";
}

export function rateLimitHashSecret(): string {
  const value = process.env.RATE_LIMIT_HASH_SECRET;
  if (value) return value;
  if (isDeployed) {
    throw new Error("RATE_LIMIT_HASH_SECRET is required in a deployed environment");
  }
  return "local-demo-only-rate-limit-secret";
}

/**
 * Dedicated key for pseudonymising analytics visitor/session identifiers and
 * consent subjects. It must not fall back to the rate-limit, auth, or
 * activation secrets in a deployed environment: rotating or leaking one key
 * must not silently affect the other identifiers.
 */
export function analyticsHashSecret(): string {
  const value = process.env.ANALYTICS_HASH_SECRET;
  if (value && value.length >= 32) return value;
  if (isDeployed) {
    throw new Error(
      "ANALYTICS_HASH_SECRET must be at least 32 characters in a deployed environment",
    );
  }
  return "local-demo-only-analytics-hash-secret";
}

export function sessionCookieName(): string {
  return `${process.env.SESSION_COOKIE_PREFIX || "esimprove"}_session`;
}

export const integrationModes = {
  supplier: flags.supplierLive
    ? "live-disabled"
    : mockCommerceAllowed
      ? "mock-sandbox"
      : "disabled",
  payments: flags.paymentsLive
    ? "live-disabled"
    : mockCommerceAllowed
      ? "mock-sandbox"
      : "disabled",
  email: flags.emailLive
    ? "live-disabled"
    : mockCommerceAllowed
      ? "local-logger"
      : "disabled",
} as const;
