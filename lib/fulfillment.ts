import { and, asc, eq, isNull, lt, lte, or } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  emailEvents,
  esims,
  fulfillmentJobs,
  orderEvents,
  orderItems,
  orders,
  supplierTransactions,
} from "@/lib/db/schema";
import { getSupplierAdapter } from "@/lib/integrations/supplier";
import { getEmailTransport } from "@/lib/integrations/email";
import { encryptSecret } from "@/lib/crypto";
import { createOrderAccessToken } from "@/lib/orders";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { siteUrl } from "@/lib/config";
import type { FulfillmentStatus, OrderStatus } from "@/lib/state";

export interface FulfillmentRunResult {
  processed: number;
  failed: number;
  message: string;
}

function backoffSeconds(attempts: number): number {
  const base = Number(process.env.JOB_BACKOFF_BASE_SECONDS || "30");
  return Math.min(900, base * 2 ** Math.min(attempts, 5));
}

/**
 * Recompute the order-level status from every item job. A multi-item order is
 * only "delivered" when every item has been delivered; one failed item keeps
 * the order in "needs attention" even if another item succeeded.
 */
async function refreshOrderStatus(db: Database, orderId: string): Promise<void> {
  const jobs = await db
    .select({ status: fulfillmentJobs.status })
    .from(fulfillmentJobs)
    .where(eq(fulfillmentJobs.orderId, orderId));
  if (jobs.length === 0) return;

  const statuses = jobs.map((job) => job.status);
  let fulfillmentStatus: FulfillmentStatus;
  let orderStatus: OrderStatus;

  if (statuses.every((status) => status === "delivered")) {
    fulfillmentStatus = "delivered";
    orderStatus = "delivered";
  } else if (
    statuses.some((status) => status === "failed" || status === "under_investigation")
  ) {
    fulfillmentStatus = "failed";
    orderStatus = "failed";
  } else if (statuses.some((status) => status === "provisioning")) {
    fulfillmentStatus = "provisioning";
    orderStatus = "processing";
  } else if (statuses.some((status) => status === "queued")) {
    fulfillmentStatus = "queued";
    orderStatus = "processing";
  } else if (statuses.every((status) => status === "cancelled")) {
    fulfillmentStatus = "cancelled";
    orderStatus = "cancelled";
  } else if (statuses.some((status) => status === "ready")) {
    fulfillmentStatus = "ready";
    orderStatus = "processing";
  } else {
    fulfillmentStatus = "not_started";
    orderStatus = "processing";
  }

  await db
    .update(orders)
    .set({ fulfillmentStatus, status: orderStatus, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

async function markJobFailure(
  db: Database,
  job: typeof fulfillmentJobs.$inferSelect,
  orderId: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const attempts = job.attempts;
  const exhausted = attempts >= job.maxAttempts;
  await db
    .update(fulfillmentJobs)
    .set({
      status: exhausted ? "failed" : "queued",
      lastError: message.slice(0, 1_000),
      leaseUntil: null,
      nextAttemptAt: new Date(Date.now() + backoffSeconds(attempts) * 1000),
      updatedAt: new Date(),
    })
    .where(eq(fulfillmentJobs.id, job.id));

  await refreshOrderStatus(db, orderId);

  await db.insert(orderEvents).values({
    id: newId("orderevent"),
    orderId,
    type: exhausted ? "fulfillment.failed" : "fulfillment.retry_scheduled",
    message: exhausted
      ? "Demo fulfillment failed after the maximum attempts. An admin can retry after review."
      : "Demo fulfillment hit a transient error; a retry is scheduled.",
    metadata: { error: message.slice(0, 500), attempts },
  });
}

async function deliverEmail(
  db: Database,
  input: {
    order: typeof orders.$inferSelect;
    accessToken: string;
    itemName: string;
  },
): Promise<void> {
  const path = input.order.userId
    ? `${siteUrl}/portal/orders/${input.order.orderNumber}`
    : `${siteUrl}/orders/${input.order.orderNumber}?token=${input.accessToken}`;
  const text = [
    `Your demo eSIM for ${input.itemName} is ready.`,
    "",
    "Open your order to view the demo QR code and manual activation code:",
    path,
    "",
    "This is a demo. The activation code uses the reserved .invalid domain and cannot connect to a real network.",
    "No real email was sent. This message was logged locally by the mock email transport.",
  ].join("\n");
  const redacted = text.replace(input.accessToken, "[redacted]");
  const subject = `Your demo eSIM is ready — ${input.order.orderNumber}`;
  const emailId = newId("email");

  await db.insert(emailEvents).values({
    id: emailId,
    orderId: input.order.id,
    template: "esim.delivery",
    recipient: input.order.email,
    subject,
    bodyText: redacted,
    status: "queued",
  });

  try {
    await getEmailTransport().send({
      to: input.order.email,
      subject,
      text,
      template: "esim.delivery",
      orderId: input.order.id,
    });
    await db
      .update(emailEvents)
      .set({ status: "logged", sentAt: new Date() })
      .where(eq(emailEvents.id, emailId));
  } catch (error) {
    await db
      .update(emailEvents)
      .set({
        status: "failed",
        bodyText: `${redacted}\n\nTransport error: ${error instanceof Error ? error.message : String(error)}`,
      })
      .where(eq(emailEvents.id, emailId));
    throw error;
  }
}

export async function runFulfillmentJobs(
  db: Database,
  options: { maxJobs?: number } = {},
): Promise<FulfillmentRunResult> {
  const maxJobs = options.maxJobs ?? 10;
  let processed = 0;
  let failed = 0;

  // A crashed worker can leave a lease behind. Move it to failed so an admin
  // must reconcile before retrying, rather than risking a duplicate order.
  await db
    .update(fulfillmentJobs)
    .set({
      status: "failed",
      lastError: "Worker lease expired; reconcile before retry.",
      leaseUntil: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(fulfillmentJobs.status, "provisioning"),
        lte(fulfillmentJobs.leaseUntil, new Date()),
      ),
    );

  for (let index = 0; index < maxJobs; index += 1) {
    const claimed = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(fulfillmentJobs)
        .where(
          and(
            or(
              eq(fulfillmentJobs.status, "queued"),
              and(
                eq(fulfillmentJobs.status, "failed"),
                lt(fulfillmentJobs.attempts, fulfillmentJobs.maxAttempts),
              ),
            ),
            lte(fulfillmentJobs.nextAttemptAt, new Date()),
            or(isNull(fulfillmentJobs.leaseUntil), lte(fulfillmentJobs.leaseUntil, new Date())),
          ),
        )
        .orderBy(asc(fulfillmentJobs.nextAttemptAt))
        .limit(1)
        .for("update", { skipLocked: true });

      const job = rows[0];
      if (!job) return null;
      if (job.attempts >= job.maxAttempts) return { exhausted: job };
      await tx
        .update(fulfillmentJobs)
        .set({
          status: "provisioning",
          attempts: job.attempts + 1,
          leaseUntil: new Date(Date.now() + 5 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(fulfillmentJobs.id, job.id));
      return { job: { ...job, attempts: job.attempts + 1 } };
    });

    if (!claimed) break;
    if ("exhausted" in claimed && claimed.exhausted) {
      await markJobFailure(
        db,
        claimed.exhausted,
        claimed.exhausted.orderId,
        new Error("Maximum fulfillment attempts reached"),
      );
      failed += 1;
      continue;
    }
    if (!("job" in claimed) || !claimed.job) break;
    const job = claimed.job;

    try {
      const orderRows = await db.select().from(orders).where(eq(orders.id, job.orderId)).limit(1);
      const order = orderRows[0];
      if (!order) throw new Error("Order not found");
      if (order.paymentStatus !== "paid") {
        throw new Error("Order is not paid; fulfillment is blocked");
      }

      const itemRows = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.id, job.orderItemId))
        .limit(1);
      const item = itemRows[0];
      if (!item) throw new Error("Order item not found");

      await db
        .update(orders)
        .set({ fulfillmentStatus: "provisioning", status: "processing", updatedAt: new Date() })
        .where(eq(orders.id, order.id));
      await db.insert(orderEvents).values({
        id: newId("orderevent"),
        orderId: order.id,
        type: "fulfillment.provisioning",
        message: "Mock supplier provisioning started. No real supplier order was placed.",
        metadata: { jobId: job.id, attempt: job.attempts, supplier: "mock" },
      });

      const supplier = getSupplierAdapter();
      const supplierOrder = await supplier.createOrder({
        transactionId: job.idempotencyKey,
        productId: item.supplierProductId,
        planName: item.planName,
        customerEmail: order.email,
        quantity: item.quantity,
      });
      const supplierEsim = supplierOrder.esims[0];
      if (!supplierEsim) throw new Error("Mock supplier returned no eSIM");

      const existingEsim = await db
        .select({ id: esims.id })
        .from(esims)
        .where(eq(esims.orderItemId, item.id))
        .limit(1);

      if (existingEsim.length === 0) {
        const encrypted = encryptSecret(supplierEsim.lpa);
        await db.insert(esims).values({
          id: newId("esim"),
          orderItemId: item.id,
          supplierKey: supplier.key,
          supplierEsimId: supplierEsim.supplierEsimId,
          iccid: supplierEsim.iccid,
          lpaCiphertext: encrypted.ciphertext,
          lpaIv: encrypted.iv,
          lpaTag: encrypted.tag,
          dekWrapped: encrypted.wrappedDek,
          dekIv: encrypted.dekIv,
          dekTag: encrypted.dekTag,
          keyVersion: encrypted.keyVersion,
          status: "ready_to_install",
          expiresAt:
            supplierEsim.expiresAt ??
            new Date(Date.now() + item.validityDays * 24 * 60 * 60 * 1000),
        });
      }

      await db
        .insert(supplierTransactions)
        .values({
          id: newId("suppliertx"),
          supplierKey: supplier.key,
          clientTransactionId: job.idempotencyKey,
          supplierOrderId: supplierOrder.supplierOrderId,
          status: supplierOrder.status,
          payload: supplierOrder.raw ?? { status: supplierOrder.status },
        })
        .onConflictDoNothing();

      const accessToken = await createOrderAccessToken(db, order.id);
      await deliverEmail(db, {
        order,
        accessToken,
        itemName: item.planName,
      });

      await db
        .update(fulfillmentJobs)
        .set({
          status: "delivered",
          leaseUntil: null,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(fulfillmentJobs.id, job.id));

      await refreshOrderStatus(db, order.id);

      await db.insert(orderEvents).values({
        id: newId("orderevent"),
        orderId: order.id,
        type: "fulfillment.delivered",
        message: "Demo eSIM stored with encrypted activation data. Mock delivery email logged.",
        metadata: {
          jobId: job.id,
          supplierOrderId: supplierOrder.supplierOrderId,
          iccid: supplierEsim.iccid,
          demo: true,
        },
      });
      await recordAudit(db, {
        actorType: "system",
        action: "fulfillment.delivered",
        entityType: "order",
        entityId: order.id,
        metadata: { jobId: job.id, supplier: supplier.key, isMock: supplier.isMock },
      });
      processed += 1;
    } catch (error) {
      await markJobFailure(db, job, job.orderId, error);
      failed += 1;
    }
  }

  return {
    processed,
    failed,
    message:
      processed === 0 && failed === 0
        ? "No due fulfillment jobs."
        : `Processed ${processed} job(s); ${failed} failed or scheduled for retry.`,
  };
}

export async function retryFulfillmentJob(db: Database, jobId: string): Promise<void> {
  const rows = await db
    .select()
    .from(fulfillmentJobs)
    .where(eq(fulfillmentJobs.id, jobId))
    .limit(1);
  const job = rows[0];
  if (!job) throw new Error("Job not found");
  if (job.status === "delivered") {
    throw new Error("Delivered jobs cannot be retried; this would duplicate the delivery.");
  }
  if (job.status === "provisioning" && job.leaseUntil && job.leaseUntil > new Date()) {
    throw new Error("Job is currently leased by a worker; wait for the lease to expire.");
  }
  await db
    .update(fulfillmentJobs)
    .set({
      status: "queued",
      attempts: 0,
      nextAttemptAt: new Date(),
      leaseUntil: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(fulfillmentJobs.id, jobId));
  await refreshOrderStatus(db, job.orderId);
  await db.insert(orderEvents).values({
    id: newId("orderevent"),
    orderId: job.orderId,
    type: "fulfillment.admin_retry",
    message: "Admin queued a demo fulfillment retry.",
    metadata: { jobId },
  });
  await recordAudit(db, {
    actorType: "admin",
    action: "fulfillment.retry",
    entityType: "fulfillment_job",
    entityId: jobId,
    metadata: { orderId: job.orderId },
  });
}

export async function runOutboxAndJobs(db: Database): Promise<{
  outbox: { processed: number; failed: number };
  jobs: FulfillmentRunResult;
}> {
  const { dispatchOutbox } = await import("@/lib/outbox");
  const outbox = await dispatchOutbox(db);
  const jobs = await runFulfillmentJobs(db);
  return { outbox, jobs };
}
