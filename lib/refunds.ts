import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { orderEvents, orders, payments, refunds } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { getPaymentForOrder } from "@/lib/payments";
import {
  assertPaymentTransition,
  deriveOrderStatus,
  type FulfillmentStatus,
  type PaymentStatus,
} from "@/lib/state";

export type RefundRow = typeof refunds.$inferSelect;

export type RefundStatus = "requested" | "approved" | "rejected";

export interface RequestRefundInput {
  orderId: string;
  amountMinor: number;
  reason: string;
  actorType?: string;
  actorId?: string | null;
}

export interface RefundActor {
  actorType: "admin" | "system";
  actorId?: string | null;
}

function refundKey(orderId: string, amountMinor: number): string {
  return `refund:${orderId}:${amountMinor}`;
}

function sumApprovedRefunds(
  rows: Array<{ amountMinor: number }>,
): number {
  return rows.reduce((total, row) => total + row.amountMinor, 0);
}

export async function requestRefund(
  db: Database,
  input: RequestRefundInput,
): Promise<RefundRow> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Refund amount must be a positive integer in minor units");
  }
  const orderRows = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  const order = orderRows[0];
  if (!order) throw new Error("Order not found");

  const payment = await getPaymentForOrder(db, order.id);
  const refundablePayment =
    payment && ["paid", "partially_refunded", "disputed"].includes(payment.status)
      ? payment
      : null;
  if (!refundablePayment) {
    throw new Error("Only paid orders can be refunded");
  }
  if (input.amountMinor > order.totalMinor) {
    throw new Error("Refund amount exceeds the order total");
  }

  const existing = await db
    .select()
    .from(refunds)
    .where(eq(refunds.idempotencyKey, refundKey(input.orderId, input.amountMinor)))
    .limit(1);
  if (existing[0]) return existing[0];

  // Pending and approved requests both reserve part of the order total so the
  // approved total can never exceed what was captured.
  const outstanding = await db
    .select({ amountMinor: refunds.amountMinor })
    .from(refunds)
    .where(and(eq(refunds.orderId, order.id), inArray(refunds.status, ["requested", "approved"])));
  if (sumApprovedRefunds(outstanding) + input.amountMinor > order.totalMinor) {
    throw new Error("Refund amount exceeds the remaining refundable order total");
  }

  const refund: RefundRow = {
    id: newId("refund"),
    orderId: order.id,
    paymentId: refundablePayment.id,
    amountMinor: input.amountMinor,
    currency: order.currency,
    reason: input.reason,
    status: "requested",
    providerRefundId: null,
    idempotencyKey: refundKey(input.orderId, input.amountMinor),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.transaction(async (tx) => {
    await tx.insert(refunds).values(refund);
    await tx.insert(orderEvents).values({
      id: newId("orderevent"),
      orderId: order.id,
      type: "refund.requested",
      message: `Refund requested (${input.amountMinor} minor units). Awaiting approval.`,
      metadata: { refundId: refund.id, amountMinor: input.amountMinor, reason: input.reason },
    });
    await recordAudit(tx as unknown as Database, {
      actorType: input.actorType ?? "admin",
      actorId: input.actorId ?? null,
      action: "refund.requested",
      entityType: "refund",
      entityId: refund.id,
      metadata: { orderId: order.id, amountMinor: input.amountMinor },
    });
  });
  return refund;
}

/**
 * Approves a requested refund and applies it to the payment.
 *
 * The refund row is claimed with a conditional status update and every related
 * write runs in one transaction. Concurrent approval attempts therefore either
 * see the refund already processed or roll back without double-refunding.
 * Payment state is still mock/local; no provider call is made.
 */
export async function applyRefund(
  db: Database,
  refundId: string,
  actor: RefundActor = { actorType: "admin" },
): Promise<RefundRow> {
  return db.transaction(async (tx) => {
    const refundRows = await tx.select().from(refunds).where(eq(refunds.id, refundId)).limit(1);
    const refund = refundRows[0];
    if (!refund) throw new Error("Refund not found");
    if (refund.status !== "requested") {
      throw new Error("Refund cannot be applied twice");
    }

    const orderRows = await tx.select().from(orders).where(eq(orders.id, refund.orderId)).limit(1);
    const order = orderRows[0];
    if (!order) throw new Error("Order not found");
    if (refund.currency !== order.currency) {
      throw new Error("Refund currency does not match the order");
    }

    const payment = await getPaymentForOrder(tx as unknown as Database, order.id);
    if (!payment) throw new Error("Refund payment record is missing");
    if (!["paid", "partially_refunded", "disputed"].includes(payment.status)) {
      throw new Error("Refund requires a paid payment");
    }

    const approved = await tx
      .select({ amountMinor: refunds.amountMinor })
      .from(refunds)
      .where(and(eq(refunds.orderId, order.id), eq(refunds.status, "approved")));
    const approvedTotal = sumApprovedRefunds(approved) + refund.amountMinor;
    if (approvedTotal > order.totalMinor) {
      throw new Error("Refund amount exceeds the order total");
    }

    const nextPaymentStatus: PaymentStatus =
      approvedTotal >= order.totalMinor ? "refunded" : "partially_refunded";
    if (payment.status === "paid" || payment.status === "disputed") {
      assertPaymentTransition(payment.status as PaymentStatus, nextPaymentStatus);
    } else if (payment.status === "partially_refunded" && nextPaymentStatus === "refunded") {
      assertPaymentTransition("partially_refunded", "refunded");
    }

    const now = new Date();
    const claimed = await tx
      .update(refunds)
      .set({ status: "approved", updatedAt: now })
      .where(and(eq(refunds.id, refund.id), eq(refunds.status, "requested")))
      .returning();
    if (claimed.length === 0) {
      throw new Error("Refund cannot be applied twice");
    }

    const updatedPayments = await tx
      .update(payments)
      .set({ status: nextPaymentStatus, updatedAt: now })
      .where(and(eq(payments.id, payment.id), eq(payments.status, payment.status)))
      .returning({ id: payments.id });
    if (updatedPayments.length === 0) {
      throw new Error("Payment changed while the refund was being approved");
    }

    const nextOrderStatus = deriveOrderStatus(
      nextPaymentStatus,
      order.fulfillmentStatus as FulfillmentStatus,
    );
    await tx
      .update(orders)
      .set({
        paymentStatus: nextPaymentStatus,
        status: nextOrderStatus,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));
    await tx.insert(orderEvents).values({
      id: newId("orderevent"),
      orderId: order.id,
      type: "refund.approved",
      message:
        nextPaymentStatus === "refunded"
          ? "Refund approved and applied in full."
          : "Partial refund approved and applied.",
      metadata: {
        refundId: refund.id,
        amountMinor: refund.amountMinor,
        paymentStatus: nextPaymentStatus,
      },
    });
    await recordAudit(tx as unknown as Database, {
      actorType: actor.actorType,
      actorId: actor.actorId ?? null,
      action: "admin.refund.approve",
      entityType: "refund",
      entityId: refund.id,
      metadata: {
        orderId: order.id,
        amountMinor: refund.amountMinor,
        nextPaymentStatus,
      },
    });

    return { ...refund, status: "approved", updatedAt: now };
  });
}

export async function listRefundsForOrder(db: Database, orderId: string): Promise<RefundRow[]> {
  return db
    .select()
    .from(refunds)
    .where(eq(refunds.orderId, orderId))
    .orderBy(refunds.createdAt);
}
