import { IntegrationDisabledError } from "@/lib/integrations/supplier/types";
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentEvent,
  PaymentProvider,
} from "@/lib/integrations/payments/types";

export class DisabledStripePaymentProvider implements PaymentProvider {
  readonly key = "stripe";
  readonly mode = "live" as const;
  readonly isMock = false;

  private fail(operation: string): never {
    throw new IntegrationDisabledError(
      "Stripe payment",
      `${operation} is blocked. No processor approval, live credentials, or test-mode account exists.`,
    );
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    void input;
    return this.fail("createCheckout");
  }

  verifyWebhook(
    rawBody: string,
    signature: string | null,
    headers?: Record<string, string>,
  ): PaymentEvent {
    void rawBody;
    void signature;
    void headers;
    return this.fail("verifyWebhook");
  }
}

/**
 * Production deployment without an approved live processor. This is not a mock:
 * checkout and webhook verification fail closed instead of simulating payment.
 */
export class DisabledUnconfiguredPaymentProvider implements PaymentProvider {
  readonly key = "unconfigured";
  readonly mode = "live" as const;
  readonly isMock = false;

  private fail(operation: string): never {
    throw new IntegrationDisabledError(
      "Live payment",
      `${operation} is blocked. No live payment provider is configured for this deployment.`,
    );
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    void input;
    return this.fail("createCheckout");
  }

  verifyWebhook(
    rawBody: string,
    signature: string | null,
    headers?: Record<string, string>,
  ): PaymentEvent {
    void rawBody;
    void signature;
    void headers;
    return this.fail("verifyWebhook");
  }
}
