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

  verifyWebhook(rawBody: string, signature: string | null): PaymentEvent {
    void rawBody;
    void signature;
    return this.fail("verifyWebhook");
  }
}
