"use client";

import { useActionState, useState } from "react";
import { createCheckoutAction } from "@/app/checkout/actions";
import { LEGAL_DOCUMENT_VERSION } from "@/lib/legal-profile";
import {
  AlertIcon,
  CheckIcon,
  CryptoIcon,
  CreditCardIcon,
  LockIcon,
} from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";
import { CardDetailsFields } from "@/components/card-details-fields";
import {
  CHECKOUT_CARD_NETWORKS,
  DEFAULT_CHECKOUT_PAYMENT_METHOD,
  type CheckoutPaymentMethod,
} from "@/lib/checkout-payment";

type CheckoutState = { error?: string };

export function CheckoutForm({
  idempotencyKey,
  disabled = false,
  previewOnly = false,
  cryptoAvailable = false,
  cardReady = false,
}: {
  idempotencyKey: string;
  disabled?: boolean;
  previewOnly?: boolean;
  cryptoAvailable?: boolean;
  /** True only when the Whop card checkout is fully configured on the server. */
  cardReady?: boolean;
}) {
  const { t, href } = useI18n();
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    createCheckoutAction,
    {},
  );
  const [method, setMethod] = useState<CheckoutPaymentMethod>(
    DEFAULT_CHECKOUT_PAYMENT_METHOD,
  );
  const cryptoSelected = method === "crypto";
  const cardBlocked = !cryptoSelected && !cardReady;

  return (
    <form className="form card checkout-form" action={formAction}>
      {previewOnly ? (
        <div className="callout callout-warning" role="note">
          <AlertIcon className="inline-icon" />
          <span>{t("demo.previewFormNote")}</span>
        </div>
      ) : null}
      {state.error ? (
        <div className="form-error" role="alert">
          <AlertIcon className="inline-icon" />
          <span>{state.error}</span>
        </div>
      ) : null}
      <input type="hidden" name="previewOnly" value={previewOnly ? "1" : "0"} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="termsVersion" value={LEGAL_DOCUMENT_VERSION} />
      <input type="hidden" name="paymentMethod" value={method} />

      <fieldset className="payment-method-fieldset">
        <legend className="payment-method-legend">{t("checkout.choosePaymentTitle")}</legend>
        <p className="form-note payment-method-intro">{t("checkout.choosePaymentLead")}</p>
        <div className="payment-method-grid">
          <label
            className={`payment-method-card${method === "card" ? " is-selected" : ""}`}
            htmlFor="payment-method-card"
          >
            <input
              id="payment-method-card"
              className="payment-method-input"
              type="radio"
              name="paymentMethodChoice"
              value="card"
              checked={method === "card"}
              onChange={() => {
                setMethod("card");
                window.esimproveTrack?.("payment_method_selected", { metadata: { method: "card" } });
              }}
              disabled={disabled}
            />
            <span className="payment-method-top">
              <span className="payment-method-icon" aria-hidden="true">
                <CreditCardIcon />
              </span>
              <span className="payment-method-body">
                <span className="payment-method-title">{t("checkout.cardTitle")}</span>
                <span className="payment-method-description">{t("checkout.cardLead")}</span>
              </span>
              <span className="payment-method-indicator" aria-hidden="true">
                {method === "card" ? <CheckIcon /> : null}
              </span>
            </span>
            <span
              className="payment-network-list"
              role="group"
              aria-label={t("checkout.cardNetworksAria")}
            >
              {CHECKOUT_CARD_NETWORKS.map((network) => (
                <span className="payment-network" key={network}>
                  {network}
                </span>
              ))}
            </span>
          </label>

          <label
            className={`payment-method-card${cryptoSelected ? " is-selected" : ""}${
              cryptoAvailable ? "" : " is-disabled"
            }`}
            htmlFor="payment-method-crypto"
          >
            <input
              id="payment-method-crypto"
              className="payment-method-input"
              type="radio"
              name="paymentMethodChoice"
              value="crypto"
              checked={cryptoSelected}
              onChange={() => {
                setMethod("crypto");
                window.esimproveTrack?.("payment_method_selected", { metadata: { method: "crypto" } });
              }}
              disabled={disabled || !cryptoAvailable}
              aria-describedby={cryptoAvailable ? undefined : "crypto-unavailable-note"}
            />
            <span className="payment-method-top">
              <span className="payment-method-icon" aria-hidden="true">
                <CryptoIcon />
              </span>
              <span className="payment-method-body">
                <span className="payment-method-title">{t("checkout.cryptoTitle")}</span>
                <span className="payment-method-description">{t("checkout.cryptoLead")}</span>
              </span>
              <span className="payment-method-indicator" aria-hidden="true">
                {cryptoSelected ? <CheckIcon /> : null}
              </span>
            </span>
            <span className="payment-method-badges">
              <span className="payment-network" dir="ltr">
                Binance-Peg USDT · BEP-20
              </span>
              <span className="payment-network" dir="ltr">
                BNB Smart Chain
              </span>
            </span>
            {!cryptoAvailable ? (
              <span className="payment-method-note" id="crypto-unavailable-note">
                {t("checkout.cryptoUnavailableNote")}
              </span>
            ) : null}
          </label>
        </div>
      </fieldset>

      {!cryptoSelected ? <CardDetailsFields cardReady={cardReady} /> : null}

      <label className="checkbox">
        <input type="checkbox" name="terms" required />
        <span>
          {t("checkout.acceptPrefix")}{" "}
          <a href={href("/legal/terms")} target="_blank" rel="noreferrer">
            {t("checkout.termsLink")}
          </a>{" "}
          (version {LEGAL_DOCUMENT_VERSION}) {t("checkout.termsMiddle")}{" "}
          <a href={href("/legal/privacy")} target="_blank" rel="noreferrer">
            {t("checkout.privacyLink")}
          </a>
          {t("checkout.termsSuffix")}
        </span>
      </label>
      <label className="checkbox">
        <input type="checkbox" name="immediateSupply" value="yes" required />
        <span>{t("checkout.immediateSupply")}</span>
      </label>
      <p className="form-note">
        {t("checkout.policiesIntro")}{" "}
        <a href={href("/legal/esim-service")} target="_blank" rel="noreferrer">
          {t("checkout.esimTermsLink")}
        </a>
        {" · "}
        <a href={href("/legal/payments")} target="_blank" rel="noreferrer">
          {t("checkout.paymentTermsLink")}
        </a>
        {" · "}
        <a href={href("/legal/refunds")} target="_blank" rel="noreferrer">
          {t("checkout.refundPolicyLink")}
        </a>
      </p>
      <button
        className="button button-wide"
        type="submit"
        disabled={pending || disabled || previewOnly || cardBlocked}
      >
        {cryptoSelected ? (
          <CryptoIcon className="inline-icon" />
        ) : (
          <CreditCardIcon className="inline-icon" />
        )}
        {previewOnly
          ? t("demo.previewSubmit")
          : pending
            ? t("checkout.creatingOrder")
            : cryptoSelected
              ? t("checkout.continueWithCrypto")
              : cardReady
                ? t("checkout.continueWithCard")
                : t("checkout.cardUnavailableSubmit")}
      </button>
      <p className="form-note">
        <LockIcon className="inline-icon" />{" "}
        {cryptoSelected ? t("checkout.cryptoOrderNote") : t("checkout.priceNote")}
      </p>
    </form>
  );
}
