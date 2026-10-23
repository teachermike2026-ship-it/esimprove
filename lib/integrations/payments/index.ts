import { flags } from "@/lib/config";
import { MockPaymentProvider } from "@/lib/integrations/payments/mock";
import { DisabledStripePaymentProvider } from "@/lib/integrations/payments/disabled";
import type { PaymentProvider } from "@/lib/integrations/payments/types";

let provider: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    provider = flags.paymentsLive ? new DisabledStripePaymentProvider() : new MockPaymentProvider();
  }
  return provider;
}
