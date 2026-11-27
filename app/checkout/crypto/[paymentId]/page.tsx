import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getDb } from "@/lib/db/client";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { loadAuthorizedCryptoPayment } from "@/lib/payments/crypto/access";
import { loadCryptoPaymentConfig } from "@/lib/payments/crypto/config";
import { CryptoPaymentPanel } from "@/components/crypto-payment-panel";
import { getOrderItems } from "@/lib/orders";
import { formatMoney } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/checkout/crypto",
    title: t("checkout.cryptoPageMetaTitle"),
    description: t("checkout.cryptoPageMetaDescription"),
    robots: { index: false, follow: false },
  });
}

export default async function CryptoPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { t, locale } = await getI18n();
  const { paymentId } = await params;
  const { token } = await searchParams;
  const accessToken = token ?? null;
  const db = await getDb();
  const authorized = await loadAuthorizedCryptoPayment(db, paymentId, accessToken);
  if (!authorized) notFound();

  const { payment, order } = authorized;
  if (order.paymentStatus === "paid" || payment.status === "paid") {
    const query = new URLSearchParams({ order: order.orderNumber });
    if (accessToken) query.set("token", accessToken);
    redirect(`/checkout/success?${query.toString()}`);
  }

  const config = loadCryptoPaymentConfig();
  if (!config) notFound();
  const items = await getOrderItems(db, order.id);

  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(payment.receivingAddress, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 280,
      color: { dark: "#0d2b16", light: "#ffffff" },
    });
  } catch {
    // The address remains visible and copyable; no fake QR is rendered.
    qrDataUrl = "";
  }

  return (
    <div className="crypto-payment-page-wrap">
      <section className="card crypto-order-summary" aria-labelledby="crypto-order-summary-title">
        <h2 id="crypto-order-summary-title">{t("checkout.cryptoOrderSummaryTitle")}</h2>
        <ul className="crypto-order-lines">
          {items.map((item) => (
            <li key={item.id}>
              <span>
                {item.planName} × {item.quantity}
              </span>
              <span dir="ltr">{formatMoney(item.totalMinor, item.currency, locale)}</span>
            </li>
          ))}
        </ul>
        <div className="crypto-order-total">
          <span>{t("checkout.cryptoTotalUsd")}</span>
          <strong dir="ltr">{formatMoney(order.totalMinor, order.currency, locale)}</strong>
        </div>
        <div className="crypto-order-total">
          <span>{t("checkout.cryptoTotalUsdt")}</span>
          <strong dir="ltr">{payment.amountUsdt} USDT</strong>
        </div>
        <p className="form-note">{t("checkout.cryptoUniqueAmountNote")}</p>
      </section>

      <CryptoPaymentPanel
        orderId={order.id}
        orderNumber={order.orderNumber}
        reference={payment.reference}
        amountUsdt={payment.amountUsdt}
        assetSymbol={config.assetSymbol}
        asset={config.asset}
        network={config.network}
        standard={config.standard}
        chainId={config.chainId}
        wallet={payment.receivingAddress}
        tokenContract={payment.tokenContract}
        expiresAt={payment.expiresAt.toISOString()}
        serverNow={new Date().toISOString()}
        initialStatus={payment.status}
        initialConfirmations={payment.confirmations}
        requiredConfirmations={config.confirmationsRequired}
        initialTxHash={payment.txHash}
        bscScanTxBaseUrl={config.bscScanTxBaseUrl}
        verificationIntervalSeconds={config.verificationIntervalSeconds}
        accessToken={accessToken}
        qrDataUrl={qrDataUrl}
      />
    </div>
  );
}
