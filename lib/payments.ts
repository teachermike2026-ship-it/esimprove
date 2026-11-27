import { and, eq, ne } from "drizzle-orm";
import type { Database, DatabaseExecutor } from "@/lib/db/client";
import {
  orderEvents,
  orders,
  outboxEvents,
  payments,
  webhookEvents,
} from "@/lib/db/schema";
import { getPaymentProvider } from "@/lib/integrations/payments";
import type { PaymentEvent, PaymentProvider } from "@/lib/integrations/payments/types";
import {
  createMockPaymentEvent,
  signedMockWebhook,
} from "@/lib/integrations/payments/mock";
import { sha256Hex } from "@/lib/crypto";
import { newId } from "@/lib/ids";
import { runOutboxAndJobs } from "@/lib/fulfillment";
import { alertAdmin } from "@/lib/admin-alerts";
import { canTransitionPayment, type PaymentStatus } from "@/lib/state";
import { mockCommerceAllowed } from "@/lib/config";

export interface WebhookResult {
  ok: boolean;
  duplicate: boolean;
  eventType: string;
  orderId?: string;
  fulfillment?: {
    outbox: { processed: number; failed: number };
    jobs: { processed: number; failed: number; message: string };
  };
  fulfillmentError?: string;
  /** Set when the event was recorded but held for manual review. */
  reviewRequired?: string;
  /** True when this event newly queued fulfillment. */
  fulfillmentQueued?: boolean;
}

export interface HandlePaymentWebhookOptions {
  headers?: Record<string, string>;
  provider?: PaymentProvider;
}

export async function getPaymentById(db: Database, paymentId: string) {
  const rows = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  return rows[0] ?? null;
}

export async function getPaymentForOrder(db: DatabaseExecutor, orderId: string) {
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(payments.createdAt)
    .limit(1);
  return rows[0] ?? null;
}

export async function handlePaymentWebhook(
  db: Database,
  rawBody: string,
  signature: string | null,
  options: HandlePaymentWebhookOptions = {},
): Promise<WebhookResult> {
  const provider = options.provider ?? getPaymentProvider();
  const event = provider.verifyWebhook(rawBody, signature, options.headers);
  return applyPaymentEvent(db, provider.key, event, sha256Hex(rawBody));
}

