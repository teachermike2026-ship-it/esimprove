import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  esims,
  orderEvents,
  orderItems,
  orders,
  paymentProviderCases,
  payments,
  webhookEvents,
} from "@/lib/db/schema";
import { alertAdmin } from "@/lib/admin-alerts";
import { newId } from "@/lib/ids";
import { sha256Hex } from "@/lib/crypto";
import { recordAudit } from "@/lib/audit";
import {
  applyPaymentEvent,
  isUniqueViolation,
  type WebhookResult,
} from "@/lib/payments";
import {
  WHOP_WEBHOOK_API_VERSION_DATE,
  decimalNumberToMinor,
  parseWhopWebhook,
  type WhopCaseEvent,
} from "@/lib/integrations/payment/whop-webhook";
import { canTransitionPayment, type PaymentStatus } from "@/lib/state";
import { getWhopRuntimeConfig } from "@/lib/integrations/payment/whop";

const PROVIDER = "whop";

export interface WhopWebhookResult extends Partial<WebhookResult> {
  ok: true;
  duplicate: boolean;
  eventType: string;
  ignored?: string;
  caseId?: string;
}

class DuplicateWebhookError extends Error {}

/** Refund statuses (Whop `RefundStatuses`) that mean money has been returned. */
const REFUND_SETTLED = new Set(["succeeded"]);
/** Dispute statuses after which the dispute is closed in the merchant's favour. */
const DISPUTE_WON = new Set(["won"]);

/**
 * Entry point for POST /api/webhooks/whop after the secret is known.
 *
 * Every handled event is deduplicated on the signed `webhook-id` header in
 * `webhook_events`. Refund and dispute events are stored in
 * `payment_provider_cases` and may move the payment/order to a risk status
 * (refunded, partially_refunded, disputed). They never insert an outbox row,
 * so they can never trigger fulfillment; and because fulfillment refuses any
 * order whose payment status is not exactly `paid`, a refund or dispute also
 * holds an eSIM that has not been delivered yet.
 */
export async function handleWhopWebhook(
  db: Database,
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
  options: { runFulfillment?: boolean } = {},
): Promise<WhopWebhookResult> {
  const parsed = parseWhopWebhook(rawBody, headers, secret);
  const payloadHash = sha256Hex(rawBody);

  if (parsed.apiVersionDate !== WHOP_WEBHOOK_API_VERSION_DATE) {
    // The payload still passed strict schema validation; log so the endpoint
    // pin can be corrected. Never log payload contents.
    console.warn(
      `Whop webhook api_version_date is ${parsed.apiVersionDate ?? "unpinned"}; expected ${WHOP_WEBHOOK_API_VERSION_DATE}`,
    );
  }

  if (parsed.kind === "payment") {
    const event = { ...parsed.event };
    const expectedProduct = getWhopRuntimeConfig().productId;
    if (
      event.type === "payment.succeeded" &&
      !event.reviewReason &&
      expectedProduct &&
      event.productId &&
      event.productId !== expectedProduct
    ) {
      event.reviewReason = "Payment is for a different Whop product than WHOP_PRODUCT_ID";
    }
    const result = await applyPaymentEvent(db, PROVIDER, event, payloadHash, {
      runFulfillment: options.runFulfillment,
    });
    return { ...result, ok: true };
  }

  if (parsed.kind === "ignored") {
    const claimed = await claimEvent(db, parsed.webhookId, parsed.type, payloadHash);
    return { ok: true, duplicate: !claimed, eventType: parsed.type, ignored: parsed.reason };
  }

  return applyCaseEvent(db, parsed.webhookId, parsed.type, parsed.caseEvent, payloadHash);
}

