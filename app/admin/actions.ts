"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { fulfillmentJobs, orders, refunds, users } from "@/lib/db/schema";
import { retryFulfillmentJob, runOutboxAndJobs } from "@/lib/fulfillment";
import { applyRefund, rejectRefund } from "@/lib/refunds";
import {
  addSupportMessage,
  getSupportTicket,
  updateSupportTicket,
  type SupportCategory,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/support";
import {
  adminRefundRejectSchema,
  adminSupportReplySchema,
  adminSupportUpdateSchema,
  formString,
  zodMessage,
} from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { sendTransactionalEmail } from "@/lib/email-notices";
import {
  refundApprovedEmail,
  refundRejectedEmail,
  supportReplyEmail,
  supportStatusEmail,
} from "@/lib/email-templates";
import { isStaffRole } from "@/lib/auth/roles";

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
  const orderRows = await db.select().from(orders).where(eq(orders.id, refund.orderId)).limit(1);
  const order = orderRows[0];
  if (order) {
    const template = refundApprovedEmail({
      orderNumber: order.orderNumber,
      amountMinor: refund.amountMinor,
      currency: refund.currency,
    });
    await sendTransactionalEmail(db, {
      to: order.email,
      subject: template.subject,
      text: template.text,
      template: "refund.approved",
      orderId: order.id,
    });
    revalidatePath(`/admin/orders/${order.orderNumber}`);
    revalidatePath(`/portal/orders/${order.orderNumber}`);
  }
  revalidatePath("/admin/refunds");
  revalidatePath("/portal");
  redirect("/admin/refunds?processed=1");
}

export async function rejectRefundAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/refunds", "refunds.write");
  const parsed = adminRefundRejectSchema.safeParse({
    refundId: formString(formData, "refundId"),
    note: formString(formData, "note"),
  });
  if (!parsed.success) {
    redirect(`/admin/refunds?error=${encodeURIComponent(zodMessage(parsed.error))}`);
  }
  const db = await getDb();
  const refundRows = await db
    .select()
    .from(refunds)
    .where(eq(refunds.id, parsed.data.refundId))
    .limit(1);
  const refund = refundRows[0];
  if (!refund) redirect("/admin/refunds?error=Refund%20not%20found");
  try {
    await rejectRefund(db, refund.id, {
      note: parsed.data.note,
      actorType: "admin",
      actorId: admin.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund could not be rejected";
    redirect(`/admin/refunds?error=${encodeURIComponent(message)}`);
  }
  const orderRows = await db.select().from(orders).where(eq(orders.id, refund.orderId)).limit(1);
  const order = orderRows[0];
  if (order) {
    const template = refundRejectedEmail({
      orderNumber: order.orderNumber,
      amountMinor: refund.amountMinor,
      currency: refund.currency,
      note: parsed.data.note,
    });
    await sendTransactionalEmail(db, {
      to: order.email,
      subject: template.subject,
      text: template.text,
      template: "refund.rejected",
      orderId: order.id,
    });
    revalidatePath(`/admin/orders/${order.orderNumber}`);
    revalidatePath(`/portal/orders/${order.orderNumber}`);
  }
  revalidatePath("/admin/refunds");
  revalidatePath("/portal");
  redirect("/admin/refunds?rejected=1");
}

async function supportRecipient(
  db: Awaited<ReturnType<typeof getDb>>,
  ticket: { userId: string | null; requesterEmail: string },
): Promise<string | null> {
  if (ticket.userId) {
    const rows = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, ticket.userId))
      .limit(1);
    if (rows[0]?.email) return rows[0].email;
  }
  return ticket.requesterEmail || null;
}

export async function adminReplySupportAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/support", "support.write");
  const parsed = adminSupportReplySchema.safeParse({
    ticketId: formString(formData, "ticketId"),
    message: formString(formData, "message"),
  });
  if (!parsed.success) {
    redirect(`/admin/support?error=${encodeURIComponent(zodMessage(parsed.error))}`);
  }
  const db = await getDb();
  const ticket = await getSupportTicket(db, parsed.data.ticketId);
  if (!ticket) redirect("/admin/support?error=Support%20ticket%20not%20found");
  if (ticket.status === "closed") {
    redirect("/admin/support?error=Reopen%20the%20ticket%20before%20replying");
  }
  try {
    await addSupportMessage(db, {
      ticketId: ticket.id,
      authorType: "staff",
      authorId: admin.id,
      body: parsed.data.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reply could not be recorded";
    redirect(`/admin/support?error=${encodeURIComponent(message)}`);
  }
  const recipient = await supportRecipient(db, ticket);
  if (recipient) {
    const template = supportReplyEmail({ ticketId: ticket.id, subject: ticket.subject });
    await sendTransactionalEmail(db, {
      to: recipient,
      subject: template.subject,
      text: template.text,
      template: "support.reply",
      orderId: ticket.orderId ?? undefined,
    });
  }
  revalidatePath("/admin/support");
  revalidatePath(`/portal/support/${ticket.id}`);
  redirect("/admin/support?replied=1");
}

export async function adminUpdateSupportAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/support", "support.write");
  const parsed = adminSupportUpdateSchema.safeParse({
    ticketId: formString(formData, "ticketId"),
    status: formString(formData, "status"),
    priority: formString(formData, "priority"),
    category: formString(formData, "category"),
    assignedTo: formString(formData, "assignedTo"),
  });
  if (!parsed.success) {
    redirect(`/admin/support?error=${encodeURIComponent(zodMessage(parsed.error))}`);
  }
  const db = await getDb();
  const ticket = await getSupportTicket(db, parsed.data.ticketId);
  if (!ticket) redirect("/admin/support?error=Support%20ticket%20not%20found");

  const assignedTo = parsed.data.assignedTo?.trim() || null;
  if (assignedTo) {
    const agentRows = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, assignedTo))
      .limit(1);
    if (!agentRows[0] || !isStaffRole(agentRows[0].role)) {
      redirect("/admin/support?error=Choose%20a%20valid%20staff%20assignee");
    }
  }

  try {
    await updateSupportTicket(db, {
      ticketId: ticket.id,
      status: parsed.data.status as SupportStatus,
      priority: parsed.data.priority as SupportPriority,
      category: parsed.data.category as SupportCategory,
      assignedTo,
      actorId: admin.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ticket could not be updated";
    redirect(`/admin/support?error=${encodeURIComponent(message)}`);
  }

  if (ticket.status !== parsed.data.status) {
    const recipient = await supportRecipient(db, ticket);
    if (recipient) {
      const template = supportStatusEmail({
        ticketId: ticket.id,
        subject: ticket.subject,
        status: parsed.data.status,
      });
      await sendTransactionalEmail(db, {
        to: recipient,
        subject: template.subject,
        text: template.text,
        template: "support.status",
        orderId: ticket.orderId ?? undefined,
      });
    }
  }
  revalidatePath("/admin/support");
  revalidatePath(`/portal/support/${ticket.id}`);
  redirect("/admin/support?updated=1");
}
