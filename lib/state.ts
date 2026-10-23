export type PaymentStatus = "pending" | "authorized" | "paid" | "failed" | "refunded";
export type FulfillmentStatus =
  | "not_started"
  | "queued"
  | "provisioning"
  | "ready"
  | "delivered"
  | "failed"
  | "under_investigation"
  | "cancelled";
export type OrderStatus = "pending_payment" | "processing" | "delivered" | "failed" | "cancelled";

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["authorized", "paid", "failed"],
  authorized: ["paid", "failed"],
  paid: ["refunded"],
  failed: [],
  refunded: [],
};

const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  not_started: ["queued", "cancelled"],
  queued: ["provisioning", "failed", "cancelled"],
  provisioning: ["ready", "failed", "under_investigation"],
  ready: ["delivered", "failed", "cancelled"],
  delivered: ["failed"],
  failed: ["queued", "under_investigation", "cancelled"],
  under_investigation: ["queued", "failed", "cancelled"],
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
  if (paymentStatus === "refunded") return "cancelled";
  if (paymentStatus !== "paid") return "pending_payment";
  if (fulfillmentStatus === "delivered") return "delivered";
  if (fulfillmentStatus === "failed") return "failed";
  if (fulfillmentStatus === "cancelled") return "cancelled";
  return "processing";
}
