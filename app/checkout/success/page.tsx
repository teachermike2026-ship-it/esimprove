import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewOrder, getOrderViewByNumber } from "@/lib/orders";
import { OrderDetail } from "@/components/order-detail";
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

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const { t, href } = await getI18n();
  const { order: orderNumber, token } = await searchParams;
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
      <OrderDetail view={view} accessToken={token} />
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
