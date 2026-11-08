import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { internalJobSecret } from "@/lib/config";
import { safeEqual } from "@/lib/crypto";
import { runOutboxAndJobs } from "@/lib/fulfillment";
import { recordAudit } from "@/lib/audit";
import { publishDueScheduledArticles } from "@/lib/blog-schedule";
import { cleanupAnalytics } from "@/lib/analytics-web";

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
    const result = await runOutboxAndJobs(db);
    const scheduled = await publishDueScheduledArticles(db);
    const retentionDays = Number(process.env.ANALYTICS_RETENTION_DAYS ?? "90");
    const analyticsCleanup = await cleanupAnalytics(
      db,
      Number.isFinite(retentionDays) ? retentionDays : 90,
    );
    await recordAudit(db, {
      actorType: "system",
      action: "jobs.run.api",
      entityType: "fulfillment_job",
      entityId: "batch",
      metadata: {
        outboxProcessed: result.outbox.processed,
        outboxFailed: result.outbox.failed,
        jobsProcessed: result.jobs.processed,
        jobsFailed: result.jobs.failed,
        scheduledArticlesPublished: scheduled.published,
        analyticsEventsDeleted: analyticsCleanup.events,
        analyticsSessionsDeleted: analyticsCleanup.sessions,
        analyticsVisitorsDeleted: analyticsCleanup.visitors,
      },
    });
    return NextResponse.json({
      ok: true,
      ...result,
      scheduledArticlesPublished: scheduled.published,
      analyticsCleanup,
    });
  } catch (error) {
    console.error("Job run failed", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json({ error: "Job run failed" }, { status: 500 });
  }
}
