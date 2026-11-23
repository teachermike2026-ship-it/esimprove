import { and, eq, inArray } from "drizzle-orm";
import type { Database, DatabaseExecutor } from "@/lib/db/client";
import { notifications, orderEvents, orders, payments, refunds } from "@/lib/db/schema";
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
  actorType: "admin" | "system" | "customer";
  actorId?: string | null;
}

export interface RefundableBalance {
  orderTotalMinor: number;
  reservedMinor: number;
  remainingMinor: number;
}

function refundKey(orderId: string, amountMinor: number): string {
  return `refund:${orderId}:${amountMinor}`;
}

function sumRefundAmounts(rows: Array<{ amountMinor: number }>): number {
  return rows.reduce((total, row) => total + row.amountMinor, 0);
}

/**
 * Pending and approved requests both reserve part of the order total so the
 * approved total can never exceed what was captured. Rejected requests release
 * their reservation.
 */
export async function getRefundableBalance(
  db: Database,
  orderId: string,
): Promise<RefundableBalance | null> {
  const orderRows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = orderRows[0];
  if (!order) return null;
  const outstanding = await db
    .select({ amountMinor: refunds.amountMinor })
    .from(refunds)
    .where(
      and(eq(refunds.orderId, order.id), inArray(refunds.status, ["requested", "approved"])),
    );
  const reservedMinor = sumRefundAmounts(outstanding);
  return {
    orderTotalMinor: order.totalMinor,
    reservedMinor,
    remainingMinor: Math.max(0, order.totalMinor - reservedMinor),
  };
}

export async function requestRefund(
  db: Database,
  input: RequestRefundInput,
): Promise<RefundRow> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Refund amount must be a positive integer in minor units");
  }
  const reason = input.reason.trim();
  if (reason.length < 10) {
    throw new Error("Describe the refund reason in at least 10 characters");
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

  const key = refundKey(input.orderId, input.amountMinor);
  const existing = await db
    .select()
    .from(refunds)
    .where(eq(refunds.idempotencyKey, key))
    .limit(1);

  const outstanding = await db
    .select({ amountMinor: refunds.amountMinor })
    .from(refunds)
    .where(
      and(eq(refunds.orderId, order.id), inArray(refunds.status, ["requested", "approved"])),
    );
  const alreadyReserved = sumRefundAmounts(outstanding);
  const previous = existing[0];
  if (previous && previous.status !== "rejected") {
    // The same order + amount request is idempotent while it is pending or
    // approved. Never create a second refund row for the same amount.
    return previous;
  }
  // A rejected request is not part of `outstanding`, so its reservation has
  // already been released before this check.
  if (alreadyReserved + input.amountMinor > order.totalMinor) {
    throw new Error("Refund amount exceeds the remaining refundable order total");
  }

  const now = new Date();
  if (previous) {
    const claimed = await db.transaction(async (tx) => {
      const updated = await tx
        .update(refunds)
        .set({
          status: "requested",
          reason,
          paymentId: refundablePayment.id,
          resolutionNote: "",
          resolvedBy: null,
          resolvedAt: null,
          updatedAt: now,
        })
        .where(and(eq(refunds.id, previous.id), eq(refunds.status, "rejected")))
        .returning();
      const row = updated[0];
      if (!row) return null;
      await tx.insert(orderEvents).values({
        id: newId("orderevent"),
        orderId: order.id,
        type: "refund.requested",
        message: `Refund requested again. Awaiting review.`,
        metadata: {
          refundId: row.id,
          amountMinor: input.amountMinor,
          reason,
          demo: true,
        },
      });
      await recordAudit(tx, {
        actorType: input.actorType ?? "customer",
        actorId: input.actorId ?? null,
        action: "refund.requested",
        entityType: "refund",
        entityId: row.id,
        metadata: {
          orderId: order.id,
          amountMinor: input.amountMinor,
          reopened: true,
        },
      });
      return row;
    });
    if (claimed) return claimed;
    throw new Error("Refund request changed while it was being reopened");
  }

  const refund: RefundRow = {
    id: newId("refund"),
    orderId: order.id,
    paymentId: refundablePayment.id,
    amountMinor: input.amountMinor,
    currency: order.currency,
    reason,
    status: "requested",
    providerRefundId: null,
    resolutionNote: "",
    resolvedBy: null,
    resolvedAt: null,
    idempotencyKey: key,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction(async (tx) => {
    await tx.insert(refunds).values(refund);
    await tx.insert(orderEvents).values({
      id: newId("orderevent"),
      orderId: order.id,
      type: "refund.requested",
      message: `Refund requested. Awaiting review.`,
      metadata: { refundId: refund.id, amountMinor: input.amountMinor, reason },
    });
    await recordAudit(tx, {
      actorType: input.actorType ?? "customer",
      actorId: input.actorId ?? null,
      action: "refund.requested",
      entityType: "refund",
      entityId: refund.id,
      metadata: { orderId: order.id, amountMinor: input.amountMinor },
    });
  });
  return refund;
}

async function notifyOrderOwner(
  tx: DatabaseExecutor,
  input: {
    orderId: string;
    type: string;
    title: string;
    body: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const orderRows = await tx.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  const userId = orderRows[0]?.userId;
  if (!userId) return;
  await tx.insert(notifications).values({
    id: newId("notification"),
    userId,
    type: input.type,
    title: input.title,
    body: input.body,
    payload: input.payload,
    read: false,
    createdAt: new Date(),
  });
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

    const payment = await getPaymentForOrder(tx, order.id);
    if (!payment) throw new Error("Refund payment record is missing");
    if (!["paid", "partially_refunded", "disputed"].includes(payment.status)) {
      throw new Error("Refund requires a paid payment");
    }

    const approved = await tx
      .select({ amountMinor: refunds.amountMinor })
      .from(refunds)
      .where(and(eq(refunds.orderId, order.id), eq(refunds.status, "approved")));
    const approvedTotal = sumRefundAmounts(approved) + refund.amountMinor;
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
      .set({
        status: "approved",
        resolutionNote: "Approved by an administrator.",
        resolvedBy: actor.actorId ?? null,
        resolvedAt: now,
        updatedAt: now,
      })
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
          ? "Refund approved and applied in full to your payment."
          : "Partial refund approved and applied to your payment.",
      metadata: {
        refundId: refund.id,
        amountMinor: refund.amountMinor,
        paymentStatus: nextPaymentStatus,
        demo: true,
      },
    });
    await recordAudit(tx, {
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
    await notifyOrderOwner(tx, {
      orderId: order.id,
      type: "refund.approved",
      title: "Refund request approved",
      body: `A refund of ${refund.amountMinor} minor units was approved for order ${order.orderNumber}.`,
      payload: { refundId: refund.id, orderNumber: order.orderNumber, demo: true },
    });

    return { ...refund, status: "approved", resolvedAt: now, updatedAt: now };
  });
}

