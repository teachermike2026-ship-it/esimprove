"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { fulfillmentJobs, plans, refunds } from "@/lib/db/schema";
import { retryFulfillmentJob, runOutboxAndJobs } from "@/lib/fulfillment";
import { calculateSalePrice } from "@/lib/pricing";
import { applyRefund } from "@/lib/refunds";
import { adminPlanSchema, formString, zodMessage } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

export async function runJobsAction(): Promise<void> {
  const admin = await requireAdmin("/admin/jobs", "orders.write");
  const db = await getDb();
  const result = await runOutboxAndJobs(db);
  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "admin.jobs.run",
    entityType: "fulfillment_job",
    entityId: "batch",
    metadata: {
      outboxProcessed: result.outbox.processed,
      outboxFailed: result.outbox.failed,
      jobsProcessed: result.jobs.processed,
      jobsFailed: result.jobs.failed,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/jobs");
  redirect(
    `/admin/jobs?ran=${result.jobs.processed}&failed=${result.jobs.failed}`,
  );
}

export async function retryJobAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/jobs", "orders.write");
  const jobId = formString(formData, "jobId");
  if (!jobId) redirect("/admin/jobs");
  const db = await getDb();
  await retryFulfillmentJob(db, jobId);
  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "admin.job.retry",
    entityType: "fulfillment_job",
    entityId: jobId,
    metadata: {},
  });
  revalidatePath("/admin");
  revalidatePath("/admin/jobs");
  redirect("/admin/jobs?retried=1");
}

export async function retryOrderJobsAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/orders", "orders.write");
  const orderId = formString(formData, "orderId");
  const orderNumber = formString(formData, "orderNumber");
  if (!orderId || !orderNumber) redirect("/admin/orders");
  const db = await getDb();
  const jobs = await db
    .select({ id: fulfillmentJobs.id })
    .from(fulfillmentJobs)
    .where(
      and(
        eq(fulfillmentJobs.orderId, orderId),
        inArray(fulfillmentJobs.status, ["failed", "queued", "under_investigation"]),
      ),
    );
  for (const job of jobs) {
    await retryFulfillmentJob(db, job.id);
  }
  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "admin.order.retry_jobs",
    entityType: "order",
    entityId: orderId,
    metadata: { jobCount: jobs.length },
  });
  revalidatePath(`/admin/orders/${orderNumber}`);
  revalidatePath("/admin/jobs");
  redirect(`/admin/orders/${encodeURIComponent(orderNumber)}?retried=${jobs.length}`);
}

export async function updatePlanAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/plans", "plans.manage");
  const parsed = adminPlanSchema.safeParse({
    planId: formString(formData, "planId"),
    markupBps: formString(formData, "markupBps"),
    status: formString(formData, "status"),
  });
  if (!parsed.success) {
    redirect(`/admin/plans?error=${encodeURIComponent(zodMessage(parsed.error))}`);
  }

  const db = await getDb();
  const rows = await db.select().from(plans).where(eq(plans.id, parsed.data.planId)).limit(1);
  const plan = rows[0];
  if (!plan) redirect("/admin/plans?error=Plan%20not%20found");

  const priceMinor = calculateSalePrice(plan.costMinor, parsed.data.markupBps);
  await db
    .update(plans)
    .set({
      markupBps: parsed.data.markupBps,
      priceMinor,
      status: parsed.data.status,
      updatedAt: new Date(),
    })
    .where(eq(plans.id, plan.id));
  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "admin.plan.update",
    entityType: "plan",
    entityId: plan.id,
    metadata: {
      previousMarkupBps: plan.markupBps,
      markupBps: parsed.data.markupBps,
      previousStatus: plan.status,
      status: parsed.data.status,
      priceMinor,
      isDemo: plan.isDemo,
    },
  });
  revalidatePath("/admin/plans");
  revalidatePath("/plans");
  revalidatePath(`/plans/${plan.slug}`);
  revalidatePath("/");
  redirect(`/admin/plans?updated=${encodeURIComponent(plan.slug)}`);
}

export async function approveRefundAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/refunds", "refunds.write");
  const refundId = formString(formData, "refundId");
  if (!refundId) redirect("/admin/refunds");
  const db = await getDb();
  const refundRows = await db.select().from(refunds).where(eq(refunds.id, refundId)).limit(1);
  const refund = refundRows[0];
  if (!refund) redirect("/admin/refunds");
  if (refund.status !== "requested") {
    redirect(`/admin/refunds?error=${encodeURIComponent("Refund already processed")}`);
  }
  try {
    await applyRefund(db, refund.id, { actorType: "admin", actorId: admin.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund could not be approved";
    redirect(`/admin/refunds?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/refunds");
  redirect("/admin/refunds?processed=1");
}
