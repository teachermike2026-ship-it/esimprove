import { flags, mockCommerceAllowed, paymentProviderKey } from "@/lib/config";
import { MockPaymentProvider } from "@/lib/integrations/payments/mock";
import { WhopPaymentProvider } from "@/lib/integrations/payments/whop";
import {
  DisabledStripePaymentProvider,
  DisabledUnconfiguredPaymentProvider,
} from "@/lib/integrations/payments/disabled";
import type { PaymentProvider } from "@/lib/integrations/payments/types";

let provider: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    const key = paymentProviderKey();
    if (key === "whop") {
      provider = new WhopPaymentProvider();
    } else if (key === "stripe" || flags.paymentsLive) {
      provider = new DisabledStripePaymentProvider();
    } else if (!mockCommerceAllowed) {
      provider = new DisabledUnconfiguredPaymentProvider();
    } else {
      provider = new MockPaymentProvider();
    }
  }
  return provider;
}

/**
 * The Whop webhook route must verify with Whop even if the storefront is
 * currently using the mock provider. Keeping this explicit avoids accepting a
 * Whop event through the wrong provider's verification rules.
 */
export function getWhopPaymentProvider(): WhopPaymentProvider {
  return new WhopPaymentProvider();
}
