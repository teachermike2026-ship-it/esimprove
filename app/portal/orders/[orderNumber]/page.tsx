import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getOrderByNumber, getOrderView } from "@/lib/orders";
import { getRefundableBalance, listRefundsForOrder } from "@/lib/refunds";
import { isAdminRole } from "@/lib/auth/roles";
import { OrderDetail } from "@/components/order-detail";
import { RefundRequestForm } from "@/components/refund-request-form";

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false, follow: false },
};

export default async function PortalOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const user = await requireUser(`/portal/orders/${orderNumber}`);
  const db = await getDb();
  const order = await getOrderByNumber(db, orderNumber);
  if (!order || (order.userId !== user.id && !isAdminRole(user.role))) notFound();
  const view = await getOrderView(db, order.id);
  if (!view) notFound();
  const [refunds, balance] = await Promise.all([
    listRefundsForOrder(db, order.id),
    getRefundableBalance(db, order.id),
  ]);
  const canRequestRefund =
    order.userId === user.id &&
    ["paid", "partially_refunded", "disputed"].includes(order.paymentStatus) &&
    (balance?.remainingMinor ?? 0) > 0;

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href="/portal">Portal</Link>
          </li>
          <li aria-current="page">{orderNumber}</li>
        </ol>
      </nav>
      <OrderDetail view={view} refunds={refunds} />
      {canRequestRefund && balance ? (
        <div className="section-tight">
          <RefundRequestForm
            orderNumber={order.orderNumber}
            currency={order.currency}
            remainingMinor={balance.remainingMinor}
          />
        </div>
      ) : null}
      <div className="hero-actions section-tight">
        <Link className="button button-secondary" href={`/portal/support?order=${order.orderNumber}`}>
          Contact support about this order
        </Link>
      </div>
    </>
  );
}
