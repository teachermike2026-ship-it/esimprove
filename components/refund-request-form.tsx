"use client";

import { useActionState } from "react";
import {
  requestOrderRefundAction,
  type RefundRequestState,
} from "@/app/portal/orders/[orderNumber]/actions";
import { currencyDecimals, formatMoney } from "@/lib/money";
import { AlertIcon, CheckIcon } from "@/components/icons";

function defaultAmount(amountMinor: number, currency: string): string {
  const decimals = currencyDecimals(currency);
  return (amountMinor / 10 ** decimals).toFixed(decimals);
}

export function RefundRequestForm({
  orderNumber,
  currency,
  remainingMinor,
}: {
  orderNumber: string;
  currency: string;
  remainingMinor: number;
}) {
  const [state, formAction, pending] = useActionState<RefundRequestState, FormData>(
    requestOrderRefundAction,
    {},
  );

  return (
    <section className="card form" aria-labelledby="refund-request-title">
      <h2 id="refund-request-title">Request a refund</h2>
      <p className="muted small">
        Refund requests are reviewed against the order and payment records before any refund is
        applied. The <a href="/legal/refunds">Refund policy</a> explains when refunds are
        available.
      </p>
      {state.ok ? (
        <div className="callout callout-success" role="status">
          <CheckIcon className="inline-icon" />
          <p>
            Refund request recorded. It is now awaiting administrator review. You can follow the
            decision in the order timeline.
          </p>
        </div>
      ) : null}
      {state.error ? (
        <div className="form-error" role="alert">
          <AlertIcon className="inline-icon" />
          <span>{state.error}</span>
        </div>
      ) : null}
      <form action={formAction} className="stack-sm">
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <div className="field">
          <label htmlFor="refund-amount">Amount ({currency})</label>
          <input
            id="refund-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            required
            pattern="[0-9]{1,9}([.][0-9]{1,3})?"
            defaultValue={defaultAmount(remainingMinor, currency)}
            aria-describedby="refund-amount-help"
          />
          <p id="refund-amount-help" className="form-note">
            Remaining refundable balance: {formatMoney(remainingMinor, currency)}. Partial requests
            are allowed.
          </p>
        </div>
        <div className="field">
          <label htmlFor="refund-reason">Why are you requesting a refund?</label>
          <textarea
            id="refund-reason"
            name="reason"
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            placeholder="Explain the issue and what you already tried."
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" name="confirm" required />
          <span>
            I understand refund eligibility is determined under the{" "}
            <a href="/legal/refunds" target="_blank" rel="noreferrer">
              Refunds &amp; cancellation policy
            </a>
            , and that submitting a request does not guarantee approval.
          </span>
        </label>
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Recording request…" : "Submit refund request"}
        </button>
      </form>
    </section>
  );
}