/**
 * Rejects a pending refund. No payment fields change; the reservation is
 * released so the customer can submit a corrected request later.
 */
export async function rejectRefund(
  db: Database,
  refundId: string,
  input: { note: string; actorType?: string; actorId?: string | null },
): Promise<RefundRow> {
  const note = input.note.trim();
  if (note.length < 5) throw new Error("Explain why the refund is being rejected");
  return db.transaction(async (tx) => {
    const refundRows = await tx.select().from(refunds).where(eq(refunds.id, refundId)).limit(1);
    const refund = refundRows[0];
    if (!refund) throw new Error("Refund not found");
    if (refund.status !== "requested") {
      throw new Error("Refund was already processed");
    }
    const now = new Date();
    const updated = await tx
      .update(refunds)
      .set({
        status: "rejected",
        resolutionNote: note,
        resolvedBy: input.actorId ?? null,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(and(eq(refunds.id, refund.id), eq(refunds.status, "requested")))
      .returning();
    const row = updated[0];
    if (!row) throw new Error("Refund was already processed");

    const orderRows = await tx.select().from(orders).where(eq(orders.id, refund.orderId)).limit(1);
    const order = orderRows[0];
    await tx.insert(orderEvents).values({
      id: newId("orderevent"),
      orderId: refund.orderId,
      type: "refund.rejected",
      message: "Refund request rejected. Your payment was not changed.",
      metadata: { refundId: refund.id, amountMinor: refund.amountMinor, note },
    });
    await recordAudit(tx, {
      actorType: input.actorType ?? "admin",
      actorId: input.actorId ?? null,
      action: "admin.refund.reject",
      entityType: "refund",
      entityId: refund.id,
      metadata: { orderId: refund.orderId, amountMinor: refund.amountMinor },
    });
    if (order) {
      await notifyOrderOwner(tx, {
        orderId: order.id,
        type: "refund.rejected",
        title: "Refund request rejected",
        body: `The refund request for order ${order.orderNumber} was rejected. Reason: ${note}`,
        payload: { refundId: refund.id, orderNumber: order.orderNumber, demo: true },
      });
    }
    return row;
  });
}

export async function listRefundsForOrder(db: Database, orderId: string): Promise<RefundRow[]> {
  return db
    .select()
    .from(refunds)
    .where(eq(refunds.orderId, orderId))
    .orderBy(refunds.createdAt);
}
