import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { loadAuthorizedMockPayment } from "@/lib/payment-access";
import { appUrl, mockCommerceAllowed, onlineCheckoutAvailable } from "@/lib/config";
import { isWhopCheckoutUrl, whopMode } from "@/lib/integrations/payment/whop";
import { WhopEmbeddedCheckout } from "@/components/whop-embedded-checkout";
import { formatMoney } from "@/lib/money";
import { AlertIcon, ArrowRight, CreditCardIcon } from "@/components/icons";
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

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { t, href } = await getI18n();
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
          returnUrl: `${appUrl}/checkout/success?${new URLSearchParams({
            order: order.orderNumber,
            ...(token ? { token } : {}),
          }).toString()}`,
        }
      : null;
  const orderHref = `/orders/${order.orderNumber}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  return (
    <div className="centered">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("payment.metaTitle")}</p>
          <h1>
            {failed
              ? t("payment.failedTitle")
              : isWhop
                ? t("payment.awaitingTitle")
                : t("payment.unavailableTitle")}
          </h1>
          <p className="lead">
            {failed
              ? t("payment.failedLead")
              : isWhop
                ? t("payment.awaitingLead")
                : t("payment.unavailableLead")}
          </p>
        </div>
      </div>

      <section className="card payment-card">
        <dl className="meta-list">
          <div>
            <dt>{t("payment.order")}</dt>
            <dd>{order.orderNumber}</dd>
          </div>
          <div>
            <dt>{t("payment.email")}</dt>
            <dd>{order.email}</dd>
          </div>
          <div>
            <dt>{t("payment.amount")}</dt>
            <dd>{formatMoney(payment.amountMinor, payment.currency)}</dd>
          </div>
        </dl>

        {embed ? (
          <section className="payment-embed" aria-labelledby="payment-embed-title">
            <h2 id="payment-embed-title">{t("payment.embedTitle")}</h2>
            <WhopEmbeddedCheckout
              checkoutConfigurationId={embed.checkoutConfigurationId}
              environment={embed.environment}
              returnUrl={embed.returnUrl}
              hostedCheckoutUrl={payment.checkoutUrl}
              labels={{
                loading: t("payment.embedLoading"),
                loadFailed: t("payment.embedLoadFailed"),
                openHosted: t("payment.openHosted"),
                sandboxNotice: t("payment.sandboxNotice"),
              }}
            />
          </section>
        ) : null}

        {failed ? (
          <div className="callout callout-warning">
            <AlertIcon className="inline-icon" />
            <p>{t("payment.failedNotice")}</p>
          </div>
        ) : null}

        <p>
          {isWhop && !failed
            ? t("payment.whopBody")
            : t("payment.contactBody", { orderNumber: order.orderNumber })}
        </p>

        <div className="payment-actions">
          {canResume && !embed ? (
            <a className="button" href={payment.checkoutUrl} rel="noreferrer">
              <CreditCardIcon className="inline-icon" /> {t("payment.securePay")}{" "}
              <ArrowRight className="inline-icon" />
            </a>
          ) : null}
          <Link className="button" href={href(orderHref)}>
            <CreditCardIcon className="inline-icon" /> {t("payment.viewOrder")}{" "}
            <ArrowRight className="inline-icon" />
          </Link>
          <Link className="button button-secondary" href={href("/contact")}>
            {t("common.contactSupport")}
          </Link>
          <Link className="button button-ghost" href={href("/plans")}>
            {t("payment.continueShopping")}
          </Link>
        </div>
      </section>
    </div>
  );
}
