/**
 * Readiness summary for the detailed health check. Names and booleans only:
 * never values, keys or secrets. Each item states only what this server can
 * verify itself; provider-side state (for example Apple's domain verification
 * in Whop) is reported as needing a manual check rather than claimed.
 */
import { flags, liveEmailProblems, onlineCheckoutAvailable, paymentProviderKey, whopCredentials } from "@/lib/config";
import { WHOP_CHECKOUT_PAYMENT_METHODS, whopMode } from "@/lib/integrations/payment/whop";
import { loadCryptoPaymentConfig } from "@/lib/payments/crypto/config";

export function paymentReadiness() {
  const whop = whopCredentials();
  const isWhop = paymentProviderKey() === "whop";
  const mode = isWhop ? whopMode() : "not-selected";
  const methods = WHOP_CHECKOUT_PAYMENT_METHODS.enabled as readonly string[];
  const cardReady = isWhop && onlineCheckoutAvailable();
  const appleAssociationEnv = Boolean(process.env.APPLE_PAY_DOMAIN_ASSOCIATION?.trim());
  const emailProblems = flags.emailLive ? liveEmailProblems() : [];

  return {
    whop: {
      mode,
      apiKeyConfigured: Boolean(whop.apiKey),
      companyConfigured: Boolean(whop.companyId),
      productConfigured: /^prod_[A-Za-z0-9]+$/.test(whop.productId ?? ""),
      checkoutAvailable: cardReady,
    },
    webhook: {
      secretConfigured: Boolean(whop.webhookSecret),
      // Signature verification itself happens per request (Standard Webhooks).
      verification: whop.webhookSecret ? "enabled" : "missing-secret",
    },
    card: cardReady ? "ready" : "not-configured",
    applePay: {
      requestedFromWhop: methods.includes("apple_pay"),
      domainAssociation: appleAssociationEnv ? "served-from-env" : "static-file-or-missing",
      // Apple Pay appears only after Whop registers the domain with Apple and
      // Apple verifies it; that state lives in the Whop dashboard.
      status: cardReady && methods.includes("apple_pay") ? "requires-whop-domain-verification" : "not-configured",
    },
    googlePay: {
      requestedFromWhop: methods.includes("google_pay"),
      status: cardReady && methods.includes("google_pay") ? "requested-shown-by-whop-on-supported-browsers" : "not-configured",
    },
    usdt: loadCryptoPaymentConfig() ? "ready" : "not-configured",
    supplier: flags.supplierLive
      ? process.env.ESIM_ACCESS_CODE?.trim() && process.env.ESIM_SECRET_KEY?.trim()
        ? "esimaccess-live"
        : "live-unconfigured"
      : "live-ordering-off",
    email: flags.emailLive
      ? emailProblems.length === 0
        ? "resend-live"
        : { status: "live-unconfigured", missing: emailProblems }
      : "off",
  };
}
