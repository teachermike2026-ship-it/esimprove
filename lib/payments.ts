import { and, eq } from "drizzle-orm";
import type { Database, DatabaseExecutor } from "@/lib/db/client";
import {
  orderEvents,
  orders,
  outboxEvents,
  payments,
  webhookEvents,
} from "@/lib/db/schema";
import { getPaymentProvider } from "@/lib/integrations/payments";
import type { PaymentProvider } from "@/lib/integrations/payments/types";
import {
  createMockPaymentEvent,
  signedMockWebhook,
} from "@/lib/integrations/payments/mock";
import { sha256Hex } from "@/lib/crypto";
import { newId } from "@/lib/ids";
import { runOutboxAndJobs } from "@/lib/fulfillment";
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
  const payloadHash = sha256Hex(rawBody);

  const existing = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.provider, provider.key),
        eq(webhookEvents.externalEventId, event.eventId),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return { ok: true, duplicate: true, eventType: event.type, orderId: event.orderId };
  }

  const internalPaymentRows = event.internalPaymentId
    ? await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, event.internalPaymentId),
            eq(payments.orderId, event.orderId),
            eq(payments.provider, provider.key),
          ),
        )
        .limit(1)
    : [];
  const providerPaymentRows = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.provider, provider.key),
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
  if (payment.amountMinor !== event.amountMinor || payment.currency !== event.currency) {
    throw new Error("Webhook amount or currency does not match the stored payment");
  }

  const orderRows = await db.select().from(orders).where(eq(orders.id, event.orderId)).limit(1);
  const order = orderRows[0];
  if (!order) throw new Error("Webhook references an unknown order");

  if (payment.status === "paid" && event.type === "payment.succeeded") {
    return { ok: true, duplicate: true, eventType: event.type, orderId: event.orderId };
  }
  if (payment.status === "failed" && event.type === "payment.failed") {
    return { ok: true, duplicate: true, eventType: event.type, orderId: event.orderId };
  }

  const nextPaymentStatus: PaymentStatus =
    event.type === "payment.succeeded" ? "paid" : "failed";
  if (!canTransitionPayment(payment.status as PaymentStatus, nextPaymentStatus)) {
    throw new Error(
      `Invalid payment transition from ${payment.status} to ${nextPaymentStatus} for this webhook`,
    );
  }

  // Hosted providers may create the local payment row before the provider
  // payment exists (for example, a Whop checkout configuration `ch_...`).
  // The verified webhook carries the real provider payment ID (`pay_...`);
  // retaining the original reference in the audit event preserves both.
  const providerPaymentId =
    payment.providerPaymentId === event.paymentId ? undefined : event.paymentId;
  const checkoutReference =
    payment.providerPaymentId === event.paymentId ? undefined : payment.providerPaymentId;

  await db.transaction(async (tx) => {
    await tx.insert(webhookEvents).values({
      id: newId("webhook"),
      provider: provider.key,
      externalEventId: event.eventId,
      eventType: event.type,
      payloadHash,
      processedAt: new Date(),
    });

    if (event.type === "payment.succeeded") {
      await tx
        .update(payments)
        .set({
          status: "paid",
          ...(providerPaymentId ? { providerPaymentId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
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
        metadata: {
          provider: provider.key,
          eventId: event.eventId,
          providerPaymentId: event.paymentId,
          checkoutReference,
          amountMinor: event.amountMinor,
          currency: event.currency,
        },
      });
      await tx.insert(outboxEvents).values({
        id: newId("outbox"),
        topic: "fulfillment.requested",
        aggregateType: "order",
        aggregateId: order.id,
        payload: { orderId: order.id, eventId: event.eventId },
      });
    } else {
      await tx
        .update(payments)
        .set({
          status: "failed",
          ...(providerPaymentId ? { providerPaymentId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
      await tx
        .update(orders)
        .set({
          paymentStatus: "failed",
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));
      await tx.insert(orderEvents).values({
        id: newId("orderevent"),
        orderId: order.id,
        type: "payment.failed",
        message: "Payment could not be confirmed.",
        metadata: {
          provider: provider.key,
          eventId: event.eventId,
          providerPaymentId: event.paymentId,
          checkoutReference,
          amountMinor: event.amountMinor,
          currency: event.currency,
        },
      });
    }
  });

  let fulfillment: WebhookResult["fulfillment"];
  let fulfillmentError: string | undefined;
  if (event.type === "payment.succeeded") {
    try {
      fulfillment = await runOutboxAndJobs(db);
    } catch (error) {
      fulfillmentError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    ok: true,
    duplicate: false,
    eventType: event.type,
    orderId: event.orderId,
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
