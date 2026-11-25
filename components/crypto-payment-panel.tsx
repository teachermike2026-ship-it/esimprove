"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  CryptoIcon,
  QrIcon,
  ShieldIcon,
} from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";

export type CryptoPanelStatus =
  | "pending"
  | "confirming"
  | "paid"
  | "expired"
  | "late_payment"
  | "manual_review"
  | "verification_error";

export interface CryptoPaymentPanelProps {
  orderId: string;
  orderNumber: string;
  reference: string;
  amountUsdt: string;
  assetSymbol: string;
  asset: string;
  network: string;
  standard: string;
  chainId: number;
  wallet: string;
  tokenContract: string;
  expiresAt: string;
  serverNow: string;
  initialStatus: string;
  initialConfirmations: number;
  requiredConfirmations: number;
  initialTxHash: string | null;
  bscScanTxBaseUrl: string;
  verificationIntervalSeconds: number;
  accessToken: string | null;
  qrDataUrl: string;
}

type RequestError =
  | "rate_limited"
  | "unavailable"
  | "not_found"
  | "request_failed"
  | null;

interface VerifyApiResult {
  status: CryptoPanelStatus;
  messageCode: string;
  confirmations: number;
  requiredConfirmations: number;
  txHash: string | null;
  amountUsdt: string;
  amountRaw: string;
  reference: string;
  expiresAt: string;
  serverNow: string;
  paidAt: string | null;
}

const STATUS_VALUES: CryptoPanelStatus[] = [
  "pending",
  "confirming",
  "paid",
  "expired",
  "late_payment",
  "manual_review",
  "verification_error",
];

function isPanelStatus(value: unknown): value is CryptoPanelStatus {
  return typeof value === "string" && STATUS_VALUES.includes(value as CryptoPanelStatus);
}

function isTxHash(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function shouldPoll(status: CryptoPanelStatus): boolean {
  return (
    status === "pending" ||
    status === "confirming" ||
    status === "expired" ||
    status === "verification_error"
  );
}

function CopyField({
  value,
  label,
  copiedLabel,
  failedLabel,
  className = "",
}: {
  value: string;
  label: string;
  copiedLabel: string;
  failedLabel: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 3000);
  }, [value]);

  return (
    <span className={`crypto-copy-wrap ${className}`.trim()}>
      <button className="button button-secondary button-small crypto-copy-button" type="button" onClick={copy}>
        {state === "copied" ? <CheckIcon className="inline-icon" /> : <CopyIcon className="inline-icon" />}
        <span>{label}</span>
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {state === "copied" ? copiedLabel : state === "failed" ? failedLabel : ""}
      </span>
    </span>
  );
}

/**
 * Customer-facing crypto payment panel.
 *
 * The amount, wallet, contract, reference, and expiry are always rendered from
 * server data. The browser may ask the server to verify a transaction, but it
 * can never mark the order paid; only the server-side verifier can do that.
 */
