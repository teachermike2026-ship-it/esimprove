import type { IntegrationMode } from "@/lib/integrations/supplier/types";

export interface CheckoutItem {
  planId: string;
  planSlug: string;
  planName: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface CreateCheckoutInput {
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  currency: string;
  customerEmail: string;
  returnUrl: string;
  /**
   * Present when the application creates the payment before contacting the
   * provider. Providers that attach order references to a hosted checkout use
   * this to correlate the provider event with the local payment row.
   */
  paymentId?: string;
  /**
   * Server-derived order lines. Providers must never accept prices or plan IDs
   * from the browser.
   */
  items?: CheckoutItem[];
  taxMinor?: number;
}

export interface CheckoutSession {
  providerPaymentId: string;
  checkoutUrl: string;
}

/**
 * `payment.pending` covers provider states where the buyer has not finished
 * (processing, 3-D Secure). It is logged only and never changes status.
 */
export type PaymentEventType = "payment.succeeded" | "payment.failed" | "payment.pending";

export interface PaymentEvent {
  eventId: string;
  type: PaymentEventType;
  /** Provider-side payment identifier, for example Whop's `pay_...`. */
  paymentId: string;
  /**
   * Local ESIMPROVE payment ID when the provider carries it back in signed
   * metadata. This lets a provider payment be correlated before its payment ID
   * is stored locally.
   */
  internalPaymentId?: string;
  orderId: string;
  /**
   * Amount to compare with the stored order price, in minor units of
   * `currency`. For Whop this is `total` minus exclusive tax (buyer fees are
   * already excluded from `total`). -1 when it could not be computed; then
   * `reviewReason` is set.
   */
  amountMinor: number;
  currency: string;
  createdAt: string;
  /** Provider payment status (Whop `ReceiptStatus`). When present, only `paid` may mark an order paid. */
  providerStatus?: string;
  /** Price before discounts, tax and fees, when the provider sends it. */
  subtotalMinor?: number;
  /** Set when the payload cannot be safely compared; the payment is held for review. */
  reviewReason?: string;
  /** Provider checkout reference (Whop `ch_...`), when present. */
  checkoutConfigurationId?: string | null;
  /** Provider product the payment was for (Whop `prod_...`), when present. */
  productId?: string | null;
  /** Buyer email reported by the provider; compared, never stored. */
  customerEmail?: string | null;
}

export interface RefundPaymentInput {
  /** Provider payment ID (Whop `pay_...`). */
  providerPaymentId: string;
  /** Stable key so a repeated request never refunds twice. */
  idempotencyKey: string;
  /** Order references only; returned on the provider's refund webhooks. */
  metadata: Record<string, string>;
}

export interface RefundPaymentResult {
  /** Provider status after the request; the refund webhook is the source of truth. */
  providerStatus: string;
}

export interface PaymentProvider {
  readonly key: string;
  readonly mode: IntegrationMode;
  readonly isMock: boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /**
   * Ask the provider to return the full payment to the buyer. Local status
   * changes only when the provider's verified refund webhook arrives.
   */
  refundPayment?(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  verifyWebhook(
    rawBody: string,
    signature: string | null,
    headers?: Record<string, string>,
  ): PaymentEvent;
}

/**
 * A safe, customer-presentable provider configuration or checkout error.
 * Messages must never include API keys, webhook secrets, or raw provider
 * responses.
 */
export class PaymentUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentUnavailableError";
  }
}
