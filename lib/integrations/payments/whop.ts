import type { IntegrationMode } from "@/lib/integrations/supplier/types";
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentEvent,
  PaymentProvider,
} from "@/lib/integrations/payments/types";
import {
  createWhopCheckout,
  verifyWhopWebhook,
  whopMode,
} from "@/lib/integrations/payment/whop";

/**
 * PaymentProvider implementation for Whop. The provider key is stored on
 * payment and webhook rows so existing payment administration and deduplication
 * continue to work without a schema change.
 */
export class WhopPaymentProvider implements PaymentProvider {
  readonly key = "whop";
  readonly isMock = false;

  get mode(): IntegrationMode {
    return whopMode() === "sandbox" ? "sandbox" : "live";
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    return createWhopCheckout(input);
  }

  verifyWebhook(
    rawBody: string,
    signature: string | null,
    headers?: Record<string, string>,
  ): PaymentEvent {
    void signature;
    return verifyWhopWebhook(rawBody, headers);
  }
}
