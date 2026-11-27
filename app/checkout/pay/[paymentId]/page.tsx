import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { loadAuthorizedMockPayment } from "@/lib/payment-access";
import { appUrl, mockCommerceAllowed, onlineCheckoutAvailable } from "@/lib/config";
import { isWhopCheckoutUrl, whopMode } from "@/lib/integrations/payment/whop";
import { getOrderItems } from "@/lib/orders";
import { WhopEmbeddedCheckout } from "@/components/whop-embedded-checkout";
import { formatData, formatMoney } from "@/lib/money";
import { AlertIcon, ArrowRight, LockIcon, ShieldIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/checkout/pay",
    title: t("payment.metaTitle"),
    description: t("payment.lead"),
    robots: { index: false, follow: false },
  });
}

/**
 * Checkout step 2 for card payments. Whop's payment form (card, and Apple Pay
 * / Google Pay where supported) is embedded on this esimprove.com page inside
 * the normal checkout layout. Customers are never sent to whop.com: there is
 * no hosted-checkout link or redirect here. The order is paid only when the
 * signature-verified Whop webhook confirms it.
 */
export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { t, href, locale } = await getI18n();
  const { paymentId } = await params;
  const flags = await searchParams;
  const token = flags.token ?? null;
  const db = await getDb();
  const authorized = await loadAuthorizedMockPayment(db, paymentId, token);
  if (!authorized) notFound();
  const { payment, order } = authorized;

  // Preserve the original mock-payment gate. A recorded Whop payment remains
  // viewable by its owner even while checkout is disabled, but it can only be
  // opened again when the storefront currently allows online checkout.
  if (payment.provider === "mock" && !mockCommerceAllowed) notFound();

  if (payment.status === "paid") {
    const query = new URLSearchParams({ order: order.orderNumber });
    if (token) query.set("token", token);
    redirect(`/checkout/success?${query.toString()}`);
  }

  const failed = payment.status === "failed";
  const isWhop = payment.provider === "whop";
  const canResume =
    isWhop &&
    !failed &&
    payment.status === "pending" &&
    onlineCheckoutAvailable() &&
    isWhopCheckoutUrl(payment.checkoutUrl);
  // Embed only while the payment still points at the checkout configuration
  // (`ch_...`) created for this order; Whop prices it from our database.
  const mode = whopMode();
  const embed =
    canResume && payment.providerPaymentId.startsWith("ch_") && (mode === "sandbox" || mode === "live")
      ? {
          checkoutConfigurationId: payment.providerPaymentId,
          environment: mode === "sandbox" ? ("sandbox" as const) : ("production" as const),
          // Whop sends the customer back to our own confirmation page.
          returnUrl: `${appUrl}/checkout/success?${new URLSearchParams({
            order: order.orderNumber,
            ...(token ? { token } : {}),
          }).toString()}`,
        }
      : null;
  const orderHref = `/orders/${order.orderNumber}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  const items = await getOrderItems(db, order.id);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("payment.stepLabel")}</p>
          <h1>
            {failed ? t("payment.failedTitle") : embed ? t("payment.embedPageTitle") : t("payment.awaitingTitle")}
          </h1>
          <p className="muted">
            {failed ? t("payment.failedLead") : embed ? t("payment.embedPageLead") : t("payment.awaitingLead")}
          </p>
        </div>
      </div>

      <div className="checkout-layout">
        <section className="card checkout-pay-card" aria-labelledby="payment-embed-title">
          {embed ? (
            <>
              <div className="checkout-pay-head">
                <h2 id="payment-embed-title">{t("payment.embedTitle")}</h2>
                <span className="checkout-pay-secure">
                  <LockIcon className="inline-icon" /> {t("payment.secureBadge")}
                </span>
              </div>
              <p className="form-note">{t("payment.walletNote")}</p>
              <WhopEmbeddedCheckout
                checkoutConfigurationId={embed.checkoutConfigurationId}
                environment={embed.environment}
                returnUrl={embed.returnUrl}
                locale={locale}
                labels={{
                  loading: t("payment.embedLoading"),
                  loadFailed: t("payment.embedLoadFailed"),
                  retry: t("payment.embedRetry"),
                  sandboxNotice: t("payment.sandboxNotice"),
                }}
              />
              <p className="form-note checkout-pay-note">
                <ShieldIcon className="inline-icon" /> {t("payment.whopBody")}
              </p>
            </>
          ) : (
            <>
              <h2 id="payment-embed-title">
                {t("payment.order")} {order.orderNumber}
              </h2>
              {failed ? (
                <div className="callout callout-warning">
                  <AlertIcon className="inline-icon" />
                  <p>{t("payment.failedNotice")}</p>
                </div>
              ) : null}
              <p>
                {isWhop && !failed
                  ? t("payment.embedUnavailable")
                  : t("payment.contactBody", { orderNumber: order.orderNumber })}
              </p>
              <div className="payment-actions">
                <Link className="button" href={href(orderHref)}>
                  {t("payment.viewOrder")} <ArrowRight className="inline-icon" />
                </Link>
                <Link className="button button-secondary" href={href("/contact")}>
                  {t("common.contactSupport")}
                </Link>
                <Link className="button button-ghost" href={href("/plans")}>
                  {t("payment.continueShopping")}
                </Link>
              </div>
            </>
          )}
        </section>

        <aside className="checkout-sidebar" aria-label={t("checkout.orderSummaryAria")}>
          <section className="card summary-card">
            <h2>{t("checkout.orderSummary")}</h2>
            <div className="summary-row">
              <span>{t("payment.order")}</span>
              <span dir="ltr">{order.orderNumber}</span>
            </div>
            {items.map((item) => (
              <div className="summary-row" key={item.id}>
                <span>
                  {item.planName}
                  {item.dataMb ? ` · ${formatData(item.dataMb)}` : ""} × {item.quantity}
                </span>
                <span dir="ltr">{formatMoney(item.totalMinor, item.currency, locale)}</span>
              </div>
            ))}
            {order.email ? (
              <div className="summary-row">
                <span>{t("payment.email")}</span>
                <span>{order.email}</span>
              </div>
            ) : null}
            <div className="summary-total">
              <span>{t("payment.amount")}</span>
              <span dir="ltr">{formatMoney(payment.amountMinor, payment.currency, locale)}</span>
            </div>
            <p className="form-note">{t("payment.summaryNote")}</p>
          </section>
          <div className="callout">
            <ShieldIcon className="inline-icon" />
            <p>{t("checkout.paymentNotice")}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
