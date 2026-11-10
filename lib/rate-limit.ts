import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { clientIpHash } from "@/lib/request-ip";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
}

export class RateLimitCounterError extends Error {
  constructor(message = "Rate limit counter is unavailable") {
    super(message);
    this.name = "RateLimitCounterError";
  }
}

function resultRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
  }
  return [];
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RateLimitCounterError(`${name} must be a positive integer`);
  }
  return value;
}

/**
 * Fixed-window counters live in PostgreSQL (`rate_limit_counters`) and the
 * increment is a single atomic upsert. Every Netlify serverless instance reads
 * and writes the same row, so the limit is shared across instances. Do not
 * replace this with a process-local Map.
 *
 * Failure policy: a missing, malformed, or non-numeric counter throws instead of
 * returning an allowed result. Callers translate that into a 503, so a database
 * outage cannot silently disable abuse protection.
 */
export async function checkRateLimit(
  db: Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!key) throw new RateLimitCounterError("Rate limit key is required");
  positiveInteger(limit, "Rate limit");
  positiveInteger(windowSeconds, "Rate limit window");

  const result = await db.execute(sql`
    INSERT INTO rate_limit_counters (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limit_counters.window_start < now() - make_interval(secs => ${windowSeconds})
          THEN 1
        ELSE rate_limit_counters.count + 1
      END,
      window_start = CASE
        WHEN rate_limit_counters.window_start < now() - make_interval(secs => ${windowSeconds})
          THEN now()
        ELSE rate_limit_counters.window_start
      END
    RETURNING count
  `);
  const rawCount = resultRows(result)[0]?.count;
  const count =
    typeof rawCount === "number"
      ? rawCount
      : typeof rawCount === "string" && rawCount.trim() !== ""
        ? Number(rawCount)
        : Number.NaN;

  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RateLimitCounterError("Rate limit counter returned an invalid count");
  }

  return { allowed: count <= limit, count, limit };
}

/**
 * Public endpoint limits. These are intentionally generous enough for normal
 * browsing (one page view plus a few interactions) while still bounding abuse.
 */
export const REQUEST_RATE_LIMITS = {
  analyticsTrack: { key: "analytics:track", limit: 120, windowSeconds: 60 },
  consent: { key: "consent:record", limit: 30, windowSeconds: 60 },
} as const;

export type RequestRateLimitScope = keyof typeof REQUEST_RATE_LIMITS;

/**
 * Expired counters are safe to delete. The TTL is deliberately larger than the
 * longest configured fixed window; active windows are therefore never removed.
 * This is an explicit, idempotent cleanup step for the scheduled jobs route.
 */
export const RATE_LIMIT_COUNTER_TTL_SECONDS = 24 * 60 * 60;

export async function cleanupExpiredRateLimitCounters(
  db: Database,
  olderThanSeconds = RATE_LIMIT_COUNTER_TTL_SECONDS,
): Promise<number> {
  const ttl = positiveInteger(olderThanSeconds, "Rate limit counter TTL");
  const result = await db.execute(sql`
    DELETE FROM rate_limit_counters
    WHERE window_start < now() - make_interval(secs => ${ttl})
    RETURNING key
  `);
  return resultRows(result).length;
}

/**
 * Netlify exposes the client connection address in x-nf-client-connection-ip.
 * Use the shared trusted-address resolver so authentication, contact, privacy,
 * analytics, and consent limits all identify the same client in the same way.
 * Only an HMAC of the address is stored in the counter key, never the address.
 */
export function requestIpHash(headers: Headers): string {
  return clientIpHash(headers);
}

export function requestRateLimitKey(
  scope: RequestRateLimitScope,
  headers: Headers,
): string {
  return `${REQUEST_RATE_LIMITS[scope].key}:${requestIpHash(headers)}`;
}

export async function checkRequestRateLimit(
  db: Database,
  scope: RequestRateLimitScope,
  headers: Headers,
): Promise<RateLimitResult> {
  const limit = REQUEST_RATE_LIMITS[scope];
  return checkRateLimit(
    db,
    requestRateLimitKey(scope, headers),
    limit.limit,
    limit.windowSeconds,
  );
}