export function CryptoPaymentPanel(props: CryptoPaymentPanelProps) {
  const { t, href } = useI18n();
  const {
    orderId,
    orderNumber,
    reference,
    amountUsdt,
    assetSymbol,
    asset,
    network,
    standard,
    chainId,
    wallet,
    tokenContract,
    expiresAt,
    serverNow,
    requiredConfirmations,
    bscScanTxBaseUrl,
    verificationIntervalSeconds,
    accessToken,
    qrDataUrl,
  } = props;

  const initialStatus: CryptoPanelStatus = isPanelStatus(props.initialStatus)
    ? props.initialStatus
    : "pending";

  const [status, setStatus] = useState<CryptoPanelStatus>(initialStatus);
  const [confirmations, setConfirmations] = useState(props.initialConfirmations);
  const [txHash, setTxHash] = useState<string | null>(
    props.initialTxHash && isTxHash(props.initialTxHash) ? props.initialTxHash : null,
  );
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [requestError, setRequestError] = useState<RequestError>(null);
  const [messageCode, setMessageCode] = useState<string | null>(null);
  const [txInput, setTxInput] = useState("");
  const [txInputError, setTxInputError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, Date.parse(expiresAt) - Date.parse(serverNow)),
  );

  const inFlight = useRef(false);
  const serverOffset = useRef(0);

  useEffect(() => {
    // The initial remaining time above is derived from server values only.
    // Measure the local clock offset inside an effect so render stays pure.
    serverOffset.current = Date.parse(serverNow) - Date.now();
    const tick = () => {
      const serverTime = Date.now() + serverOffset.current;
      setRemainingMs(Math.max(0, Date.parse(expiresAt) - serverTime));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, serverNow]);

  const check = useCallback(
    async (submittedTxHash?: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setChecking(true);
      setRequestError(null);
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/verify`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token: accessToken ?? undefined,
            txHash: submittedTxHash,
          }),
          cache: "no-store",
        });

        if (response.status === 429) {
          setRequestError("rate_limited");
          return;
        }
        if (response.status === 503) {
          setRequestError("unavailable");
          return;
        }
        if (response.status === 404) {
          setRequestError("not_found");
          return;
        }
        if (!response.ok) {
          setRequestError("request_failed");
          return;
        }

        const payload = (await response.json()) as { ok?: unknown; result?: unknown };
        if (!payload.ok || !payload.result || typeof payload.result !== "object") {
          setRequestError("request_failed");
          return;
        }
        const result = payload.result as Partial<VerifyApiResult>;
        if (!isPanelStatus(result.status)) {
          setRequestError("request_failed");
          return;
        }

        setStatus(result.status);
        setConfirmations(
          typeof result.confirmations === "number" && Number.isFinite(result.confirmations)
            ? result.confirmations
            : 0,
        );
        setTxHash(typeof result.txHash === "string" && isTxHash(result.txHash) ? result.txHash : null);
        setPaidAt(typeof result.paidAt === "string" ? result.paidAt : null);
        setMessageCode(typeof result.messageCode === "string" ? result.messageCode : null);
        if (result.status === "paid") setTxInput("");
      } catch {
        setRequestError("request_failed");
      } finally {
        inFlight.current = false;
        setChecking(false);
      }
    },
    [accessToken, orderId],
  );

  useEffect(() => {
    if (!shouldPoll(status)) return;
    const interval = window.setInterval(
      () => {
        void check();
      },
      Math.max(5, verificationIntervalSeconds) * 1000,
    );
    return () => window.clearInterval(interval);
  }, [check, status, verificationIntervalSeconds]);

  const submitTx = useCallback(() => {
    const candidate = txInput.trim();
    if (!isTxHash(candidate)) {
      setTxInputError("checkout.cryptoTxHashInvalid");
      return;
    }
    setTxInputError(null);
    void check(candidate);
  }, [check, txInput]);

  const statusKey: Record<CryptoPanelStatus, string> = {
    pending: "checkout.cryptoStatusPending",
    confirming: "checkout.cryptoStatusConfirming",
    paid: "checkout.cryptoStatusPaid",
    expired: "checkout.cryptoStatusExpired",
    late_payment: "checkout.cryptoStatusLate",
    manual_review: "checkout.cryptoStatusManualReview",
    verification_error: "checkout.cryptoStatusError",
  };

  const statusClass: Record<CryptoPanelStatus, string> = {
    pending: "badge badge-warning",
    confirming: "badge badge-warning",
    paid: "badge badge-success",
    expired: "badge badge-neutral",
    late_payment: "badge badge-warning",
    manual_review: "badge badge-warning",
    verification_error: "badge badge-danger",
  };

  const expired = remainingMs <= 0;
  const showConfirmations = status === "confirming" || status === "paid";
  const showScanLink = txHash !== null;
  const successHref = `${href("/checkout/success")}?order=${encodeURIComponent(orderNumber)}${
    accessToken ? `&token=${encodeURIComponent(accessToken)}` : ""
  }`;

  return (
    <section className="card crypto-payment-panel" aria-labelledby="crypto-payment-title">
      <div className="crypto-payment-head">
        <div>
          <p className="eyebrow">
            <CryptoIcon className="inline-icon" /> {t("checkout.cryptoPageMetaTitle")}
          </p>
          <h2 id="crypto-payment-title">{t("checkout.cryptoPaymentTitle")}</h2>
          <p className="muted">{t("checkout.cryptoPaymentLead")}</p>
        </div>
        <span className={statusClass[status]} role="status">
          {t(statusKey[status])}
        </span>
      </div>

      <div className="crypto-amount-hero">
        <span className="crypto-amount-label">{t("checkout.cryptoAmountLabel")}</span>
        <span className="crypto-amount-value" dir="ltr">
          {amountUsdt} <span>{assetSymbol}</span>
        </span>
        <p className="crypto-amount-line">
          {t("checkout.cryptoSendExactly", { amount: amountUsdt, symbol: assetSymbol })}
        </p>
        <p className="crypto-amount-note">{t("checkout.cryptoAmountNote")}</p>
        <CopyField
          value={amountUsdt}
          label={t("checkout.cryptoCopyAmount")}
          copiedLabel={t("checkout.cryptoCopied")}
          failedLabel={t("checkout.cryptoCopyFailed")}
          className="crypto-copy-on-dark"
        />
      </div>

      <dl className="crypto-payment-meta">
        <div>
          <dt>{t("checkout.cryptoOrderLabel")}</dt>
          <dd dir="ltr">{orderNumber}</dd>
        </div>
        <div>
          <dt>{t("checkout.cryptoReferenceLabel")}</dt>
          <dd dir="ltr">{reference}</dd>
        </div>
        <div>
          <dt>{t("checkout.cryptoAssetLabel")}</dt>
          <dd dir="ltr">{asset}</dd>
        </div>
        <div>
          <dt>{t("checkout.networkLabel")}</dt>
          <dd dir="ltr">
            {network} · {standard}
          </dd>
        </div>
        <div>
          <dt>{t("checkout.cryptoChainIdLabel")}</dt>
          <dd dir="ltr">{chainId}</dd>
        </div>
        <div>
          <dt>{t("checkout.cryptoConfirmationsRequired")}</dt>
          <dd>{requiredConfirmations}</dd>
        </div>
      </dl>

      <div className="crypto-payment-grid">
        <div className="crypto-qr-card">
          {qrDataUrl ? (
            <Image
              src={qrDataUrl}
              alt={t("checkout.cryptoQrAlt", { address: wallet })}
              width={280}
              height={280}
              unoptimized
            />
          ) : (
            <div className="crypto-qr-icon" aria-hidden="true">
              <QrIcon />
            </div>
          )}
          <p>
            <QrIcon className="inline-icon" /> {t("checkout.cryptoQrNote")}
          </p>
        </div>

        <div className="crypto-payment-details">
          <div className="crypto-value-block">
            <span className="crypto-value-label">{t("checkout.receivingWalletLabel")}</span>
            <span className="crypto-value" dir="ltr">
              {wallet}
            </span>
            <CopyField
              value={wallet}
              label={t("checkout.cryptoCopyWallet")}
              copiedLabel={t("checkout.cryptoCopied")}
              failedLabel={t("checkout.cryptoCopyFailed")}
            />
            <p className="form-note">{t("checkout.receivingWalletNote")}</p>
          </div>

          <div className="crypto-value-block">
            <span className="crypto-value-label">{t("checkout.tokenContractLabel")}</span>
            <span className="crypto-value" dir="ltr">
              {tokenContract}
            </span>
            <CopyField
              value={tokenContract}
              label={t("checkout.cryptoCopyContract")}
              copiedLabel={t("checkout.cryptoCopied")}
              failedLabel={t("checkout.cryptoCopyFailed")}
            />
            <p className="form-note">{t("checkout.tokenContractNote")}</p>
          </div>
        </div>
      </div>

      <div className="callout callout-warning" role="note">
        <AlertIcon className="inline-icon" />
        <div className="crypto-callout-body">
          <strong>{t("checkout.cryptoNetworkWarningTitle")}</strong>
          <p>{t("checkout.cryptoNetworkWarning")}</p>
        </div>
      </div>

      <div className="crypto-verification-card" aria-live="polite">
        <div className="crypto-verification-head">
          <div className="crypto-countdown">
            <ClockIcon className="inline-icon" />
            <span>{t("checkout.cryptoCountdownLabel")}</span>
            <strong dir="ltr" className={expired ? "is-expired" : ""}>
              {expired ? t("checkout.cryptoExpired") : formatCountdown(remainingMs)}
            </strong>
          </div>
          <button
            className="button button-secondary button-small"
            type="button"
            onClick={() => void check()}
            disabled={checking}
          >
            {checking ? t("checkout.cryptoChecking") : t("checkout.cryptoCheckNow")}
          </button>
        </div>

        <p className="crypto-status-note">{t(statusKey[status] + "Note")}</p>

        {showConfirmations ? (
          <div className="crypto-confirmations">
            <div
              className="crypto-confirmations-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={requiredConfirmations}
              aria-valuenow={Math.min(confirmations, requiredConfirmations)}
              aria-label={t("checkout.cryptoConfirmationsLabel")}
            >
              <span
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((confirmations / Math.max(1, requiredConfirmations)) * 100),
                  )}%`,
                }}
              />
            </div>
            <span>
              {t("checkout.cryptoConfirmationsProgress", {
                confirmations: Math.min(confirmations, requiredConfirmations),
                required: requiredConfirmations,
              })}
            </span>
          </div>
        ) : null}

        {status === "paid" ? (
          <div className="callout crypto-success-callout">
            <CheckIcon className="inline-icon" />
            <div className="crypto-callout-body">
              <strong>{t("checkout.cryptoPaidTitle")}</strong>
              <p>{t("checkout.cryptoPaidBody")}</p>
              {paidAt ? (
                <p className="form-note">
                  {t("checkout.cryptoPaidAt", {
                    date: new Date(paidAt).toISOString().replace("T", " ").slice(0, 19) + " UTC",
                  })}
                </p>
              ) : null}
              <a className="button button-small" href={successHref}>
                {t("checkout.cryptoViewOrder")}
              </a>
            </div>
          </div>
        ) : null}

        {showScanLink ? (
          <p className="crypto-tx-link">
            <span>{t("checkout.cryptoTxHashLabel")}</span>{" "}
            <a
              href={`${bscScanTxBaseUrl}${txHash}`}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="crypto-mono"
            >
              {txHash}
            </a>{" "}
            <span className="crypto-link-note">({t("checkout.cryptoViewOnBscScan")})</span>
          </p>
        ) : null}

        <p className="form-note">
          {t("checkout.cryptoAutoDetectNote", { seconds: verificationIntervalSeconds })}
        </p>

        {requestError ? (
          <div className="form-error" role="alert">
            <AlertIcon className="inline-icon" />
            <span>
              {requestError === "rate_limited"
                ? t("checkout.cryptoRateLimited")
                : requestError === "unavailable"
                  ? t("checkout.cryptoUnavailableError")
                  : requestError === "not_found"
                    ? t("checkout.cryptoNotFoundError")
                    : t("checkout.cryptoRequestFailed")}
            </span>
          </div>
        ) : null}

        {messageCode === "transaction_failed" ? (
          <div className="form-error" role="alert">
            <AlertIcon className="inline-icon" />
            <span>{t("checkout.cryptoTransactionFailed")}</span>
          </div>
        ) : null}

        {!showScanLink && status !== "paid" ? (
          <div className="crypto-tx-fallback">
            <label htmlFor="crypto-tx-hash">{t("checkout.cryptoTxHashFieldLabel")}</label>
            <div className="crypto-tx-row">
              <input
                id="crypto-tx-hash"
                type="text"
                value={txInput}
                onChange={(event) => {
                  setTxInput(event.target.value);
                  if (txInputError) setTxInputError(null);
                }}
                placeholder={t("checkout.cryptoTxHashPlaceholder")}
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
                aria-invalid={txInputError ? true : undefined}
                aria-describedby={txInputError ? "crypto-tx-hash-error" : "crypto-tx-hash-note"}
                maxLength={66}
              />
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={submitTx}
                disabled={checking || txInput.trim() === ""}
              >
                {t("checkout.cryptoSubmitTx")}
              </button>
            </div>
            {txInputError ? (
              <p className="form-error" id="crypto-tx-hash-error" role="alert">
                <AlertIcon className="inline-icon" /> {t(txInputError)}
              </p>
            ) : (
              <p className="form-note" id="crypto-tx-hash-note">
                {t("checkout.cryptoTxHashNote")}
              </p>
            )}
          </div>
        ) : null}

      </div>

      <div className="crypto-section">
        <h3>
          <ShieldIcon className="inline-icon" /> {t("checkout.paymentInstructionsTitle")}
        </h3>
        <ol className="crypto-instruction-list">
          <li>{t("checkout.cryptoInstructionNetwork")}</li>
          <li>{t("checkout.cryptoInstructionExact", { amount: amountUsdt, symbol: assetSymbol })}</li>
          <li>{t("checkout.cryptoInstructionFees")}</li>
          <li>{t("checkout.cryptoInstructionSupport")}</li>
        </ol>
        <p className="form-note">{t("checkout.cryptoKeepOpen")}</p>
      </div>

      <div className="crypto-section">
        <h3>{t("checkout.cryptoWalletHelpTitle")}</h3>
        <p className="muted">{t("checkout.cryptoWalletHelpBody")}</p>
        <p className="form-note">{t("checkout.cryptoNoAutoAmountNote")}</p>
      </div>

      <p className="crypto-required-note">
        {t("checkout.cryptoRequiredConfirmationsNote", { count: requiredConfirmations })}
      </p>
    </section>
  );
}
