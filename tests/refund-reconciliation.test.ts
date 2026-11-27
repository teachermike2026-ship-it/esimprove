/** Refund reconciliation rules (pure) and exact Whop money conversion. */
import { describe, expect, it } from "vitest";
import { reconcileRefund, type RefundReconciliationInput } from "@/lib/payments/refund-reconciliation";
import { whopMoneyToMinor, type WhopPaymentLedger } from "@/lib/integrations/payment/whop";

const payment = { amountMinor: 428, currency: "USD", orderId: "order_1" };
const ledger = (overrides: Partial<WhopPaymentLedger> = {}): WhopPaymentLedger => ({
  providerPaymentId: "pay_1",
  currency: "USD",
  subtotalMinor: 428,
  totalMinor: 471,
  refundedMinor: 471,
  presentmentCurrency: "VND",
  presentmentTotalMinor: 124092,
  presentmentRefundedMinor: 124092,
  substatus: "refunded",
  metadataOrderId: "order_1",
  ...overrides,
});
const input = (overrides: Partial<RefundReconciliationInput> = {}): RefundReconciliationInput => ({
  payment,
  caseAmountMinor: 471,
  caseCurrency: "USD",
  caseStatus: "succeeded",
  previousCaseStatus: null,
  otherSucceededMinor: 0,
  ledger: ledger(),
  ...overrides,
});

describe("with Whop's payment record", () => {
  it("full refund: buyer-currency refunded equals charged (real sandbox case $4.71 on $4.28)", () => {
    expect(reconcileRefund(input())).toMatchObject({ kind: "full", source: "provider" });
  });

  it("partial refund: buyer-currency refunded below charged", () => {
    const decision = reconcileRefund(input({ caseAmountMinor: 200, ledger: ledger({ presentmentRefundedMinor: 60000, refundedMinor: 228 }) }));
    expect(decision).toMatchObject({ kind: "partial", source: "provider" });
  });

  it("settled USD above the charge is fine when buyer-currency amounts confirm a full refund (FX drift)", () => {
    expect(reconcileRefund(input({ ledger: ledger({ refundedMinor: 490 }) }))).toMatchObject({ kind: "full" });
  });

  it("over-refund in the buyer currency goes to review", () => {
    expect(reconcileRefund(input({ ledger: ledger({ presentmentRefundedMinor: 130000 }) }))).toMatchObject({ kind: "review" });
  });

  it("without buyer-currency amounts, settled refunded above the charge goes to review", () => {
    const decision = reconcileRefund(
      input({ ledger: ledger({ presentmentTotalMinor: null, presentmentRefundedMinor: null, refundedMinor: 480 }) }),
    );
    expect(decision).toMatchObject({ kind: "review" });
  });

  it("falls back to settled amounts when buyer-currency amounts are missing", () => {
    expect(
      reconcileRefund(input({ ledger: ledger({ presentmentTotalMinor: null, presentmentRefundedMinor: null }) })),
    ).toMatchObject({ kind: "full", source: "provider" });
    expect(
      reconcileRefund(
        input({ ledger: ledger({ presentmentTotalMinor: null, presentmentRefundedMinor: null, refundedMinor: 100 }) }),
      ),
    ).toMatchObject({ kind: "partial" });
  });

  it.each([
    ["payment metadata names another order", { metadataOrderId: "order_2" }],
    ["Whop settles in another currency", { currency: "EUR" }],
    ["Whop's price does not match the verified order amount", { subtotalMinor: 999 }],
    ["Whop shows nothing refunded yet", { presentmentRefundedMinor: 0, refundedMinor: 0, substatus: "paid" }],
    ["Whop says refunded but reports no amount", { presentmentRefundedMinor: 0, refundedMinor: 0, substatus: "refunded" }],
  ])("review when %s", (_label, overrides) => {
    expect(reconcileRefund(input({ ledger: ledger(overrides as Partial<WhopPaymentLedger>) }))).toMatchObject({ kind: "review" });
  });

  it("review when the refund event's currency differs from the payment", () => {
    expect(reconcileRefund(input({ caseCurrency: "EUR" }))).toMatchObject({ kind: "review" });
  });
});

describe("without Whop's payment record (conservative)", () => {
  const noLedger = { ledger: null };

  it("partial, then full, by cumulative confirmed amounts", () => {
    expect(reconcileRefund(input({ ...noLedger, caseAmountMinor: 100 }))).toMatchObject({ kind: "partial", source: "events" });
    expect(reconcileRefund(input({ ...noLedger, caseAmountMinor: 328, otherSucceededMinor: 100 }))).toMatchObject({ kind: "full" });
  });

  it("anything above the verified payment cannot be confirmed and goes to review", () => {
    expect(reconcileRefund(input({ ...noLedger, caseAmountMinor: 471 }))).toMatchObject({ kind: "review" });
    expect(reconcileRefund(input({ ...noLedger, caseAmountMinor: 200, otherSucceededMinor: 300 }))).toMatchObject({ kind: "review" });
  });

  it("review on a currency mismatch", () => {
    expect(reconcileRefund(input({ ...noLedger, caseAmountMinor: 428, caseCurrency: "EUR" }))).toMatchObject({ kind: "review" });
  });
});

describe("event status and amount validity", () => {
  it("pending or failed refunds change nothing", () => {
    expect(reconcileRefund(input({ caseStatus: "pending" }))).toMatchObject({ kind: "none" });
    expect(reconcileRefund(input({ caseStatus: "failed" }))).toMatchObject({ kind: "none" });
    expect(reconcileRefund(input({ caseStatus: "canceled" }))).toMatchObject({ kind: "none" });
  });

  it("a previously succeeded refund reported as failed goes to review", () => {
    expect(reconcileRefund(input({ caseStatus: "failed", previousCaseStatus: "succeeded" }))).toMatchObject({ kind: "review" });
  });

  it("an inexact or negative amount goes to review", () => {
    expect(reconcileRefund(input({ caseAmountMinor: null }))).toMatchObject({ kind: "review" });
    expect(reconcileRefund(input({ caseAmountMinor: -5 }))).toMatchObject({ kind: "review" });
  });
});

describe("whopMoneyToMinor (exact, no floats)", () => {
  it.each([
    [{ amount: "4.71", decimals: 2 }, 471],
    [{ amount: "124092", decimals: 0 }, 124092],
    [{ amount: "10.5", decimals: 2 }, 1050],
    [{ amount: "0.10", decimals: 2 }, 10],
    [{ amount: "1.230", decimals: 2 }, 123],
  ])("%o -> %i", (money, expected) => {
    expect(whopMoneyToMinor(money)).toBe(expected);
  });

  it("rejects amounts that cannot be represented exactly", () => {
    expect(whopMoneyToMinor({ amount: "4.715", decimals: 2 })).toBeNull();
    expect(whopMoneyToMinor({ amount: "abc", decimals: 2 })).toBeNull();
    expect(whopMoneyToMinor(null)).toBeNull();
  });
});
