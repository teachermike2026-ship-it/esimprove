"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestOrderRefundAction,
  type RefundRequestState,
} from "@/app/portal/orders/[orderNumber]/actions";
import { currencyDecimals, formatMoney } from "@/lib/money";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";

function defaultAmount(amountMinor: number, currency: string): string {
  const decimals = currencyDecimals(currency);
  return (amountMinor / 10 ** decimals).toFixed(decimals);
}

function Linkified({
  text,
  label,
  href,
}: {
  text: string;
  label: string;
  href: string;
}) {
  const index = text.indexOf(label);
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <Link href={href}>{label}</Link>
      {text.slice(index + label.length)}
    </>
  );
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
  const { t, href } = useI18n();
  const policyHref = href("/legal/refunds");
  const policyLabel = t("refund.policyLink");
  const [state, formAction, pending] = useActionState<RefundRequestState, FormData>(
    requestOrderRefundAction,
    {},
  );

  return (
    <section className="card form" aria-labelledby="refund-request-title">
      <h2 id="refund-request-title">{t("refund.title")}</h2>
      <p className="muted small">
        <Linkified
          text={t("refund.lead", { policyLink: policyLabel })}
          label={policyLabel}
          href={policyHref}
        />
      </p>
      {state.ok ? (
        <div className="callout callout-success" role="status">
          <CheckIcon className="inline-icon" />
          <p>{t("refund.success")}</p>
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
          <label htmlFor="refund-amount">
            {t("refund.amountLabel", { currency })}
          </label>
          <input
            id="refund-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            required
            pattern="[0-9]{1,9}([.][0-9]{1,3})?"
            defaultValue={defaultAmount(remainingMinor, currency)}
            aria-describedby="refund-amount-help"
            dir="ltr"
          />
          <p id="refund-amount-help" className="form-note">
            {t("refund.remaining", { amount: formatMoney(remainingMinor, currency) })}
          </p>
        </div>
        <div className="field">
          <label htmlFor="refund-reason">{t("refund.reasonLabel")}</label>
          <textarea
            id="refund-reason"
            name="reason"
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            placeholder={t("refund.reasonPlaceholder")}
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" name="confirm" required />
          <span>
            <Linkified
              text={t("refund.confirm", {
                policyLink: t("refund.policyLinkLong"),
              })}
              label={t("refund.policyLinkLong")}
              href={policyHref}
            />
          </span>
        </label>
        <button className="button" type="submit" disabled={pending}>
          {pending ? t("refund.recording") : t("refund.submit")}
        </button>
      </form>
    </section>
  );
}
