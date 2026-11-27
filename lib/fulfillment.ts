import { and, asc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { alertAdmin } from "@/lib/admin-alerts";
import type { Database } from "@/lib/db/client";
import {
  emailEvents,
  esims,
  fulfillmentJobs,
  orderEvents,
  orderItems,
  orders,
  plans,
  supplierTransactions,
} from "@/lib/db/schema";
import { getSupplierAdapterFor } from "@/lib/integrations/supplier";
import { ProviderError, type SupplierEsim } from "@/lib/integrations/supplier/types";
import { getEmailTransport } from "@/lib/integrations/email";
import { redactSensitiveEmailText } from "@/lib/integrations/email/redact";
import { buildActivation, deliveredOrderItemIds } from "@/lib/esim-activation";
import { encryptSecret, sha256Hex } from "@/lib/crypto";
import { createOrderAccessToken, logActivationAccess } from "@/lib/orders";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { siteUrl } from "@/lib/config";
import type { FulfillmentStatus, OrderStatus } from "@/lib/state";

export interface FulfillmentRunResult {
  processed: number;
  failed: number;
  message: string;
}

/** Recheck interval while the supplier allocates profiles (eSIM Access: up to ~30 s). */
const ALLOCATION_RECHECK_MS = 20_000;

/**
 * Supplier transaction id (eSIM Access allows at most 50 characters). Derived
 * from the job's idempotency key, so every retry for the same order item
 * sends the same id and the supplier deduplicates it.
 */
export function supplierTransactionId(idempotencyKey: string): string {
  return `esp-${sha256Hex(idempotencyKey).slice(0, 40)}`;
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
  } else if (statuses.some((status) => status === "manual_review")) {
    fulfillmentStatus = "manual_review";
    orderStatus = "processing";
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

async function alertNeedsAttention(db: Database, orderId: string, reason: string): Promise<void> {
  const order = (await db.select({ orderNumber: orders.orderNumber }).from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  await alertAdmin(db, {
    kind: "fulfillment.needs_attention",
    orderId,
    orderNumber: order?.orderNumber ?? null,
    summary: `Paid order needs attention: the eSIM could not be issued (${reason}). Retry the job, or refund the payment from the order page.`,
  });
}

async function markJobFailure(
  db: Database,
  job: typeof fulfillmentJobs.$inferSelect,
  orderId: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const attempts = job.attempts;
  // A supplier error that retrying cannot fix (insufficient balance, price
  // change, no stock, ordering disabled, invalid response) needs a person.
  const needsReview = error instanceof ProviderError && !error.retryable;
  const exhausted = attempts >= job.maxAttempts;
  await db
    .update(fulfillmentJobs)
    .set({
      status: needsReview ? "manual_review" : exhausted ? "failed" : "queued",
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
    type: needsReview
      ? "fulfillment.manual_review"
      : exhausted
        ? "fulfillment.failed"
        : "fulfillment.retry_scheduled",
    message:
      needsReview || exhausted
        ? "Your payment is safe. We could not issue the eSIM automatically; our team will review the order."
        : "A temporary error stopped processing; a retry is scheduled.",
    metadata: {
      error: message.slice(0, 500),
      attempts,
      code: error instanceof ProviderError ? error.code : undefined,
    },
  });

  // A paid customer must never be left silently without an eSIM.
  if (needsReview || exhausted) {
    await alertNeedsAttention(
      db,
      orderId,
      error instanceof ProviderError ? error.code : needsReview ? "supplier error" : "retries exhausted",
    );
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * Optional eSIM email: a notification and backup copy of the eSIM, sent only
 * after website delivery is recorded. It carries the QR code (inline image
 * plus a PNG attachment) and the manual activation code, with a link to the
 * order page where the same details always remain available.
 *
 * Safety: the activation code is never written to the email log, database or
 * console (only a redacted copy is stored), and each emailed eSIM is recorded
 * in the activation access log. This function never throws: a disabled,
 * failing or rate-limited provider (for example Resend's free-plan daily cap)
 * is recorded and leaves website delivery untouched.
 */
async function deliverEmail(
  db: Database,
  input: {
    order: typeof orders.$inferSelect;
    orderItemId: string;
    accessToken: string;
    itemName: string;
  },
): Promise<void> {
  const path = input.order.userId
    ? `${siteUrl}/portal/orders/${input.order.orderNumber}`
    : `${siteUrl}/orders/${input.order.orderNumber}?token=${input.accessToken}`;
  const subject = `Your eSIM is ready — ${input.order.orderNumber}`;

  // QR codes and activation codes of the eSIMs just delivered for this item.
  let activations: Array<{ esimId: string; lpa: string; qrBase64: string }> = [];
  try {
    const rows = await db.select().from(esims).where(eq(esims.orderItemId, input.orderItemId));
    for (const row of rows) {
      const { lpa, qrDataUrl } = await buildActivation(row);
      activations.push({ esimId: row.id, lpa, qrBase64: qrDataUrl.replace(/^data:image\/png;base64,/, "") });
    }
  } catch (error) {
    // Fall back to a link-only email; the website still shows the QR code.
    activations = [];
    console.warn("eSIM email: activation details unavailable, sending the order link only", error instanceof Error ? error.name : "error");
  }

  const several = activations.length > 1;
  const textLines = [`Your eSIM for ${input.itemName} is ready.`, ""];
  if (activations.length > 0) {
    textLines.push("Scan the attached QR code on the phone where you want to install the eSIM.");
    activations.forEach((activation, index) => {
      textLines.push("", `${several ? `eSIM ${index + 1} — ` : ""}manual activation code:`, activation.lpa);
    });
    textLines.push("");
  }
  textLines.push(
    "Your QR code and activation details are also always available on your order page:",
    path,
    "",
    "Keep these activation details private. Anyone with the code can install your eSIM.",
  );
  const text = textLines.join("\n");

  const html = [
    `<p>Your eSIM for <strong>${escapeHtml(input.itemName)}</strong> is ready.</p>`,
    ...activations.map(
      (activation, index) =>
        `<div style="margin:16px 0;padding:16px;border:1px solid #e3e8e2;border-radius:12px">` +
        (several ? `<p style="margin:0 0 8px"><strong>eSIM ${index + 1}</strong></p>` : "") +
        `<img src="cid:esim-qr-${index + 1}" width="240" height="240" alt="eSIM QR code${several ? ` ${index + 1}` : ""}" style="display:block">` +
        `<p style="margin:12px 0 4px">Manual activation code:</p>` +
        `<pre style="white-space:pre-wrap;word-break:break-all;font-size:13px;margin:0">${escapeHtml(activation.lpa)}</pre>` +
        `</div>`,
    ),
    `<p>Your QR code and activation details are also always available on <a href="${escapeHtml(path)}">your order page</a>.</p>`,
    `<p style="color:#666">Keep these activation details private. Anyone with the code can install your eSIM.</p>`,
  ].join("");

  const attachments = activations.map((activation, index) => ({
    filename: `esim-qr-${input.order.orderNumber}${several ? `-${index + 1}` : ""}.png`,
    contentBase64: activation.qrBase64,
    contentType: "image/png",
    contentId: `esim-qr-${index + 1}`,
  }));

  // Stored copy: order access token and activation codes removed.
  const redacted = redactSensitiveEmailText(text.replace(input.accessToken, "[redacted]"));
  const emailId = newId("email");

  try {
    await db.insert(emailEvents).values({
      id: emailId,
      orderId: input.order.id,
      template: "esim.delivery",
      recipient: input.order.email,
      subject,
      bodyText: redacted,
      status: "queued",
    });
  } catch (error) {
    console.warn("eSIM email log could not be written; skipping the optional email", error instanceof Error ? error.name : "error");
    return;
  }

  let status: "logged" | "sent" | "failed";
  let failure = "";
  let providerMessageId: string | null = null;
  try {
    const result = await getEmailTransport().send({
      to: input.order.email,
      subject,
      text,
      ...(activations.length > 0 ? { html, attachments } : {}),
      template: "esim.delivery",
      orderId: input.order.id,
    });
    status = result.mode === "live" ? "sent" : "logged";
    providerMessageId = result.mode === "live" ? result.id : null;
  } catch (error) {
    status = "failed";
    failure = redactSensitiveEmailText(error instanceof Error ? error.message : String(error));
    console.warn(
      `eSIM email for order ${input.order.orderNumber} was not sent (${error instanceof Error ? error.name : "error"}); the QR code remains available on the order page.`,
    );
  }

  try {
    await db
      .update(emailEvents)
      .set(
        status === "failed"
          ? {
              status,
              bodyText: `${redacted}\n\nTransport error: ${failure.slice(0, 500)}`,
              providerResponse: failure.slice(0, 500),
            }
          : { status, sentAt: new Date(), providerMessageId },
      )
      .where(eq(emailEvents.id, emailId));
    if (status === "sent") {
      for (const activation of activations) {
        await logActivationAccess(db, {
          esimId: activation.esimId,
          orderId: input.order.id,
          actorType: "email_delivery",
        });
      }
    }
  } catch {
    // Logging only; delivery on the website is unaffected.
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
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        throw new ProviderError("invalid_request", "Order item has an invalid quantity", false);
      }

      // The supplier that sold the plan fulfils it; a real supplier package is
      // never fulfilled with mock data (see getSupplierAdapterFor).
      const supplier = getSupplierAdapterFor(item.supplierKey);

      await db
        .update(orders)
        .set({ fulfillmentStatus: "provisioning", status: "processing", updatedAt: new Date() })
        .where(eq(orders.id, order.id));
      if (job.attempts === 1) {
        await db.insert(orderEvents).values({
          id: newId("orderevent"),
          orderId: order.id,
          type: "fulfillment.provisioning",
          message: "Your eSIM is being prepared.",
          metadata: { jobId: job.id, attempt: job.attempts, supplier: supplier.key },
        });
      }

      // Idempotent purchase: one supplier order per order item, keyed by a
      // stable transaction id. If an earlier attempt already ordered, reuse it.
      const clientTransactionId = supplierTransactionId(job.idempotencyKey);
      const knownTx = (
        await db
          .select()
          .from(supplierTransactions)
          .where(
            and(
              eq(supplierTransactions.supplierKey, supplier.key),
              eq(supplierTransactions.clientTransactionId, clientTransactionId),
            ),
          )
          .limit(1)
      )[0];

      let supplierOrderId: string;
      let supplierEsims: SupplierEsim[] = [];
      if (knownTx) {
        supplierOrderId = knownTx.supplierOrderId;
      } else {
        const plan = (await db.select().from(plans).where(eq(plans.id, item.planId)).limit(1))[0];
        const meta = (plan?.supplierMetadata ?? {}) as Record<string, unknown>;
        const unitCostMinor = item.costMinor / item.quantity;
        const supplierOrder = await supplier.createOrder({
          transactionId: clientTransactionId,
          productId: item.supplierProductId,
          planName: item.planName,
          customerEmail: order.email,
          quantity: item.quantity,
          // Price check against the cost the customer's price was based on: a
          // supplier price change fails safely instead of reducing margin.
          ...(supplier.isMock || !Number.isSafeInteger(unitCostMinor)
            ? {}
            : { unitPriceRaw: unitCostMinor * 100 }),
          ...(meta.dataType === 2 ? { periodNum: item.validityDays } : {}),
        });
        supplierOrderId = supplierOrder.supplierOrderId;
        supplierEsims = supplierOrder.esims;
        await db
          .insert(supplierTransactions)
          .values({
            id: newId("suppliertx"),
            supplierKey: supplier.key,
            clientTransactionId,
            supplierOrderId,
            status: supplierOrder.status,
            payload: { supplierOrderId, status: supplierOrder.status, isMock: supplier.isMock },
          })
          .onConflictDoNothing();
        await db.insert(orderEvents).values({
          id: newId("orderevent"),
          orderId: order.id,
          type: "fulfillment.supplier_ordered",
          message: "The eSIM order was placed with the supplier.",
          metadata: { jobId: job.id, supplier: supplier.key, supplierOrderId },
        });
      }

      // Profiles may be allocated asynchronously (eSIM Access: error 200010).
      if (supplierEsims.length === 0) supplierEsims = await supplier.getEsims(supplierOrderId);

      // Never deliver anything that does not match what the customer paid for.
      if (supplierEsims.length !== item.quantity) {
        throw new ProviderError(
          "profile_count_mismatch",
          `Supplier returned ${supplierEsims.length} profile(s) for quantity ${item.quantity}`,
          false,
        );
      }
      for (const esim of supplierEsims) {
        if (!/^LPA:1\$[^$]+\$[^$]+$/.test(esim.lpa) || !esim.supplierEsimId || !esim.iccid) {
          throw new ProviderError("invalid_response", "Supplier returned an incomplete eSIM profile", false);
        }
      }

      for (const supplierEsim of supplierEsims) {
        const encrypted = encryptSecret(supplierEsim.lpa);
        await db
          .insert(esims)
          .values({
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
          })
          .onConflictDoNothing();
      }

      // Every profile must now be stored for THIS order item. A profile id
      // that already belongs to another item is never silently "delivered".
      const stored = await db
        .select({ supplierEsimId: esims.supplierEsimId, orderItemId: esims.orderItemId })
        .from(esims)
        .where(
          and(
            eq(esims.supplierKey, supplier.key),
            inArray(
              esims.supplierEsimId,
              supplierEsims.map((esim) => esim.supplierEsimId),
            ),
          ),
        );
      const owner = new Map(stored.map((row) => [row.supplierEsimId, row.orderItemId]));
      if (supplierEsims.some((esim) => owner.get(esim.supplierEsimId) !== item.id)) {
        throw new ProviderError(
          "profile_conflict",
          "A supplier profile is already assigned to another order item",
          false,
        );
      }

      await db
        .update(supplierTransactions)
        .set({ status: "delivered" })
        .where(
          and(
            eq(supplierTransactions.supplierKey, supplier.key),
            eq(supplierTransactions.clientTransactionId, clientTransactionId),
          ),
        );

      // Website delivery comes first: once the job is delivered, the QR code
      // is available on the order page. Email is an optional extra channel.
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
        message: "Your eSIM is ready. Activation details are available in your order.",
        metadata: {
          jobId: job.id,
          supplierOrderId,
          profiles: supplierEsims.length,
          supplier: supplier.key,
          demo: supplier.isMock,
        },
      });

      // Optional notification. It runs after delivery is recorded and never
      // throws, so a failed, rate-limited or disabled email provider cannot
      // undo, delay or retry website delivery.
      // Guest orders without an email address skip it entirely.
      if (order.email.trim()) {
        await deliverEmail(db, {
          order,
          orderItemId: item.id,
          accessToken: await createOrderAccessToken(db, order.id),
          itemName: item.quantity > 1 ? `${item.planName} (×${item.quantity})` : item.planName,
        });
      }
      await recordAudit(db, {
        actorType: "system",
        action: "fulfillment.delivered",
        entityType: "order",
        entityId: order.id,
        metadata: { jobId: job.id, supplier: supplier.key, isMock: supplier.isMock },
      });
      processed += 1;
    } catch (error) {
      if (error instanceof ProviderError && error.code === "allocating") {
        // Not a failure: profiles are still being allocated. Check again soon
        // without consuming an attempt or re-ordering.
        await db
          .update(fulfillmentJobs)
          .set({
            status: "queued",
            attempts: Math.max(0, job.attempts - 1),
            leaseUntil: null,
            nextAttemptAt: new Date(Date.now() + ALLOCATION_RECHECK_MS),
            lastError: "Supplier is still allocating the eSIM profile",
            updatedAt: new Date(),
          })
          .where(eq(fulfillmentJobs.id, job.id));
        continue;
      }
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
    message: "Our team queued a retry of your eSIM fulfillment.",
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

/**
 * Admin action: send the eSIM delivery email again for an order that was
 * actually delivered, using the eSIM data stored for it (never generated).
 * Returns how many emails were attempted. Never throws on email failure.
 */
export async function resendDeliveryEmails(db: Database, orderId: string): Promise<{ attempted: number; reason?: string }> {
  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order) return { attempted: 0, reason: "Order not found." };
  if (!order.email.trim()) return { attempted: 0, reason: "This guest order has no email address." };
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const delivered = await deliveredOrderItemIds(db, items.map((item) => item.id));
  const eligible = items.filter((item) => delivered.has(item.id));
  if (eligible.length === 0) return { attempted: 0, reason: "No delivered eSIM exists for this order yet." };
  for (const item of eligible) {
    const stored = await db.select({ id: esims.id }).from(esims).where(eq(esims.orderItemId, item.id)).limit(1);
    if (stored.length === 0) continue;
    await deliverEmail(db, {
      order,
      orderItemId: item.id,
      accessToken: await createOrderAccessToken(db, order.id),
      itemName: item.quantity > 1 ? `${item.planName} (×${item.quantity})` : item.planName,
    });
  }
  return { attempted: eligible.length };
}
