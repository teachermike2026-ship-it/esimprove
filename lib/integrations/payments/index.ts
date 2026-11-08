import { flags, mockCommerceAllowed } from "@/lib/config";
import { MockPaymentProvider } from "@/lib/integrations/payments/mock";
import {
  DisabledStripePaymentProvider,
  DisabledUnconfiguredPaymentProvider,
} from "@/lib/integrations/payments/disabled";
import type { PaymentProvider } from "@/lib/integrations/payments/types";

let provider: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    if (flags.paymentsLive) {
      provider = new DisabledStripePaymentProvider();
    } else if (!mockCommerceAllowed) {
      provider = new DisabledUnconfiguredPaymentProvider();
    } else {
      provider = new MockPaymentProvider();
    }
  }
  return provider;
}
