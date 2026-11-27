import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewOrder, getOrderViewByNumber } from "@/lib/orders";
import { OrderDetail } from "@/components/order-detail";
import { PaymentStatusRefresher } from "@/components/payment-status-refresher";
import { ArrowRight } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/checkout/success",
    title: t("success.metaTitle"),
    robots: { index: false, follow: false },
  });
}

/** Paid orders in these states are still being issued: keep re-reading. */
const FULFILLMENT_IN_PROGRESS = new Set(["not_started", "queued", "processing", "provisioning"]);

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string; status?: string }>;
}) {
  const { t, href } = await getI18n();
  // `status` is appended by Whop's embedded checkout on return. It is shown
  // as information only; payment status always comes from the database,
  // which only the verified webhook updates.
  const { order: orderNumber, token, status: returnStatus } = await searchParams;
  if (!orderNumber) {
    notFound();
  }

  const db = await getDb();
  const view = await getOrderViewByNumber(db, orderNumber);
  if (!view) {
    notFound();
  }

  const user = await getCurrentUser();
  const allowed = await canViewOrder(db, view.order, {
    userId: user?.id ?? null,
    role: user?.role ?? null,
    token: token ?? null,
  });
  if (!allowed) {
    notFound();
  }

  const paid = view.order.paymentStatus === "paid";
  const failed = view.order.paymentStatus === "failed";

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("order.eyebrow")}</p>
          <h1>
            {paid
              ? t("success.paidTitle")
              : failed
                ? t("success.failedTitle")
                : t("success.pendingTitle")}
          </h1>
          <p className="lead">
            {paid
              ? t("success.paidLead")
              : failed
                ? t("success.failedLead")
                : t("success.pendingLead")}
          </p>
        </div>
      </div>
      {!paid && (returnStatus === "failed" || returnStatus === "canceled") ? (
        <div className="callout callout-warning" role="status">
          <p>
            <strong>{t("success.notCompletedTitle")}</strong> {t("success.notCompletedBody")}
          </p>
        </div>
      ) : null}
      {!paid && !failed ? <PaymentStatusRefresher /> : null}
      {paid && FULFILLMENT_IN_PROGRESS.has(view.order.fulfillmentStatus) ? (
        <PaymentStatusRefresher intervalMs={4000} maxAttempts={90} />
      ) : null}
      <OrderDetail view={view} accessToken={token} showActivation />
      <div className="hero-actions section-tight">
        <Link
          className="button"
          href={href(
            `/orders/${view.order.orderNumber}${token ? `?token=${encodeURIComponent(token)}` : ""}`,
          )}
        >
          {t("success.openOrder")} <ArrowRight className="inline-icon" />
        </Link>
        <Link className="button button-secondary" href={href("/portal")}>
          {t("success.customerPortal")}
        </Link>
      </div>
    </>
  );
}
