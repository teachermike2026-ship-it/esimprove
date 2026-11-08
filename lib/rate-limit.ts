import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { hashIdentifier } from "@/lib/crypto";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
}

/**
 * Fixed-window counters live in PostgreSQL (`rate_limit_counters`) and the
 * increment is a single atomic upsert. Every Netlify serverless instance reads
 * and writes the same row, so the limit is shared across instances. Do not
 * replace this with a process-local Map.
 */
export async function checkRateLimit(
  db: Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
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
  const rows = Array.isArray(result)
    ? result
    : (((result as unknown as { rows?: Array<{ count: number }> }).rows) ?? []);
  const count = Number((rows[0] as { count?: number } | undefined)?.count ?? 1);
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
 * Netlify exposes the client connection address in x-nf-client-connection-ip.
 * Proxies may add x-forwarded-for; use its first hop. Only an HMAC of the
 * address is stored in the counter key, never the raw address.
 */
export function requestIpHash(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const address =
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-nf-client-connection-ip")?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown";
  return hashIdentifier(address);
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
