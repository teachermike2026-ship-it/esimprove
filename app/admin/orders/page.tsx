import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAdminOrders } from "@/lib/admin";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Admin orders",
  robots: { index: false, follow: false },
};

export default async function AdminOrdersPage() {
  await requireStaff("/admin/orders", "orders");
  const db = await getDb();
  const orders = await listAdminOrders(db, 200);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Orders</h1>
          <p className="muted">All local orders, newest first.</p>
        </div>
      </div>
      {orders.length === 0 ? (
        <div className="card form">
          <p className="muted">No orders yet. Complete a mock checkout to create one.</p>
          <Link className="button button-ghost button-small" href="/plans">
            Browse plans <ArrowRight className="inline-icon" />
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Total</th>
                <th scope="col">Payment</th>
                <th scope="col">Fulfillment</th>
                <th scope="col">Created</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderNumber}</strong>
                    <br />
                    <span className="small muted">{order.country}</span>
                  </td>
                  <td>
                    {order.customerName || (order.userId ? "—" : "Guest checkout")}
                    <br />
                    <span className="small muted">{order.email || "No email (guest)"}</span>
                  </td>
                  <td>{formatMoney(order.totalMinor, order.currency)}</td>
                  <td>
                    <StatusBadge status={order.paymentStatus} />
                  </td>
                  <td>
                    <StatusBadge status={order.fulfillmentStatus} />
                  </td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>
                    <Link
                      className="button button-ghost button-small"
                      href={`/admin/orders/${order.orderNumber}`}
                    >
                      Inspect <ArrowRight className="inline-icon" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
