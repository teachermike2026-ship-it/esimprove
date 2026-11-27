import type { Metadata } from "next";
import { PaymentStatusRefresher } from "@/components/payment-status-refresher";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewOrder, getOrderViewByNumber } from "@/lib/orders";
import { OrderDetail } from "@/components/order-detail";
import { GuestAccessCard } from "@/components/guest-access-card";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/orders",
    title: t("order.metaTitle"),
    robots: { index: false, follow: false },
  });
}

export default async function GuestOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { t, href } = await getI18n();
  const { orderNumber } = await params;
  const { token } = await searchParams;
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

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href={href("/")}>{t("nav.home")}</Link>
          </li>
          <li aria-current="page">{orderNumber}</li>
        </ol>
      </nav>
      {view.order.paymentStatus === "paid" &&
      ["not_started", "queued", "processing", "provisioning"].includes(view.order.fulfillmentStatus) ? (
        <PaymentStatusRefresher intervalMs={4000} maxAttempts={90} />
      ) : null}
      {!view.order.userId && token ? (
        <GuestAccessCard orderNumber={view.order.orderNumber} token={token} />
      ) : null}
      <OrderDetail view={view} accessToken={token} showActivation />
    </>
  );
}
