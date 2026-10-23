import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewOrder, getOrderViewByNumber } from "@/lib/orders";
import { OrderDetail } from "@/components/order-detail";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Demo order",
  robots: { index: false, follow: false },
};

export default async function GuestOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { orderNumber } = await params;
  const { token } = await searchParams;
  const db = await getDb();
  const view = await getOrderViewByNumber(db, orderNumber);
  if (!view) {
    return (
      <EmptyState title="Order not found" action={{ href: "/plans", label: "Browse demo plans" }}>
        Check the order number or use the access link from the demo email.
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
      <EmptyState title="Order access required" action={{ href: "/login", label: "Sign in" }}>
        Use the secure link from the demo email or sign in as the customer who placed the
        order.
      </EmptyState>
    );
  }

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li aria-current="page">{orderNumber}</li>
        </ol>
      </nav>
      <OrderDetail view={view} accessToken={token} />
    </>
  );
}
