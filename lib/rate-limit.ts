import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
}

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
