/**
 * Payment methods offered by checkout. Kept in a small, dependency-free module
 * so the UI, server action, and tests share one closed list.
 *
 * Credit / debit card is always first and selected by default. Crypto is the
 * second, optional method and is only selectable when the server reports a
 * complete crypto configuration.
 */
export const CHECKOUT_PAYMENT_METHODS = ["card", "crypto"] as const;

export type CheckoutPaymentMethod = (typeof CHECKOUT_PAYMENT_METHODS)[number];

export const DEFAULT_CHECKOUT_PAYMENT_METHOD: CheckoutPaymentMethod = "card";

export const CHECKOUT_CARD_NETWORKS = ["Visa", "Mastercard"] as const;

export function isCheckoutPaymentMethod(
  value: string | null | undefined,
): value is CheckoutPaymentMethod {
  return CHECKOUT_PAYMENT_METHODS.includes(value as CheckoutPaymentMethod);
}
