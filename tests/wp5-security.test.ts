import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import type { Database, DatabaseHandle } from "@/lib/db/client";
import {
  analyticsEvents,
  analyticsSessions,
  analyticsVisitors,
  cookieConsents,
  rateLimitCounters,
} from "@/lib/db/schema";
import { loadLegalSettings } from "@/lib/legal";
import { makeTestDb } from "./helpers/db";
import {
  REQUEST_RATE_LIMITS,
  checkRequestRateLimit,
  requestRateLimitKey,
} from "@/lib/rate-limit";
import { hashConsentSubject } from "@/lib/consent";
import { hashIdentifier } from "@/lib/analytics-web";
import { buildContentSecurityPolicy } from "@/lib/security-headers";

const mockState = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name.endsWith("_session") && mockState.token
        ? { name, value: mockState.token }
        : undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
  headers: async () => new Headers({ "user-agent": "vitest" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

function trackingRequest(options: {
  body: unknown;
  headers?: Record<string, string>;
  method?: string;
  ip?: string;
}): NextRequest {
  const headers = new Headers({
    "content-type": "application/json",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    ...(options.headers ?? {}),
  });
  if (options.ip) headers.set("x-forwarded-for", options.ip);
  return new NextRequest("http://localhost:3000/api/track", {
    method: options.method ?? "POST",
    headers,
    body: options.method === "GET" ? undefined : JSON.stringify(options.body),
  });
}

function consentRequest(ip: string, consentId: string, consentVersion: string) {
  return new NextRequest("http://localhost:3000/api/consent", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      "user-agent": "vitest",
      "x-forwarded-for": ip,
    }),
    body: JSON.stringify({
      consentId,
      consentVersion,
      action: "accept_all",
      categories: { necessary: true, analytics: true, marketing: false },
    }),
  });
}

function validTrackingPayload(visitor: string, session: string) {
  return {
    visitorId: visitor,
    sessionId: session,
    events: [{ type: "page_view", path: "/about", title: "About" }],
  };
}

function seedRateLimitCounter(
  db: Database,
  key: string,
  count: number,
): Promise<void> {
  return db
    .insert(rateLimitCounters)
    .values({ key, windowStart: new Date(), count })
    .onConflictDoUpdate({
      target: rateLimitCounters.key,
      set: { count, windowStart: new Date() },
    })
    .then(() => undefined);
}

