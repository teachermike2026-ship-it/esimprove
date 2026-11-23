import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import {
  parseUserAgent,
  recordAnalyticsEvents,
  validateTrackingPayload,
} from "@/lib/analytics-web";
import { siteUrl } from "@/lib/config";
import { readBoundedText } from "@/lib/http/bounded-body";
import { hasAnalyticsConsent, isConsentId } from "@/lib/consent";
import { loadLegalSettings } from "@/lib/legal";
import {
  REQUEST_RATE_LIMITS,
  checkRequestRateLimit,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;

const noStoreHeaders: Record<string, string> = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

function rateLimited(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "rate_limited" },
    {
      status: 429,
      headers: {
        ...noStoreHeaders,
        "Retry-After": String(REQUEST_RATE_LIMITS.analyticsTrack.windowSeconds),
      },
    },
  );
}

function corsSafeOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches may omit Origin in some browsers/tests
  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get("host");
    const siteHost = new URL(siteUrl).host;
    return originHost === requestHost || originHost === siteHost;
  } catch {
    return false;
  }
}

function countryFromHeaders(request: NextRequest): string | null {
  // Netlify/Cloudflare/Vercel expose coarse country headers. Raw IP addresses
  // are never read or stored.
  const candidates = [
    request.headers.get("x-country"),
    request.headers.get("x-nf-country"),
    request.headers.get("cf-ipcountry"),
    request.headers.get("x-vercel-ip-country"),
  ];
  for (const candidate of candidates) {
    if (candidate && /^[A-Za-z]{2}$/.test(candidate)) return candidate.toUpperCase();
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_ANALYTICS_DISABLED === "true") {
    return new NextResponse(null, { status: 204, headers: noStoreHeaders });
  }
  if (!corsSafeOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403, headers: noStoreHeaders });
  }

  // Honour browser privacy signals without storing anything.
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") {
    return new NextResponse(null, { status: 204, headers: noStoreHeaders });
  }

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413, headers: noStoreHeaders });
  }

  // The counter is stored in PostgreSQL, so the same window applies on every
  // serverless instance. This runs before body parsing and consent lookup.
  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
    const rate = await checkRequestRateLimit(db, "analyticsTrack", request.headers);
    if (!rate.allowed) return rateLimited();
  } catch (error) {
    console.error("Analytics collection failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "collection_failed" }, { status: 503, headers: noStoreHeaders });
  }

  let body: unknown;
  try {
    const text = await readBoundedText(request, MAX_BODY_BYTES);
    if (text === null) {
      return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413, headers: noStoreHeaders });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400, headers: noStoreHeaders });
  }

  const payload = validateTrackingPayload(body);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400, headers: noStoreHeaders });
  }

  const userAgent = request.headers.get("user-agent");
  const bot = parseUserAgent(userAgent).deviceType === "bot";
  const internalHeader = request.headers.get("x-esimprove-internal") === "1";
  const adminPath = payload.events.some((event) => event.path.startsWith("/admin"));
  const isInternal = bot || internalHeader || adminPath;

  // A browser flag is not consent evidence. The request must reference a
  // server-side consent record for the current policy version. Missing,
  // outdated, or withdrawn consent is silently ignored.
  const consentId = request.headers.get("x-es-consent-id");
  if (!isConsentId(consentId)) {
    return new NextResponse(null, { status: 204, headers: noStoreHeaders });
  }

  try {
    const legalSettings = await loadLegalSettings(db);
    const consented = await hasAnalyticsConsent(
      db,
      consentId,
      legalSettings.cookieConsentVersion,
    );
    if (!consented) {
      return new NextResponse(null, { status: 204, headers: noStoreHeaders });
    }
    const result = await recordAnalyticsEvents(db, payload, {
      countryCode: countryFromHeaders(request),
      userAgent,
      isInternal,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status, headers: noStoreHeaders },
      );
    }
    return NextResponse.json(
      { ok: true, accepted: result.accepted, excluded: result.internal },
      { status: 202, headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("Analytics collection failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "collection_failed" }, { status: 503, headers: noStoreHeaders });
  }
}

export function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: noStoreHeaders });
}
