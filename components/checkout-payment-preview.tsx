"use client";

import { useId, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { CardDetailsFields } from "@/components/card-details-fields";
import {
  AlertIcon,
  CheckIcon,
  CopyIcon,
  CreditCardIcon,
  CryptoIcon,
  LockIcon,
  QrIcon,
} from "@/components/icons";
import {
  CHECKOUT_CARD_NETWORKS,
  DEFAULT_CHECKOUT_PAYMENT_METHOD,
  type CheckoutPaymentMethod,
} from "@/lib/checkout-payment";
import { USDT_BEP20_PAYMENT } from "@/lib/crypto-payment";

const WALLET_NAMES = ["MetaMask", "Trust Wallet", "Binance"] as const;

type CopyState = "address" | "contract" | "failed" | null;

export interface CheckoutPaymentPreviewProps {
  /** Server-formatted preview amount, derived from the authoritative order total. */
  usdtAmount: string;
  /** Localized order total used to explain the preview conversion basis. */
  sourceAmount: string;
}

/**
 * Local-only checkout preview for USDT (BEP-20) and Card.
 *
 * There is no form action, network call, order creation, blockchain client, or
 * provider SDK in this component. The final payment action is disabled. The
 * wallet address and contract are public configuration displayed for visual
 * preview only; they are not verified by this page.
 */
export function CheckoutPaymentPreview({
  usdtAmount,
  sourceAmount,
}: CheckoutPaymentPreviewProps) {
  const { t } = useI18n();
  const [method, setMethod] = useState<CheckoutPaymentMethod>(
    DEFAULT_CHECKOUT_PAYMENT_METHOD,
  );
  const [copyState, setCopyState] = useState<CopyState>(null);
  const cryptoHeadingId = useId();
  const cardHeadingId = useId();
  const instructionsId = useId();

  const copyMessage =
    copyState === "address" || copyState === "contract"
      ? t("checkout.copied")
      : copyState === "failed"
        ? t("checkout.copyFailed")
        : "";

  async function copyValue(value: string, target: "address" | "contract") {
    try {
      await writeClipboard(value);
      setCopyState(target);
    } catch {
      setCopyState("failed");
    }
  }

  function selectMethod(nextMethod: CheckoutPaymentMethod) {
    setMethod(nextMethod);
    setCopyState(null);
  }

  return (
    <section className="card checkout-payment" aria-labelledby="checkout-payment-heading">
      <div className="checkout-step-body">
        <div>
          <p className="eyebrow">{t("checkout.paymentPreviewLabel")}</p>
          <h2 id="checkout-payment-heading">{t("checkout.choosePaymentTitle")}</h2>
          <p className="muted">{t("checkout.choosePaymentLead")}</p>
        </div>

        <div
          className="payment-method-grid"
          role="radiogroup"
          aria-label={t("checkout.paymentMethodAria")}
        >
          <label className={`payment-method-card${method === "card" ? " is-selected" : ""}`}>
            <input
              className="payment-method-input"
              type="radio"
              name="previewPaymentMethod"
              value="card"
              checked={method === "card"}
              onChange={() => selectMethod("card")}
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
            <span className="payment-method-note">{t("checkout.cardPreviewBody")}</span>
          </label>

          <label className={`payment-method-card${method === "crypto" ? " is-selected" : ""}`}>
            <input
              className="payment-method-input"
              type="radio"
              name="previewPaymentMethod"
              value="crypto"
              checked={method === "crypto"}
              onChange={() => selectMethod("crypto")}
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
                {method === "crypto" ? <CheckIcon /> : null}
              </span>
            </span>
            <span className="payment-method-badges">
              <span className="payment-network" dir="ltr">
                {USDT_BEP20_PAYMENT.asset} · {USDT_BEP20_PAYMENT.standard}
              </span>
              <span className="payment-status-chip">{t("checkout.cryptoPreviewStatus")}</span>
            </span>
            <span className="payment-method-note">{t("checkout.cryptoProviderNote")}</span>
          </label>
        </div>

        {method === "crypto" ? (
          <section
            className="payment-detail-panel crypto-payment-panel"
            aria-labelledby={cryptoHeadingId}
          >
            <div className="payment-detail-head">
              <div>
                <p className="eyebrow">{t("checkout.paymentPreviewLabel")}</p>
                <h2 id={cryptoHeadingId}>{t("checkout.cryptoHeading")}</h2>
                <p className="muted">{t("checkout.cryptoLead")}</p>
              </div>
              <span className="crypto-network-badge" dir="ltr">
                {USDT_BEP20_PAYMENT.network} · {USDT_BEP20_PAYMENT.standard}
              </span>
            </div>

            <div className="crypto-amount-hero">
              <span className="crypto-amount-label">{t("checkout.cryptoAmountLabel")}</span>
              <strong className="crypto-amount-value" dir="ltr">
                {usdtAmount} <span>{USDT_BEP20_PAYMENT.asset}</span>
              </strong>
              <p className="crypto-amount-line">
                {t("checkout.cryptoPayLine", { amount: `${usdtAmount} ${USDT_BEP20_PAYMENT.asset}` })}
              </p>
              <p className="crypto-conversion-note">
                {t("checkout.cryptoConversionNote", { amount: sourceAmount })}
              </p>
            </div>

            <dl className="meta-list crypto-meta-list">
              <div>
                <dt>{t("checkout.cryptocurrencyLabel")}</dt>
                <dd dir="ltr">{USDT_BEP20_PAYMENT.asset}</dd>
              </div>
              <div>
                <dt>{t("checkout.networkLabel")}</dt>
                <dd dir="ltr">{USDT_BEP20_PAYMENT.network}</dd>
              </div>
              <div>
                <dt>{t("checkout.networkStandardLabel")}</dt>
                <dd dir="ltr">{USDT_BEP20_PAYMENT.standard}</dd>
              </div>
              <div>
                <dt>{t("checkout.cryptoSourceTotal")}</dt>
                <dd dir="ltr">{sourceAmount}</dd>
              </div>
            </dl>

            <div className="crypto-value-block">
              <div className="crypto-value-heading">
                <span className="crypto-value-label">{t("checkout.receivingWalletLabel")}</span>
                <span className="badge badge-warning">{t("checkout.previewBadge")}</span>
              </div>
              <div className="crypto-value-row">
                <code className="crypto-value" dir="ltr">
                  {USDT_BEP20_PAYMENT.receivingAddress}
                </code>
                <button
                  className="button button-ghost button-small copy-button"
                  type="button"
                  onClick={() =>
                    void copyValue(USDT_BEP20_PAYMENT.receivingAddress, "address")
                  }
                >
                  <CopyIcon className="inline-icon" />
                  {t("checkout.copyAddress")}
                </button>
              </div>
              <p className="form-note">{t("checkout.receivingWalletNote")}</p>
            </div>

            <div className="crypto-value-block">
              <div className="crypto-value-heading">
                <span className="crypto-value-label">{t("checkout.tokenContractLabel")}</span>
              </div>
              <div className="crypto-value-row">
                <code className="crypto-value" dir="ltr">
                  {USDT_BEP20_PAYMENT.tokenContract}
                </code>
                <button
                  className="button button-ghost button-small copy-button"
                  type="button"
                  onClick={() =>
                    void copyValue(USDT_BEP20_PAYMENT.tokenContract, "contract")
                  }
                >
                  <CopyIcon className="inline-icon" />
                  {t("checkout.copyContract")}
                </button>
              </div>
              <p className="form-note">{t("checkout.tokenContractNote")}</p>
            </div>

            <p className="copy-status" role="status" aria-live="polite">
              {copyMessage}
            </p>

            <div className="crypto-qr-preview">
              <span className="crypto-qr-icon" aria-hidden="true">
                <QrIcon />
              </span>
              <div>
                <strong>{t("checkout.qrPreviewTitle")}</strong>
                <p>{t("checkout.qrPreviewBody")}</p>
              </div>
            </div>

            <div className="callout callout-warning" role="note">
              <AlertIcon className="inline-icon" />
              <div className="crypto-callout-body">
                <p>
                  <strong>{t("checkout.addressUnverifiedTitle")}</strong>
                </p>
                <p>{t("checkout.addressUnverifiedBody")}</p>
                <p>{t("checkout.cryptoNetworkWarning")}</p>
              </div>
            </div>

            <div className="crypto-section" aria-labelledby={instructionsId}>
              <h3 id={instructionsId}>{t("checkout.paymentInstructionsTitle")}</h3>
              <ol className="crypto-instruction-list">
                <li>{t("checkout.cryptoInstruction1")}</li>
                <li>
                  {t("checkout.cryptoInstruction2", {
                    amount: `${usdtAmount} ${USDT_BEP20_PAYMENT.asset}`,
                  })}
                </li>
                <li>{t("checkout.cryptoInstruction3")}</li>
                <li>{t("checkout.cryptoInstruction4")}</li>
              </ol>
            </div>

            <div className="crypto-section">
              <h3>{t("checkout.walletOptionsTitle")}</h3>
              <div className="wallet-chip-list">
                {WALLET_NAMES.map((wallet) => (
                  <span className="wallet-chip" key={wallet}>
                    {wallet}
                  </span>
                ))}
              </div>
              <div className="wallet-guide-grid">
                <div className="wallet-guide">
                  <h4>{t("checkout.walletMetaMaskTrustTitle")}</h4>
                  <ul>
                    <li>{t("checkout.walletMetaMaskStep1")}</li>
                    <li>{t("checkout.walletMetaMaskStep2")}</li>
                    <li>{t("checkout.walletMetaMaskStep3")}</li>
                    <li>{t("checkout.walletMetaMaskStep4")}</li>
                  </ul>
                </div>
                <div className="wallet-guide">
                  <h4>{t("checkout.walletBinanceTitle")}</h4>
                  <ul>
                    <li>{t("checkout.walletBinanceStep1")}</li>
                    <li>{t("checkout.walletBinanceStep2")}</li>
                    <li>{t("checkout.walletBinanceStep3")}</li>
                    <li>{t("checkout.walletBinanceStep4")}</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="crypto-section">
              <h3>{t("checkout.cryptoStatusLabel")}</h3>
              <ol className="crypto-status-list">
                <li className="is-current">
                  <span className="crypto-status-dot" aria-hidden="true" />
                  <span className="crypto-status-body">
                    <strong>{t("checkout.statusAwaiting")}</strong>
                    <span className="crypto-status-badge">{t("checkout.previewBadge")}</span>
                  </span>
                </li>
                <li>
                  <span className="crypto-status-dot" aria-hidden="true" />
                  <span className="crypto-status-body">
                    <strong>{t("checkout.statusVerifying")}</strong>
                  </span>
                </li>
                <li>
                  <span className="crypto-status-dot" aria-hidden="true" />
                  <span className="crypto-status-body">
                    <strong>{t("checkout.statusConfirmed")}</strong>
                    <span className="crypto-status-note">
                      {t("checkout.statusConfirmedNote")}
                    </span>
                  </span>
                </li>
              </ol>
              <p className="form-note">{t("checkout.statusPreviewNote")}</p>
              <p className="form-note">{t("checkout.cryptoPreviewBody")}</p>
            </div>

            <div className="checkout-actions">
              <button className="button button-wide" type="button" disabled>
                <LockIcon className="inline-icon" />
                {t("checkout.verificationDisabled")}
              </button>
            </div>
            <p className="form-note">
              <LockIcon className="inline-icon" /> {t("checkout.previewOnlyNote")}
            </p>
          </section>
        ) : (
          <section
            className="payment-detail-panel card-payment-panel"
            aria-labelledby={cardHeadingId}
          >
            <div className="payment-detail-head">
              <div>
                <p className="eyebrow">{t("checkout.paymentPreviewLabel")}</p>
                <h2 id={cardHeadingId}>{t("checkout.cardPreviewTitle")}</h2>
                <p className="muted">{t("checkout.cardLead")}</p>
              </div>
              <span className="badge badge-warning">{t("checkout.cardPreviewStatus")}</span>
            </div>

            <CardDetailsFields cardReady={false} />

            <div className="callout callout-warning" role="note">
              <AlertIcon className="inline-icon" />
              <p>{t("checkout.cardPreviewBody")}</p>
            </div>
            <p className="form-note">{t("checkout.cardPreviewDetail")}</p>

            <div className="checkout-actions">
              <button className="button button-wide" type="button" disabled>
                <LockIcon className="inline-icon" />
                {t("checkout.paymentDisabled")}
              </button>
            </div>
            <p className="form-note">
              <LockIcon className="inline-icon" /> {t("checkout.previewOnlyNote")}
            </p>
          </section>
        )}
      </div>
    </section>
  );
}

async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the local selection fallback.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy failed");
}
