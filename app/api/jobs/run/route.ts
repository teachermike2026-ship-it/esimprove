import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { internalJobSecret } from "@/lib/config";
import { safeEqual } from "@/lib/crypto";
import { runOutboxAndJobs } from "@/lib/fulfillment";
import { recordAudit } from "@/lib/audit";
import { publishDueScheduledArticles } from "@/lib/blog-schedule";
import { cleanupAnalytics } from "@/lib/retention";
import { cleanupExpiredRateLimitCounters } from "@/lib/rate-limit";
import { monitorCryptoPayments } from "@/lib/payments/crypto/payment-service";
import { loadCryptoPaymentConfig } from "@/lib/payments/crypto/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const headerSecret = request.headers.get("x-internal-job-secret");
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const provided = headerSecret ?? bearer;
  if (!provided) return false;
  return safeEqual(provided, internalJobSecret());
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();

    // Crypto verification is an independent server-side sweep. It must not be
    // skipped when no browser is open, and a missing configuration must not
    // break card fulfillment or the other scheduled jobs.
    let cryptoMonitor: Record<string, unknown> = { configured: false };
    const cryptoConfig = loadCryptoPaymentConfig();
    if (cryptoConfig) {
      try {
        cryptoMonitor = {
          ...(await monitorCryptoPayments(db, { config: cryptoConfig })),
          configured: true,
        };
      } catch (error) {
        console.error(
          "Crypto payment monitor failed",
          error instanceof Error ? error.name : "unknown error",
        );
        cryptoMonitor = { configured: true, error: "monitor_failed" };
      }
    }

    const result = await runOutboxAndJobs(db);
    const scheduled = await publishDueScheduledArticles(db);
    // Retention is owned by data_retention_settings (see lib/retention.ts), not
    // by an environment variable that can drift from the reviewed policy.
    const analyticsCleanup = await cleanupAnalytics(db);
    // Counter cleanup is best-effort: a failure must not roll back or block
    // order fulfilment. Only expired windows are removed.
    let rateLimitCountersDeleted = 0;
    try {
      rateLimitCountersDeleted = await cleanupExpiredRateLimitCounters(db);
    } catch (error) {
      console.error(
        "Rate limit counter cleanup failed",
        error instanceof Error ? error.name : "unknown error",
      );
    }
    await recordAudit(db, {
      actorType: "system",
      action: "jobs.run.api",
      entityType: "fulfillment_job",
      entityId: "batch",
      metadata: {
        cryptoMonitor,
        outboxProcessed: result.outbox.processed,
        outboxFailed: result.outbox.failed,
        jobsProcessed: result.jobs.processed,
        jobsFailed: result.jobs.failed,
        scheduledArticlesPublished: scheduled.published,
        analyticsEventsDeleted: analyticsCleanup.events,
        analyticsSessionsDeleted: analyticsCleanup.sessions,
        analyticsVisitorsDeleted: analyticsCleanup.visitors,
        analyticsRetentionDays: {
          events: analyticsCleanup.policy.eventsDays,
          aggregates: analyticsCleanup.policy.aggregatesDays,
        },
        analyticsCleanupEnabled: {
          events: analyticsCleanup.policy.eventsEnabled,
          aggregates: analyticsCleanup.policy.aggregatesEnabled,
        },
        rateLimitCountersDeleted,
      },
    });
    return NextResponse.json({
      ok: true,
      ...result,
      cryptoMonitor,
      scheduledArticlesPublished: scheduled.published,
      analyticsCleanup,
      rateLimitCountersDeleted,
    });
  } catch (error) {
    console.error("Job run failed", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json({ error: "Job run failed" }, { status: 500 });
  }
}
