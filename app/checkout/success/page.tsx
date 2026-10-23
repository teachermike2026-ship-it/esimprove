import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewOrder, getOrderViewByNumber } from "@/lib/orders";
import { OrderDetail } from "@/components/order-detail";
import { EmptyState } from "@/components/empty-state";
import { AlertIcon, ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Demo order confirmation",
  robots: { index: false, follow: false },
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const { order: orderNumber, token } = await searchParams;
  if (!orderNumber) {
    return (
      <EmptyState title="No order reference" action={{ href: "/plans", label: "Browse demo plans" }}>
        This confirmation page needs an order number and an access token.
      </EmptyState>
    );
  }

  const db = await getDb();
  const view = await getOrderViewByNumber(db, orderNumber);
  if (!view) {
    return (
      <EmptyState title="Order not found" action={{ href: "/plans", label: "Browse demo plans" }}>
        The demo order could not be found. Check the link from the mock payment page.
      </EmptyState>
    );
  }

  const user = await getCurrentUser();
  const allowed = await canViewOrder(db, view.order, {
    userId: user?.id ?? null,
    role: user?.role ?? null,
    token: token ?? null,
  });
  if (!allowed) {
    return (
      <EmptyState title="Order access required" action={{ href: "/portal", label: "Open customer portal" }}>
        Use the access link from the demo email or sign in as the customer who placed the
        order.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Demo checkout complete</p>
          <h1>Your demo order is recorded</h1>
          <p className="lead">
            The mock payment webhook was verified, the local fulfillment job ran, and the
            activation data was stored with envelope encryption.
          </p>
        </div>
      </div>
      <div className="callout callout-warning section-tight">
        <AlertIcon className="inline-icon" />
        <p>
          This is not a real purchase. No money moved, no supplier order was placed, and the
          activation code cannot connect to a real network.
        </p>
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
