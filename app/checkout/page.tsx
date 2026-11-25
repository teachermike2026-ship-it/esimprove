import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getCartView } from "@/lib/cart";
import { readCartToken } from "@/lib/cart-session";
import { getCurrentUser } from "@/lib/auth/session";
import { CheckoutForm } from "@/components/checkout-form";
import { CheckoutPaymentPreview } from "@/components/checkout-payment-preview";
import { EmptyState } from "@/components/empty-state";
import { formatData, formatMoney } from "@/lib/money";
import { formatPreviewUsdtAmount } from "@/lib/crypto-payment";
import { newId } from "@/lib/ids";
import { onlineCheckoutAvailable, paymentProviderKey } from "@/lib/config";
import { AlertIcon, ArrowRight, ShieldIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { demoPlan, demoProductEnabled } from "@/lib/demo-plan";
import { loadCryptoPaymentConfig } from "@/lib/payments/crypto/config";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/checkout",
    title: t("checkout.metaTitle"),
    description: t("checkout.metaDescription"),
    robots: { index: false, follow: false },
  });
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const params = await searchParams;
  const { t, href, locale } = await getI18n();

  // Local-only visual preview of the checkout interface. This branch is
  // intentionally before the cart, database, and payment-provider checks: it
  // never reads a cart, creates an order, verifies a transaction, or calls Whop.
  if (params.demo === "1") {
    if (!demoProductEnabled()) notFound();
    const demoTotal = formatMoney(demoPlan.priceMinor, demoPlan.currency, locale);
    const usdtAmount = formatPreviewUsdtAmount(
      demoPlan.priceMinor,
      demoPlan.currency,
      locale,
    );
    return (
      <>
        <div className="section-heading">
          <div>
            <p>
              <span className="badge badge-demo">{t("demo.badge")}</span>
            </p>
            <p className="eyebrow">{t("checkout.eyebrow")}</p>
            <h1>{t("demo.previewTitle")}</h1>
            <p className="muted">{t("demo.previewLead")}</p>
          </div>
        </div>

        <div className="callout callout-warning section-tight" role="status">
          <AlertIcon className="inline-icon" />
          <p>
            <strong>{t("demo.previewBannerTitle")}</strong>{" "}
            {t("demo.previewBannerBody")}
          </p>
        </div>

        <div className="checkout-layout">
          <CheckoutPaymentPreview usdtAmount={usdtAmount} sourceAmount={demoTotal} />

          <aside className="checkout-sidebar" aria-label={t("checkout.orderSummaryAria")}>
            <section className="card summary-card">
              <h2>{t("checkout.orderSummary")}</h2>
              <div className="summary-row">
                <span>{t("checkout.orderProduct")}</span>
                <span>{demoPlan.name}</span>
              </div>
              <div className="summary-row">
                <span>{t("checkout.orderRegion")}</span>
                <span>{demoPlan.destinationName}</span>
              </div>
              <div className="summary-row">
                <span>{t("catalog.data")}</span>
                <span dir="ltr">{formatData(demoPlan.dataMb)}</span>
              </div>
              <div className="summary-row">
                <span>{t("catalog.validity")}</span>
                <span>
                  {demoPlan.validityDays} {t("common.days")}
                </span>
              </div>
              <div className="field summary-contact">
                <label htmlFor="demo-checkout-email">{t("checkout.emailForOrder")}</label>
                <input
                  id="demo-checkout-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("checkout.emailPlaceholder")}
                />
                <p className="form-note">{t("checkout.orderContactNote")}</p>
              </div>
              <div className="summary-row">
                <span>{t("checkout.subtotal")}</span>
                <span dir="ltr">{demoTotal}</span>
              </div>
              <div className="summary-row">
                <span>{t("checkout.taxEstimate")}</span>
                <span dir="ltr">{formatMoney(0, demoPlan.currency, locale)}</span>
              </div>
              <div className="summary-total">
                <span>{t("checkout.totalDue")}</span>
                <span dir="ltr">{demoTotal}</span>
              </div>
              <p className="form-note">{t("demo.priceNote")}</p>
              <Link
                className="button button-ghost button-small"
                href={href(`/plans/${demoPlan.slug}`)}
              >
                {t("demo.backToProduct")} <ArrowRight className="inline-icon" />
              </Link>
            </section>
            <div className="callout callout-warning">
              <AlertIcon className="inline-icon" />
              <p>{t("demo.previewWhopNote")}</p>
            </div>
          </aside>
        </div>
      </>
    );
  }

  const cryptoAvailable = loadCryptoPaymentConfig() !== null;
  // Card is offered only when the real Whop checkout is configured. Nothing
  // here calls Whop; this only reads server configuration.
  const cardReady = paymentProviderKey() === "whop" && onlineCheckoutAvailable();

  if (!onlineCheckoutAvailable() && !cryptoAvailable) {
    return (
      <EmptyState
        title={t("checkout.unavailableTitle")}
        action={{ href: href("/plans"), label: t("common.browsePlans") }}
      >
        {t("checkout.unavailableBody")}
      </EmptyState>
    );
  }
  const token = await readCartToken();
  if (!token) redirect("/cart");
  const db = await getDb();
  const cart = await getCartView(db, token);
  if (!cart || cart.lines.length === 0) redirect("/cart");
  const user = await getCurrentUser();
  const idempotencyKey = newId("checkout");
  const hasUnavailable = cart.lines.some((line) => line.status !== "published");
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("checkout.eyebrow")}</p>
          <h1>{t("checkout.title")}</h1>
          <p className="muted">{t("checkout.lead")}</p>
        </div>
      </div>

      {hasUnavailable ? (
        <div className="callout callout-warning section-tight">
          <AlertIcon className="inline-icon" />
          <p>{t("checkout.unavailableNotice")}</p>
        </div>
      ) : null}

      <div className="checkout-layout">
        <CheckoutForm
          idempotencyKey={idempotencyKey}
          defaultEmail={user?.email ?? ""}
          defaultName={user?.name ?? ""}
          disabled={hasUnavailable}
          cryptoAvailable={cryptoAvailable}
          cardReady={cardReady}
        />

        <aside className="checkout-sidebar" aria-label={t("checkout.orderSummaryAria")}>
          <section className="card summary-card">
            <h2>{t("checkout.orderSummary")}</h2>
            {cart.lines.map((line) => (
              <div className="summary-row" key={line.id}>
                <span>
                  {t("checkout.planLine", {
                    country: line.destinationName,
                    data: formatData(line.dataMb),
                    count: line.quantity,
                  })}
                </span>
                <span>{formatMoney(line.unitPriceMinor * line.quantity, line.currency)}</span>
              </div>
            ))}
            <div className="summary-row">
              <span>{t("checkout.subtotal")}</span>
              <span>{formatMoney(cart.subtotalMinor, cart.currency)}</span>
            </div>
            <div className="summary-row">
              <span>{t("checkout.taxEstimate")}</span>
              <span>{formatMoney(cart.taxMinor, cart.currency)}</span>
            </div>
            <div className="summary-total">
              <span>{t("checkout.totalDue")}</span>
              <span>{formatMoney(cart.totalMinor, cart.currency)}</span>
            </div>
            <p className="form-note">
              {cart.taxMinor === 0 ? t("checkout.noTax") : t("checkout.includedTax")}
            </p>
            <Link className="button button-ghost button-small" href={href("/cart")}>
              {t("checkout.editCart")} <ArrowRight className="inline-icon" />
            </Link>
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
