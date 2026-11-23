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

export type PaymentEventType = "payment.succeeded" | "payment.failed";

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
  amountMinor: number;
  currency: string;
  createdAt: string;
}

export interface PaymentProvider {
  readonly key: string;
  readonly mode: IntegrationMode;
  readonly isMock: boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
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
