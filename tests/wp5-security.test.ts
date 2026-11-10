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
  RateLimitCounterError,
  checkRateLimit,
  checkRequestRateLimit,
  cleanupExpiredRateLimitCounters,
  requestRateLimitKey,
} from "@/lib/rate-limit";
import { hashConsentSubject } from "@/lib/consent";
import {
  buildContentSecurityPolicy,
  createSecurityNonce,
  parseCspHosts,
} from "@/lib/security-headers";

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

  it("builds a nonce-based content security policy with host allowlists", () => {
    const nonce = "dGVzdC1ub25jZS12YWx1ZQ==";
    const csp = buildContentSecurityPolicy({
      nonce,
      development: false,
      upgradeInsecureRequests: true,
      imageHosts: ["https://cdn.example.com"],
      mediaHosts: ["https://media.example.com"],
    });
    const scriptDirective = csp
      .split("; ")
      .find((directive) => directive.startsWith("script-src "))!;
    expect(scriptDirective).toContain("'self'");
    expect(scriptDirective).toContain(`'nonce-${nonce}'`);
    expect(scriptDirective).not.toContain("'unsafe-inline'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("https://www.google-analytics.com");
    expect(csp).toContain("https://*.google-analytics.com");
    expect(csp).toContain(
      "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com",
    );
    expect(
      csp.split("; ").find((directive) => directive.startsWith("img-src ")),
    ).toBe("img-src 'self' data: blob: https://cdn.example.com");
    expect(csp).toContain("media-src 'self' https://media.example.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");

    const developmentCsp = buildContentSecurityPolicy({
      nonce,
      development: true,
    });
    expect(developmentCsp).toContain("'unsafe-eval'");
    expect(developmentCsp).not.toContain("upgrade-insecure-requests");
  });

  it("validates nonces and configured CSP host allowlists", () => {
    const firstNonce = createSecurityNonce();
    const secondNonce = createSecurityNonce();
    expect(firstNonce).not.toBe(secondNonce);
    expect(firstNonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(firstNonce.length).toBeGreaterThanOrEqual(20);

    expect(
      parseCspHosts(
        "https://cdn.example.com, https://media.example.com:8443, http://insecure.example.com, https://bad.example.com; script-src *",
      ),
    ).toEqual(["https://cdn.example.com", "https://media.example.com:8443"]);
    expect(parseCspHosts("")).toEqual([]);
  });

  it("emits a fresh CSP nonce from the proxy and no static duplicate", async () => {
    const { proxy } = await import("@/proxy");
    const makeRequest = () =>
      new NextRequest("http://localhost:3000/about", {
        headers: new Headers({ "user-agent": "vitest" }),
      });
    const first = await proxy(makeRequest());
    const second = await proxy(makeRequest());
    const firstCsp = first.headers.get("content-security-policy");
    const secondCsp = second.headers.get("content-security-policy");
    expect(firstCsp).toContain("script-src 'self' 'nonce-");
    expect(firstCsp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(firstCsp).not.toBe(secondCsp);

    const configModule = await import("../next.config");
    const config = configModule.default as {
      headers?: () => Promise<
        Array<{ source: string; headers: Array<{ key: string; value: string }> }>
      >;
    };
    const headers = (await config.headers!()).flatMap((entry) => entry.headers);
    expect(headers.find((header) => header.key === "Content-Security-Policy")).toBeUndefined();
    expect(headers.find((header) => header.key === "X-Content-Type-Options")).toBeDefined();
  });

  it("adds a CSP and login redirect to the admin gate", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(
      new NextRequest("http://localhost:3000/admin/orders", {
        headers: new Headers({ "user-agent": "vitest" }),
      }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Fadmin%2Forders");
    expect(response.headers.get("content-security-policy")).toContain("'nonce-");
  });

  it("fails closed on invalid rate-limit settings and removes only expired counters", async () => {
    await expect(checkRateLimit(handle.db, "invalid-limit", 0, 60)).rejects.toBeInstanceOf(
      RateLimitCounterError,
    );
    await expect(checkRateLimit(handle.db, "", 1, 60)).rejects.toBeInstanceOf(
      RateLimitCounterError,
    );
    await expect(checkRateLimit(handle.db, "invalid-window", 1, 0)).rejects.toBeInstanceOf(
      RateLimitCounterError,
    );
    await expect(cleanupExpiredRateLimitCounters(handle.db, 0)).rejects.toBeInstanceOf(
      RateLimitCounterError,
    );

    const now = Date.now();
    await handle.db.insert(rateLimitCounters).values([
      { key: "active-counter", windowStart: new Date(now), count: 3 },
      {
        key: "expired-counter",
        windowStart: new Date(now - 2 * 24 * 60 * 60 * 1000),
        count: 5,
      },
    ]);
    expect(await cleanupExpiredRateLimitCounters(handle.db)).toBe(1);
    const remaining = await handle.db
      .select({ key: rateLimitCounters.key })
      .from(rateLimitCounters);
    expect(remaining.map((row) => row.key)).toEqual(["active-counter"]);
  });

  it("maps missing or malformed client addresses to one shared bucket", async () => {
    const first = await checkRequestRateLimit(handle.db, "consent", new Headers());
    const second = await checkRequestRateLimit(
      handle.db,
      "consent",
      new Headers({ "x-forwarded-for": "not-an-ip" }),
    );
    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
  });
});
