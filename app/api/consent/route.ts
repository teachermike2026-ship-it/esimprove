import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { recordCookieConsent, isConsentId } from "@/lib/consent";
import { loadLegalSettings } from "@/lib/legal";
import { siteUrl } from "@/lib/config";
import {
  REQUEST_RATE_LIMITS,
  checkRequestRateLimit,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const ACTIONS = new Set(["accept_all", "reject_non_essential", "custom", "withdraw"]);

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
        "Retry-After": String(REQUEST_RATE_LIMITS.consent.windowSeconds),
      },
    },
  );
}

function corsSafeOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
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
  if (!corsSafeOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403, headers: noStoreHeaders });
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, error: "payload_too_large" },
      { status: 413, headers: noStoreHeaders },
    );
  }

  // The counter is stored in PostgreSQL, so the same window applies on every
  // serverless instance. This runs before JSON parsing and consent writes.
  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
    const rate = await checkRequestRateLimit(db, "consent", request.headers);
    if (!rate.allowed) return rateLimited();
  } catch (error) {
    console.error("Consent record failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { ok: false, error: "consent_record_failed" },
      { status: 503, headers: noStoreHeaders },
    );
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "payload_too_large" },
        { status: 413, headers: noStoreHeaders },
      );
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400, headers: noStoreHeaders },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const record = body as Record<string, unknown>;
  if (!isConsentId(record.consentId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_consent_id" },
      { status: 400, headers: noStoreHeaders },
    );
  }
  if (typeof record.consentVersion !== "string" || record.consentVersion.length > 80) {
    return NextResponse.json(
      { ok: false, error: "invalid_version" },
      { status: 400, headers: noStoreHeaders },
    );
  }
  if (typeof record.action !== "string" || !ACTIONS.has(record.action)) {
    return NextResponse.json(
      { ok: false, error: "invalid_action" },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const categories = record.categories;
  if (!categories || typeof categories !== "object") {
    return NextResponse.json(
      { ok: false, error: "invalid_categories" },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const categoryRecord = categories as Record<string, unknown>;

  try {
    const settings = await loadLegalSettings(db);
    if (record.consentVersion !== settings.cookieConsentVersion) {
      return NextResponse.json(
        { ok: false, error: "outdated_version" },
        { status: 409, headers: noStoreHeaders },
      );
    }
    await recordCookieConsent(db, {
      consentId: record.consentId,
      consentVersion: record.consentVersion,
      action: record.action as "accept_all" | "reject_non_essential" | "custom" | "withdraw",
      categories: {
        necessary: true,
        analytics: categoryRecord.analytics === true,
        marketing: categoryRecord.marketing === true,
      },
      countryCode: countryFromHeaders(request),
      userAgent: request.headers.get("user-agent"),
    });
    return new NextResponse(null, { status: 204, headers: noStoreHeaders });
  } catch (error) {
    console.error("Consent record failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { ok: false, error: "consent_record_failed" },
      { status: 503, headers: noStoreHeaders },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: noStoreHeaders },
  );
}
