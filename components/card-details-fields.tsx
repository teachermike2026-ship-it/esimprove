"use client";

import { useId } from "react";
import { useI18n } from "@/components/i18n-provider";
import { AlertIcon } from "@/components/icons";

/**
 * Card details area shown when "Credit / Debit Card" is selected.
 *
 * ESIMPROVE never collects card numbers itself. Card data must only ever be
 * typed into Whop's secure payment form, so:
 *  - `cardReady=false` (Whop not configured yet): the fields below are a
 *    disabled placeholder with no `name` attributes, so nothing can be typed
 *    or submitted, plus a "coming soon" notice.
 *  - `cardReady=true`: nothing is rendered; the embedded Whop form follows.
 *
 * This component makes no network call and never contacts Whop.
 */
export function CardDetailsFields({ cardReady }: { cardReady: boolean }) {
  const { t } = useI18n();
  const headingId = useId();
  const nameId = useId();
  const numberId = useId();
  const expiryId = useId();
  const cvcId = useId();

  // When card payments are available, nothing is shown here: the embedded
  // Whop payment form appears in the next step.
  if (cardReady) return null;

  return (
    <section
      className="payment-detail-panel card-details-panel is-placeholder"
      aria-labelledby={headingId}
    >
      <div className="payment-detail-head">
        <h3 id={headingId}>{t("checkout.cardFieldsTitle")}</h3>
        <span className="badge badge-warning">{t("checkout.cardFieldsComingSoon")}</span>
      </div>
      <fieldset className="card-details-grid" disabled aria-describedby={`${headingId}-note`}>
        <div className="field card-details-wide">
          <label htmlFor={nameId}>{t("checkout.cardNameLabel")}</label>
          <input id={nameId} type="text" autoComplete="off" placeholder="—" readOnly />
        </div>
        <div className="field card-details-wide">
          <label htmlFor={numberId}>{t("checkout.cardNumberLabel")}</label>
          <input
            id={numberId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="•••• •••• •••• ••••"
            dir="ltr"
            readOnly
          />
        </div>
        <div className="field">
          <label htmlFor={expiryId}>{t("checkout.cardExpiryLabel")}</label>
          <input id={expiryId} type="text" autoComplete="off" placeholder="MM / YY" dir="ltr" readOnly />
        </div>
        <div className="field">
          <label htmlFor={cvcId}>{t("checkout.cardCvcLabel")}</label>
          <input id={cvcId} type="text" autoComplete="off" placeholder="•••" dir="ltr" readOnly />
        </div>
      </fieldset>
      <div className="callout callout-warning" role="note" id={`${headingId}-note`}>
        <AlertIcon className="inline-icon" />
        <p>{t("checkout.cardFieldsComingSoonBody")}</p>
      </div>
    </section>
  );
}