/** PostgreSQL unique_violation, also when wrapped by the driver. */
export function isUniqueViolation(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 4; depth += 1) {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (candidate.code === "23505") return true;
    if (
      typeof candidate.message === "string" &&
      /duplicate key value|unique constraint/i.test(candidate.message)
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

/** Thrown inside a transaction to roll it back when another delivery won the claim. */
class DuplicateWebhookError extends Error {}

/**
 * Apply a verified payment event exactly once.
 *
 * - Deduplication: (provider, eventId) is claimed in `webhook_events` inside
 *   the same transaction as the state change. A concurrent delivery of the
 *   same event hits the unique index and is reported as a duplicate.
 * - An order is marked paid only for `payment.succeeded` whose provider status
 *   (when the provider sends one) is exactly `paid`, whose references match the
 *   stored payment and order, and whose currency and amount match exactly.
 * - Anything unexpected is acknowledged and recorded for manual review; it is
 *   never silently accepted and never queues fulfillment.
 */
export interface ApplyPaymentEventOptions {
  /**
   * Run fulfillment inline after a newly paid order (default true). Webhook
   * routes pass false and run it after responding, so the provider gets a
   * fast 2xx; the scheduled /api/jobs/run worker is the backstop.
   */
  runFulfillment?: boolean;
}

export async function applyPaymentEvent(
  db: Database,
  providerKey: string,
  event: PaymentEvent,
  payloadHash: string,
  options: ApplyPaymentEventOptions = {},
): Promise<WebhookResult> {
  const duplicate = { ok: true, duplicate: true, eventType: event.type, orderId: event.orderId };
  const existing = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(
      and(eq(webhookEvents.provider, providerKey), eq(webhookEvents.externalEventId, event.eventId)),
    )
    .limit(1);
  if (existing.length > 0) return duplicate;

  const internalPaymentRows = event.internalPaymentId
    ? await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, event.internalPaymentId),
            eq(payments.orderId, event.orderId),
            eq(payments.provider, providerKey),
          ),
        )
        .limit(1)
    : [];
  const providerPaymentRows = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.provider, providerKey),
        eq(payments.providerPaymentId, event.paymentId),
        eq(payments.orderId, event.orderId),
      ),
    )
    .limit(1);
  const payment = internalPaymentRows[0] ?? providerPaymentRows[0];
  if (!payment) throw new Error("Webhook references an unknown payment");
  if (payment.providerPaymentId !== event.paymentId && event.internalPaymentId !== payment.id) {
    throw new Error("Webhook payment reference does not match the stored payment");
  }

  const orderRows = await db.select().from(orders).where(eq(orders.id, event.orderId)).limit(1);
  const order = orderRows[0];
  if (!order) throw new Error("Webhook references an unknown order");

  if (event.type === "payment.pending") {
    // Processing or waiting for the buyer (for example 3-D Secure). Logged
    // once for support and admin; never changes payment or order status.
    try {
      await db.transaction(async (tx) => {
        try {
          await tx.insert(webhookEvents).values({
            id: newId("webhook"),
            provider: providerKey,
            externalEventId: event.eventId,
            eventType: event.type,
            payloadHash,
            processedAt: new Date(),
          });
        } catch (error) {
          if (isUniqueViolation(error)) throw new DuplicateWebhookError();
          throw error;
        }
        await tx.insert(orderEvents).values({
          id: newId("orderevent"),
          orderId: order.id,
          type: "payment.pending",
          message: "Payment is processing or waiting for the customer to finish (for example card authentication).",
          metadata: {
            provider: providerKey,
            eventId: event.eventId,
            providerPaymentId: event.paymentId,
            providerStatus: event.providerStatus,
          },
        });
      });
    } catch (error) {
      if (error instanceof DuplicateWebhookError || isUniqueViolation(error)) return duplicate;
      throw error;
    }
    return { ok: true, duplicate: false, eventType: event.type, orderId: event.orderId };
  }

  // Reasons that hold a success event for review instead of marking it paid.
  let reviewReason: string | undefined;
  if (event.type === "payment.succeeded") {
    if (event.reviewReason) {
      reviewReason = event.reviewReason;
    } else if (event.providerStatus !== undefined && event.providerStatus !== "paid") {
      reviewReason = `Provider payment status is "${event.providerStatus || "empty"}", not "paid"`;
    } else if (payment.currency.toUpperCase() !== event.currency.toUpperCase()) {
      reviewReason = "Payment currency does not match the order currency";
    } else if (event.subtotalMinor !== undefined && event.subtotalMinor !== payment.amountMinor) {
      reviewReason = "Provider price (subtotal) does not match the order price";
    } else if (event.amountMinor < payment.amountMinor) {
      reviewReason = "Amount received is lower than the order price (discount or partial payment)";
    } else if (event.amountMinor > payment.amountMinor) {
      reviewReason = "Amount received is higher than the order price";
    } else if (
      event.checkoutConfigurationId &&
      payment.providerPaymentId.startsWith("ch_") &&
      event.checkoutConfigurationId !== payment.providerPaymentId
    ) {
      reviewReason = "Payment came from a different checkout than the one created for this order";
    }
  } else if (payment.currency.toUpperCase() !== event.currency.toUpperCase()) {
    // Failed payments move no money, but never trust a mismatched reference.
    reviewReason = "Failed-payment currency does not match the order currency";
  }

  if (payment.status === "paid" && event.type === "payment.succeeded" && !reviewReason) {
    return duplicate;
  }
  if (payment.status === "failed" && event.type === "payment.failed") return duplicate;

  const nextPaymentStatus: PaymentStatus =
    event.type === "payment.succeeded" ? "paid" : "failed";
  if (!reviewReason && !canTransitionPayment(payment.status as PaymentStatus, nextPaymentStatus)) {
    reviewReason = `Ignored ${event.type}: payment is already ${payment.status}`;
  }

  // Hosted providers may create the local payment row before the provider
  // payment exists (for example, a Whop checkout configuration `ch_...`).
  // The verified webhook carries the real provider payment ID (`pay_...`);
  // retaining the original reference in the audit event preserves both.
  const providerPaymentId =
    payment.providerPaymentId === event.paymentId ? undefined : event.paymentId;
  const checkoutReference =
    payment.providerPaymentId === event.paymentId ? undefined : payment.providerPaymentId;
  const eventMetadata = {
    provider: providerKey,
    eventId: event.eventId,
    providerPaymentId: event.paymentId,
    checkoutReference,
    amountMinor: event.amountMinor,
    expectedAmountMinor: payment.amountMinor,
    currency: event.currency,
    providerStatus: event.providerStatus,
    // Whop buyers may pay with a different email than the order email; this
    // is informational for support and never blocks or stores the address.
    customerEmailMatchesOrder:
      event.customerEmail == null
        ? undefined
        : event.customerEmail.trim().toLowerCase() === order.email.trim().toLowerCase(),
  };

  let queuedFulfillment = false;
  try {
    await db.transaction(async (tx) => {
      // Claim the event first. Unique (provider, external_event_id) makes a
      // concurrent duplicate fail here and roll back without side effects.
      try {
        await tx.insert(webhookEvents).values({
          id: newId("webhook"),
          provider: providerKey,
          externalEventId: event.eventId,
          eventType: event.type,
          payloadHash,
          processedAt: new Date(),
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new DuplicateWebhookError();
        throw error;
      }

      if (reviewReason) {
        await tx.insert(orderEvents).values({
          id: newId("orderevent"),
          orderId: order.id,
          type: "payment.review_required",
          message: `Payment event held for manual review: ${reviewReason}. The order was not marked paid.`,
          metadata: { ...eventMetadata, eventType: event.type, reason: reviewReason },
        });
        return;
      }

      if (event.type === "payment.succeeded") {
        // Conditional transition: only one concurrent delivery can move this
        // payment to paid, so fulfillment is queued at most once per payment.
        const updatedPayments = await tx
          .update(payments)
          .set({
            status: "paid",
            ...(providerPaymentId ? { providerPaymentId } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(payments.id, payment.id), ne(payments.status, "paid")))
          .returning({ id: payments.id });
        if (updatedPayments.length === 0) return;

        const currentOrder = await tx
          .select({ paymentStatus: orders.paymentStatus })
          .from(orders)
          .where(eq(orders.id, order.id))
          .limit(1);
        const orderPaymentStatus = currentOrder[0]?.paymentStatus;
        if (orderPaymentStatus !== "pending" && orderPaymentStatus !== "failed") {
          // Already paid (for example by crypto), refunded or disputed: keep
          // this payment recorded for a refund, but never re-open fulfillment.
          await tx.insert(orderEvents).values({
            id: newId("orderevent"),
            orderId: order.id,
            type: "payment.duplicate",
            message:
              "A second payment was confirmed for an order that was not awaiting payment. Manual refund review is required.",
            metadata: { ...eventMetadata, orderPaymentStatus },
          });
          return;
        }

        await tx
          .update(orders)
          .set({
            paymentStatus: "paid",
            status: "processing",
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
        await tx.insert(orderEvents).values({
          id: newId("orderevent"),
          orderId: order.id,
          type: "payment.succeeded",
          message: "Payment confirmed.",
          metadata: eventMetadata,
        });
        await tx.insert(outboxEvents).values({
          id: newId("outbox"),
          topic: "fulfillment.requested",
          aggregateType: "order",
          aggregateId: order.id,
          payload: { orderId: order.id, eventId: event.eventId },
        });
        queuedFulfillment = true;
        return;
      }

      // Keep the checkout reference (`ch_...`): the customer may retry in the
      // same hosted checkout and a later verified success must still match it.
      await tx
        .update(payments)
        .set({ status: "failed", updatedAt: new Date() })
        .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")));
      await tx
        .update(orders)
        .set({ paymentStatus: "failed", status: "failed", updatedAt: new Date() })
        // A failed card attempt must not undo an order already paid by
        // another method (for example crypto).
        .where(and(eq(orders.id, order.id), eq(orders.paymentStatus, "pending")));
      await tx.insert(orderEvents).values({
        id: newId("orderevent"),
        orderId: order.id,
        type: "payment.failed",
        message: "Payment could not be confirmed.",
        metadata: eventMetadata,
      });
    });
  } catch (error) {
    if (error instanceof DuplicateWebhookError || isUniqueViolation(error)) return duplicate;
    throw error;
  }

  let fulfillment: WebhookResult["fulfillment"];
  let fulfillmentError: string | undefined;
  if (queuedFulfillment && options.runFulfillment !== false) {
    try {
      fulfillment = await runOutboxAndJobs(db);
    } catch (error) {
      fulfillmentError = error instanceof Error ? error.message : String(error);
    }
  }

  if (reviewReason && event.type === "payment.succeeded") {
    await alertAdmin(db, {
      kind: "payment.review_required",
      orderId: order.id,
      orderNumber: order.orderNumber,
      summary: `A payment was received but held for review and NOT fulfilled: ${reviewReason}.`,
    });
  }

  return {
    ok: true,
    duplicate: false,
    eventType: event.type,
    orderId: event.orderId,
    reviewRequired: reviewReason,
    fulfillmentQueued: queuedFulfillment,
    fulfillment,
    fulfillmentError,
  };
}

export async function simulateMockPayment(
  db: Database,
  paymentId: string,
  outcome: "success" | "failure",
): Promise<WebhookResult> {
  if (!mockCommerceAllowed) {
    throw new Error("Mock payments are disabled in this deployment");
  }
  const payment = await getPaymentById(db, paymentId);
  if (!payment) throw new Error("Payment not found");
  const event = createMockPaymentEvent({
    paymentId: payment.providerPaymentId,
    orderId: payment.orderId,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    type: outcome === "success" ? "payment.succeeded" : "payment.failed",
  });
  const signed = signedMockWebhook(event);
  return handlePaymentWebhook(db, signed.rawBody, signed.signature);
}
