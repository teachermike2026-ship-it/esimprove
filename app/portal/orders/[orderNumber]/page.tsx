import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getOrderByNumber, getOrderView } from "@/lib/orders";
import { isAdminRole } from "@/lib/auth/roles";
import { OrderDetail } from "@/components/order-detail";

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
      <OrderDetail view={view} />
    </>
  );
}
