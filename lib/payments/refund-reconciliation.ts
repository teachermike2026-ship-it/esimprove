/**
 * Refund reconciliation for provider (Whop) refund webhooks.
 *
 * ESIMPROVE never issues refunds automatically; refunds are executed by an
 * administrator (Whop dashboard or the admin "Refund via Whop" button). This
 * module only decides how a confirmed refund event changes our records.
 *
 * No arbitrary thresholds. The decision uses verified amounts only:
 *
 * 1. Whop's own payment record (preferred). The full/partial decision compares
 *    refunded vs. charged *in the buyer's presentment currency*, where there is
 *    no exchange-rate drift. Settled (USD) refund amounts can exceed the
 *    charged total because each refund converts at its own day's rate; that is
 *    expected and is not an over-refund. The payment must also match the order
 *    (metadata order ID and the order price as Whop's subtotal).
 * 2. When Whop cannot be asked: the case amounts we received must be in the
 *    payment currency and their cumulative total must not exceed the verified
 *    payment amount. Anything above it cannot be confirmed and goes to review.
 *
 * Inconsistent or suspicious cases always go to manual review.
 */
import type { WhopPaymentLedger } from "@/lib/integrations/payment/whop";

export type RefundDecision =
  | { kind: "full"; note: string; source: "provider" | "events" }
  | { kind: "partial"; note: string; source: "provider" | "events" }
  | { kind: "none"; note: string }
  | { kind: "review"; reason: string };

export interface RefundReconciliationInput {
  /** Our payment: the amount and currency we verified when it was paid. */
  payment: { amountMinor: number; currency: string; orderId: string };
  /** This refund case as reported by the webhook. */
  caseAmountMinor: number | null;
  caseCurrency: string;
  caseStatus: string;
  /** Status this same case had before this event, if it was already recorded. */
  previousCaseStatus: string | null;
  /** Sum of the OTHER succeeded, non-review refund cases already recorded for this payment. */
  otherSucceededMinor: number;
  /** Whop's payment record, or null when it could not be read. */
  ledger: WhopPaymentLedger | null;
}

const SUCCEEDED = "succeeded";
const IN_FLIGHT = new Set(["pending", "requires_action", "processing", "created"]);

export function reconcileRefund(input: RefundReconciliationInput): RefundDecision {
  const paymentCurrency = input.payment.currency.toUpperCase();
  const caseCurrency = input.caseCurrency.toUpperCase();

  if (input.caseAmountMinor === null || input.caseAmountMinor < 0) {
    return { kind: "review", reason: "Refund amount is not an exact, non-negative amount in its currency" };
  }

  if (input.caseStatus !== SUCCEEDED) {
    if (input.previousCaseStatus === SUCCEEDED) {
      return {
        kind: "review",
        reason: `A refund that was confirmed as succeeded is now reported as "${input.caseStatus}"; the payment status needs a manual check`,
      };
    }
    if (IN_FLIGHT.has(input.caseStatus)) {
      return { kind: "none", note: `Refund is ${input.caseStatus}; payment status unchanged until it succeeds.` };
    }
    return { kind: "none", note: `Refund ended as ${input.caseStatus}; nothing was refunded, payment status unchanged.` };
  }

  const ledger = input.ledger;
  if (ledger) {
    if (ledger.metadataOrderId && ledger.metadataOrderId !== input.payment.orderId) {
      return { kind: "review", reason: "Whop payment metadata points to a different order" };
    }
    if (ledger.currency && ledger.currency !== paymentCurrency) {
      return { kind: "review", reason: `Whop settles this payment in ${ledger.currency}, but the order was paid in ${paymentCurrency}` };
    }
    if (ledger.subtotalMinor !== null && ledger.subtotalMinor !== input.payment.amountMinor) {
      return {
        kind: "review",
        reason: `Whop's payment price (${ledger.subtotalMinor}) does not match the verified order amount (${input.payment.amountMinor})`,
      };
    }
    if (caseCurrency !== paymentCurrency) {
      return { kind: "review", reason: `Refund currency ${caseCurrency} differs from the payment currency ${paymentCurrency}` };
    }

    // Preferred: buyer's presentment currency (no exchange-rate drift).
    const pTotal = ledger.presentmentTotalMinor;
    const pRefunded = ledger.presentmentRefundedMinor;
    if (pTotal !== null && pTotal > 0 && pRefunded !== null && pRefunded > 0) {
      if (pRefunded > pTotal) {
        return { kind: "review", reason: `Whop reports more refunded (${pRefunded}) than charged (${pTotal}) in ${ledger.presentmentCurrency ?? "the buyer's currency"}` };
      }
      return pRefunded === pTotal
        ? { kind: "full", source: "provider", note: `Whop confirms the full charge was refunded (${pRefunded}/${pTotal} ${ledger.presentmentCurrency ?? ""}).`.replace(" )", ")") }
        : { kind: "partial", source: "provider", note: `Whop confirms a partial refund (${pRefunded}/${pTotal} ${ledger.presentmentCurrency ?? ""}).`.replace(" )", ")") };
    }

    // Settlement currency: the refunded total may exceed the charge only through
    // per-refund exchange rates, which only presentment amounts can rule out.
    const total = ledger.totalMinor;
    const refunded = ledger.refundedMinor;
    if (total !== null && total > 0 && refunded !== null && refunded > 0) {
      if (refunded > total) {
        return { kind: "review", reason: `Whop reports ${refunded} refunded against a ${total} charge and no buyer-currency amounts to confirm it` };
      }
      return refunded === total
        ? { kind: "full", source: "provider", note: `Whop confirms the full charge was refunded (${refunded}/${total} ${paymentCurrency}).` }
        : { kind: "partial", source: "provider", note: `Whop confirms a partial refund (${refunded}/${total} ${paymentCurrency}).` };
    }

    if (ledger.substatus === "refunded" || ledger.substatus === "partially_refunded") {
      return { kind: "review", reason: `Whop marks the payment ${ledger.substatus} but reports no refunded amount` };
    }
    return { kind: "review", reason: "The refund webhook says succeeded, but Whop's payment record shows nothing refunded yet" };
  }

  // Whop could not be asked: use only the amounts we received.
  if (caseCurrency !== paymentCurrency) {
    return { kind: "review", reason: `Refund currency ${caseCurrency} differs from the payment currency ${paymentCurrency}` };
  }
  const cumulative = input.otherSucceededMinor + input.caseAmountMinor;
  if (cumulative > input.payment.amountMinor) {
    return {
      kind: "review",
      reason: `Refunds total ${cumulative} against a verified payment of ${input.payment.amountMinor}, and Whop's payment record could not be read to confirm an exchange-rate difference`,
    };
  }
  return cumulative === input.payment.amountMinor
    ? { kind: "full", source: "events", note: `Refunds total the full payment (${cumulative}/${input.payment.amountMinor} ${paymentCurrency}).` }
    : { kind: "partial", source: "events", note: `Partial refund (${cumulative}/${input.payment.amountMinor} ${paymentCurrency}).` };
}
