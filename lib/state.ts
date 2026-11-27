export type PaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | "cancelled";

export type FulfillmentStatus =
  | "not_started"
  | "queued"
  | "provisioning"
  | "ready"
  | "delivered"
  | "failed"
  | "under_investigation"
  | "manual_review"
  | "cancelled";

export type OrderStatus = "pending_payment" | "processing" | "delivered" | "failed" | "cancelled";

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["authorized", "paid", "failed", "cancelled"],
  authorized: ["paid", "failed", "cancelled"],
  paid: ["refunded", "partially_refunded", "disputed"],
  // A declined card attempt can be followed by a successful retry in the
  // same hosted checkout; the verified success then pays the order.
  failed: ["paid"],
  refunded: [],
  cancelled: [],
  partially_refunded: ["refunded"],
  disputed: ["refunded"],
};

const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  not_started: ["queued", "cancelled"],
  queued: ["provisioning", "failed", "manual_review", "cancelled"],
  provisioning: ["ready", "failed", "under_investigation", "manual_review", "cancelled"],
  ready: ["delivered", "failed", "under_investigation", "manual_review", "cancelled"],
  delivered: ["failed"],
  failed: ["queued", "under_investigation", "manual_review", "cancelled"],
  under_investigation: ["queued", "failed", "manual_review", "cancelled"],
  manual_review: ["queued", "failed", "cancelled"],
  cancelled: [],
};

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["processing", "failed", "cancelled"],
  processing: ["delivered", "failed", "cancelled"],
  delivered: ["failed"],
  failed: ["processing", "cancelled"],
  cancelled: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionFulfillment(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): boolean {
  return FULFILLMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Invalid payment transition: ${from} -> ${to}`);
  }
}

export function assertFulfillmentTransition(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): void {
  if (!canTransitionFulfillment(from, to)) {
    throw new Error(`Invalid fulfillment transition: ${from} -> ${to}`);
  }
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new Error(`Invalid order transition: ${from} -> ${to}`);
  }
}

export function deriveOrderStatus(
  paymentStatus: PaymentStatus,
  fulfillmentStatus: FulfillmentStatus,
): OrderStatus {
  if (paymentStatus === "failed") return "failed";
  if (paymentStatus === "refunded" || paymentStatus === "cancelled") return "cancelled";
  if (paymentStatus === "partially_refunded") {
    if (fulfillmentStatus === "delivered") return "delivered";
    if (fulfillmentStatus === "failed") return "failed";
    if (fulfillmentStatus === "cancelled") return "cancelled";
    return "processing";
  }
  if (paymentStatus !== "paid" && paymentStatus !== "disputed") return "pending_payment";
  if (fulfillmentStatus === "delivered") return "delivered";
  if (fulfillmentStatus === "failed") return "failed";
  if (fulfillmentStatus === "cancelled") return "cancelled";
  // A paid order (or one under dispute) is being fulfilled.
  return "processing";
}