/** Record an acknowledged-but-ignored event so retries are recognised. */
async function claimEvent(
  db: Database,
  webhookId: string,
  eventType: string,
  payloadHash: string,
): Promise<boolean> {
  try {
    await db.insert(webhookEvents).values({
      id: newId("webhook"),
      provider: PROVIDER,
      externalEventId: webhookId,
      eventType,
      payloadHash,
      processedAt: new Date(),
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

async function applyCaseEvent(
  db: Database,
  webhookId: string,
  eventType: string,
  caseEvent: WhopCaseEvent,
  payloadHash: string,
): Promise<WhopWebhookResult> {
  const duplicate: WhopWebhookResult = { ok: true, duplicate: true, eventType };

  // Locate the ESIMPROVE payment: signed metadata first, then the provider
  // payment ID that the payment.succeeded webhook stored.
  let payment: typeof payments.$inferSelect | undefined;
  if (caseEvent.internalPaymentId && caseEvent.orderId) {
    payment = (
      await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, caseEvent.internalPaymentId),
            eq(payments.orderId, caseEvent.orderId),
            eq(payments.provider, PROVIDER),
          ),
        )
        .limit(1)
    )[0];
  }
  if (!payment && caseEvent.providerPaymentId) {
    payment = (
      await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.provider, PROVIDER),
            eq(payments.providerPaymentId, caseEvent.providerPaymentId),
          ),
        )
        .limit(1)
    )[0];
  }
  if (!payment) {
    // Refund/dispute for a sale ESIMPROVE did not create (other products on
    // the same Whop account). Acknowledge without storing customer data.
    const claimed = await claimEvent(db, webhookId, eventType, payloadHash);
    return {
      ok: true,
      duplicate: !claimed,
      eventType,
      ignored: "case does not belong to an ESIMPROVE payment",
    };
  }

  const amountMinor = decimalNumberToMinor(caseEvent.amount, caseEvent.currency);
  let reviewReason: string | null = null;
  let excessNote = "";
  if (amountMinor === null) {
    reviewReason = "Case amount is not an exact amount in its currency";
  } else if (caseEvent.currency !== payment.currency.toUpperCase()) {
    reviewReason = "Case currency differs from the payment currency";
  } else if (amountMinor > payment.amountMinor * 2) {
    reviewReason = "Case amount is more than twice the payment amount";
  } else if (amountMinor > payment.amountMinor) {
    // Whop refunds what the buyer was charged in their own currency, which
    // can convert back to slightly more than our USD price (sandbox: $4.71
    // for a $4.28 order). That is a full refund, not a reason to hold it.
    excessNote = ` Whop reported ${amountMinor} minor units for a ${payment.amountMinor} payment (buyer currency conversion); treated as a full refund.`;
  }

  let caseId = "";
  let alert: { kind: "payment.disputed" | "payment.refunded" | "payment.review_required"; summary: string } | null =
    null;
  try {
    await db.transaction(async (tx) => {
      try {
        await tx.insert(webhookEvents).values({
          id: newId("webhook"),
          provider: PROVIDER,
          externalEventId: webhookId,
          eventType,
          payloadHash,
          processedAt: new Date(),
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new DuplicateWebhookError();
        throw error;
      }

      const now = new Date();
      const upserted = await tx
        .insert(paymentProviderCases)
        .values({
          id: newId("case"),
          provider: PROVIDER,
          kind: caseEvent.kind,
          providerCaseId: caseEvent.providerCaseId,
          providerPaymentId: caseEvent.providerPaymentId,
          paymentId: payment.id,
          orderId: payment.orderId,
          amountMinor,
          currency: caseEvent.currency,
          providerStatus: caseEvent.status,
          reason: caseEvent.reason,
          needsReview: reviewReason !== null,
          reviewReason,
          lastWebhookId: webhookId,
          metadata: { lastEventType: eventType },
        })
        .onConflictDoUpdate({
          target: [
            paymentProviderCases.provider,
            paymentProviderCases.kind,
            paymentProviderCases.providerCaseId,
          ],
          set: {
            amountMinor,
            currency: caseEvent.currency,
            providerStatus: caseEvent.status,
            reason: caseEvent.reason,
            needsReview: reviewReason !== null,
            reviewReason,
            lastWebhookId: webhookId,
            metadata: { lastEventType: eventType },
            updatedAt: now,
          },
        })
        .returning({ id: paymentProviderCases.id });
      caseId = upserted[0]?.id ?? "";

      const current = (
        await tx.select().from(payments).where(eq(payments.id, payment.id)).limit(1)
      )[0]!;
      const currentStatus = current.status as PaymentStatus;
      let nextStatus: PaymentStatus | null = null;
      let message: string;

      if (reviewReason) {
        message = `Provider ${caseEvent.kind} ${caseEvent.providerCaseId} needs manual review: ${reviewReason}.`;
      } else if (caseEvent.kind === "refund") {
        if (REFUND_SETTLED.has(caseEvent.status)) {
          const refunded = await tx
            .select({ total: sql<string>`coalesce(sum(${paymentProviderCases.amountMinor}), 0)` })
            .from(paymentProviderCases)
            .where(
              and(
                eq(paymentProviderCases.paymentId, payment.id),
                eq(paymentProviderCases.kind, "refund"),
                eq(paymentProviderCases.providerStatus, "succeeded"),
                eq(paymentProviderCases.needsReview, false),
              ),
            );
          const refundedMinor = Number(refunded[0]?.total ?? 0);
          nextStatus = refundedMinor >= payment.amountMinor ? "refunded" : "partially_refunded";
          message = `Whop refund ${caseEvent.providerCaseId} succeeded (${refundedMinor} of ${payment.amountMinor} minor units refunded).${excessNote}`;
        } else {
          message = `Whop refund ${caseEvent.providerCaseId} is ${caseEvent.status}. Payment status unchanged until it succeeds.`;
        }
      } else if (DISPUTE_WON.has(caseEvent.status)) {
        message = `Whop dispute ${caseEvent.providerCaseId} was won. Payment stays disputed until reviewed manually.`;
      } else {
        nextStatus = "disputed";
        message = `Whop dispute ${caseEvent.providerCaseId} is ${caseEvent.status}${
          caseEvent.reason ? ` (${caseEvent.reason})` : ""
        }. Fulfillment is held while the payment is disputed.`;
      }

      let applied = false;
      if (reviewReason) {
        alert = { kind: "payment.review_required", summary: message };
      }
      if (nextStatus && nextStatus !== currentStatus) {
        if (canTransitionPayment(currentStatus, nextStatus)) {
          await tx
            .update(payments)
            .set({ status: nextStatus, updatedAt: now })
            .where(and(eq(payments.id, payment.id), eq(payments.status, currentStatus)));
          // Mirror onto the order only when this payment is the one that paid it.
          await tx
            .update(orders)
            .set({ paymentStatus: nextStatus, updatedAt: now })
            .where(and(eq(orders.id, payment.orderId), eq(orders.paymentStatus, currentStatus)));
          applied = true;
          if (nextStatus === "disputed") {
            alert = { kind: "payment.disputed", summary: message };
          } else if (nextStatus === "refunded" || nextStatus === "partially_refunded") {
            // The customer has their money back: flag every eSIM of the order
            // so support does not treat it as an active, paid line.
            const items = await tx
              .select({ id: orderItems.id })
              .from(orderItems)
              .where(eq(orderItems.orderId, payment.orderId));
            if (items.length > 0) {
              await tx
                .update(esims)
                .set({ status: "refund_flagged", updatedAt: now })
                .where(inArray(esims.orderItemId, items.map((item) => item.id)));
            }
            alert = {
              kind: "payment.refunded",
              summary: `${message} Any eSIM issued for this order is flagged as refunded.`,
            };
          }
        } else {
          message += ` Status change ${currentStatus} -> ${nextStatus} is not allowed; left for manual review.`;
        }
      }

      await tx.insert(orderEvents).values({
        id: newId("orderevent"),
        orderId: payment.orderId,
        type: reviewReason ? `${caseEvent.kind}.review_required` : `${caseEvent.kind}.${caseEvent.status}`,
        message,
        metadata: {
          provider: PROVIDER,
          webhookId,
          eventType,
          providerCaseId: caseEvent.providerCaseId,
          providerPaymentId: caseEvent.providerPaymentId,
          amountMinor,
          currency: caseEvent.currency,
          providerStatus: caseEvent.status,
          paymentStatusBefore: currentStatus,
          paymentStatusAfter: applied ? nextStatus : currentStatus,
        },
      });
      await recordAudit(tx, {
        actorType: "system",
        action: `payment.${caseEvent.kind}.recorded`,
        entityType: "payment",
        entityId: payment.id,
        metadata: { provider: PROVIDER, providerCaseId: caseEvent.providerCaseId, status: caseEvent.status },
      });
      // Deliberately no outbox insert: refunds and disputes never fulfill.
    });
  } catch (error) {
    if (error instanceof DuplicateWebhookError || isUniqueViolation(error)) return duplicate;
    throw error;
  }

  // Assigned inside the transaction callback, which TypeScript cannot follow.
  const pendingAlert = alert as {
    kind: "payment.disputed" | "payment.refunded" | "payment.review_required";
    summary: string;
  } | null;
  if (pendingAlert) {
    await alertAdmin(db, { kind: pendingAlert.kind, orderId: payment.orderId, summary: pendingAlert.summary });
  }

  return { ok: true, duplicate: false, eventType, orderId: payment.orderId, caseId };
}
