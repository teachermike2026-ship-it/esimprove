import type { IntegrationMode } from "@/lib/integrations/supplier/types";

export interface CreateCheckoutInput {
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  currency: string;
  customerEmail: string;
  returnUrl: string;
}

export interface CheckoutSession {
  providerPaymentId: string;
  checkoutUrl: string;
}

export type PaymentEventType = "payment.succeeded" | "payment.failed";

export interface PaymentEvent {
  eventId: string;
  type: PaymentEventType;
  paymentId: string;
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
  verifyWebhook(rawBody: string, signature: string | null): PaymentEvent;
}
