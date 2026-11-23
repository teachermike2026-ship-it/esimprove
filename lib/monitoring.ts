import { and, count, desc, eq, gt, like, ne, or } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  auditLogs,
  emailEvents,
  fulfillmentJobs,
  payments,
  refunds,
  supportTickets,
} from "@/lib/db/schema";

export type HealthState = "ok" | "attention";

export interface HealthCheck {
  id: string;
  label: string;
  value: number;
  detail: string;
  state: HealthState;
  action: string;
}

export interface OperationalHealth {
  checkedAt: Date;
  checks: HealthCheck[];
  attentionCount: number;
}

/**
 * Read-only operational snapshot derived from this datastore. It deliberately
 * does not page, email, or claim a threshold SLO: no alerting integration is
 * configured. Each check describes what an operator should look at next.
 */
export async function getOperationalHealth(db: Database): Promise<OperationalHealth> {
  const [
    queuedJobs,
    failedJobs,
    failingJobs,
    failedEmails,
    failedPayments,
    pendingRefunds,
    openTickets,
  ] = await Promise.all([
    db.select({ value: count() }).from(fulfillmentJobs).where(eq(fulfillmentJobs.status, "queued")),
    db.select({ value: count() }).from(fulfillmentJobs).where(eq(fulfillmentJobs.status, "failed")),
    db
      .select({ value: count() })
      .from(fulfillmentJobs)
      .where(and(ne(fulfillmentJobs.status, "succeeded"), gt(fulfillmentJobs.attempts, 2))),
    db.select({ value: count() }).from(emailEvents).where(eq(emailEvents.status, "failed")),
    db.select({ value: count() }).from(payments).where(eq(payments.status, "failed")),
    db.select({ value: count() }).from(refunds).where(eq(refunds.status, "requested")),
    db
      .select({ value: count() })
      .from(supportTickets)
      .where(or(eq(supportTickets.status, "open"), eq(supportTickets.status, "pending_staff"))),
  ]);

  const num = (rows: { value: number }[]) => Number(rows[0]?.value ?? 0);
  const checks: HealthCheck[] = [
    {
      id: "jobs-queued",
      label: "Fulfillment jobs queued",
      value: num(queuedJobs),
      detail: "Jobs waiting to be claimed by the fulfillment runner.",
      state: num(queuedJobs) > 25 ? "attention" : "ok",
      action: "Check the Fulfillment jobs queue and run the retry action if a supplier call failed.",
    },
    {
      id: "jobs-failed",
      label: "Fulfillment jobs failed",
      value: num(failedJobs),
      detail: "Jobs that exhausted retries or were parked for review.",
      state: num(failedJobs) > 0 ? "attention" : "ok",
      action: "Open Orders, inspect the job, and retry once the cause is fixed.",
    },
    {
      id: "jobs-retrying",
      label: "Jobs with repeated attempts",
      value: num(failingJobs),
      detail: "Jobs that have needed more than two delivery attempts.",
      state: num(failingJobs) > 0 ? "attention" : "ok",
      action: "Inspect lastError on the job and confirm the mock supplier behavior.",
    },
    {
      id: "emails-failed",
      label: "Failed email events",
      value: num(failedEmails),
      detail: "Transactional email records whose transport reported a failure.",
      state: num(failedEmails) > 0 ? "attention" : "ok",
      action: "Check the Email log. Delivery is local/mock unless a live provider is configured.",
    },
    {
      id: "payments-failed",
      label: "Failed payments",
      value: num(failedPayments),
      detail: "Mock payment records in a failed state.",
      state: num(failedPayments) > 0 ? "attention" : "ok",
      action: "Review Payments. No money moves in this build.",
    },
    {
      id: "refunds-pending",
      label: "Refund requests awaiting review",
      value: num(pendingRefunds),
      detail: "Customer refund requests that need an administrator decision.",
      state: num(pendingRefunds) > 0 ? "attention" : "ok",
      action: "Open Refunds and approve or reject with a reason.",
    },
    {
      id: "support-open",
      label: "Open support conversations",
      value: num(openTickets),
      detail: "Tickets waiting on the operator or the customer.",
      state: num(openTickets) > 10 ? "attention" : "ok",
      action: "Open Support and reply, assign, or resolve the tickets.",
    },
  ];

  return {
    checkedAt: new Date(),
    checks,
    attentionCount: checks.filter((check) => check.state === "attention").length,
  };
}

export async function listRecentAttentionEvents(db: Database, limit = 20) {
  return db
    .select()
    .from(auditLogs)
    .where(
      or(
        like(auditLogs.action, "%failed%"),
        like(auditLogs.action, "%rejected%"),
        like(auditLogs.action, "%error%"),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
