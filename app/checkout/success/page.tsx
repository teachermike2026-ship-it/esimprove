import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewOrder, getOrderViewByNumber } from "@/lib/orders";
import { OrderDetail } from "@/components/order-detail";
import { ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
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
          <p className="eyebrow">Order</p>
          <h1>
            {paid
              ? "Your order is confirmed"
              : failed
                ? "Payment not completed"
                : "Your order is pending payment"}
          </h1>
          <p className="lead">
            {paid
              ? "Thank you. Your eSIM will be issued shortly, and activation details will appear in your order and in your account once it is ready."
              : failed
                ? "Your order was recorded, but the payment did not complete. This store has not marked the order as paid. Contact support if you need help."
                : "We have not received a confirmed payment yet. Your order will be processed only after the payment provider confirms the payment. If you just completed payment, wait a moment and refresh this page."}
          </p>
        </div>
      </div>
      <OrderDetail view={view} accessToken={token} />
      <div className="hero-actions section-tight">
        <Link
          className="button"
          href={`/orders/${view.order.orderNumber}${token ? `?token=${encodeURIComponent(token)}` : ""}`}
        >
          Open order details <ArrowRight className="inline-icon" />
        </Link>
        <Link className="button button-secondary" href="/portal">
          Customer portal
        </Link>
      </div>
    </>
  );
}