describe("WP5 retention, rate limit, CSP, and analytics secret regression suite", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
    (globalThis as typeof globalThis & {
      __esimproveDbPromise?: Promise<DatabaseHandle>;
    }).__esimproveDbPromise = Promise.resolve(handle);
  });

  afterAll(async () => {
    const globalWithDb = globalThis as typeof globalThis & {
      __esimproveDbPromise?: Promise<DatabaseHandle>;
    };
    globalWithDb.__esimproveDbPromise = undefined;
    await handle.close();
  });

  beforeEach(async () => {
    await handle.db.delete(rateLimitCounters);
    await handle.db.delete(cookieConsents);
    await handle.db.delete(analyticsEvents);
    await handle.db.delete(analyticsSessions);
    await handle.db.delete(analyticsVisitors);
  });

  it("uses the dedicated analytics hash secret for consent and analytics identifiers", async () => {
    const { hashIdentifier } = await import("@/lib/analytics-web");
    const value = "wp5-dedicated-secret-subject-value";
    const secret = process.env.ANALYTICS_HASH_SECRET;
    expect(secret).toBeTruthy();
    const expected = createHmac("sha256", secret!).update(value).digest("hex");
    expect(hashIdentifier(value)).toBe(expected);
    expect(hashConsentSubject(value)).toBe(expected);
  });

  it("keeps counters in the database and applies them per IP hash", async () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.20" });
    const first = await checkRequestRateLimit(handle.db, "consent", headers);
    expect(first.allowed).toBe(true);
    expect(first.count).toBe(1);
    expect(first.limit).toBe(REQUEST_RATE_LIMITS.consent.limit);

    const second = await checkRequestRateLimit(handle.db, "consent", headers);
    expect(second.count).toBe(2);
    const other = await checkRequestRateLimit(
      handle.db,
      "consent",
      new Headers({ "x-forwarded-for": "203.0.113.21" }),
    );
    expect(other.count).toBe(1);

    const rows = await handle.db
      .select()
      .from(rateLimitCounters)
      .where(eq(rateLimitCounters.key, requestRateLimitKey("consent", headers)));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.count).toBe(2);
  });

  it("returns 429 from /api/track when the shared database counter is exhausted", async () => {
    const legal = await loadLegalSettings(handle.db);
    const headers = new Headers({
      "content-type": "application/json",
      "user-agent": "vitest",
      "x-forwarded-for": "203.0.113.30",
    });
    const key = requestRateLimitKey("analyticsTrack", headers);
    await seedRateLimitCounter(
      handle.db,
      key,
      REQUEST_RATE_LIMITS.analyticsTrack.limit,
    );

    const { POST } = await import("@/app/api/track/route");
    const limited = await POST(
      trackingRequest({
        body: validTrackingPayload("visitor_w5_track_lim", "session_w5_track_lim"),
        ip: "203.0.113.30",
      }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe(
      String(REQUEST_RATE_LIMITS.analyticsTrack.windowSeconds),
    );
    expect(limited.headers.get("cache-control")).toContain("no-store");

    const eventsAfterLimit = await handle.db
      .select({ count: sql<number>`count(*)::int` })
      .from(analyticsEvents);
    expect(Number(eventsAfterLimit[0]!.count)).toBe(0);

    expect(legal).toBeTruthy();
  });

  it("allows /api/consent through a fresh IP after a consent counter is exhausted", async () => {
    const legal = await loadLegalSettings(handle.db);
    const headers = new Headers({ "x-forwarded-for": "203.0.113.40" });
    const key = requestRateLimitKey("consent", headers);
    await seedRateLimitCounter(handle.db, key, REQUEST_RATE_LIMITS.consent.limit);

    const { POST } = await import("@/app/api/consent/route");
    const limited = await POST(
      consentRequest("203.0.113.40", "wp5_rate_test_consent", legal.cookieConsentVersion),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe(
      String(REQUEST_RATE_LIMITS.consent.windowSeconds),
    );

    const allowed = await POST(
      consentRequest("203.0.113.41", "wp5_rate_test_consent", legal.cookieConsentVersion),
    );
    expect(allowed.status).toBe(204);

    const stored = await handle.db
      .select()
      .from(cookieConsents)
      .where(eq(cookieConsents.consentVersion, legal.cookieConsentVersion))
      .limit(1);
    expect(stored).toHaveLength(1);
  });

  it("builds a strengthened content security policy", () => {
    const csp = buildContentSecurityPolicy({
      development: false,
      upgradeInsecureRequests: true,
    });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
    );
    expect(csp).toContain("https://www.google-analytics.com");
    expect(csp).toContain("https://*.google-analytics.com");
    expect(csp).toContain(
      "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com",
    );
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");

    const developmentCsp = buildContentSecurityPolicy({ development: true });
    expect(developmentCsp).toContain("'unsafe-eval'");
    expect(developmentCsp).not.toContain("upgrade-insecure-requests");
  });

  it("wires the content security policy into the Next configuration", async () => {
    const configModule = await import("../next.config");
    const config = configModule.default as {
      headers?: () => Promise<
        Array<{ source: string; headers: Array<{ key: string; value: string }> }>
      >;
    };
    const headers = (await config.headers!()).flatMap((entry) => entry.headers);
    const csp = headers.find((header) => header.key === "Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp!.value).toContain("default-src 'self'");
    expect(csp!.value).toContain("https://www.googletagmanager.com");
  });
});
