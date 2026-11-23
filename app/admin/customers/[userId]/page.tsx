import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getCustomerDetail } from "@/lib/analytics-commerce";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Customer detail",
  robots: { index: false, follow: false },
};

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireStaff("/admin/customers", "customers");
  const { userId } = await params;
  const db = await getDb();
  const detail = await getCustomerDetail(db, userId);
  if (!detail) notFound();

  const { user, orders, stats } = detail;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>{user.name}</h1>
          <p className="muted">{user.email}</p>
        </div>
        <Link className="button button-ghost button-small" href="/admin/customers">
          ← All customers
        </Link>
      </div>

      <section className="card section-tight">
        <div className="stat-grid">
          <article className="card stat">
            <span>Role</span>
            <strong className="stat-word">{user.role}</strong>
          </article>
          <article className="card stat">
            <span>Status</span>
            <strong className="stat-word">{user.emailVerifiedAt ? "Verified" : "Unverified"}</strong>
            <p className="muted small">{user.emailVerifiedAt ? `Verified ${formatDate(user.emailVerifiedAt)}` : "Email not verified yet"}</p>
          </article>
          <article className="card stat">
            <span>Joined</span>
            <strong className="stat-word">{formatDate(user.createdAt)}</strong>
          </article>
          <article className="card stat">
            <span>Orders</span>
            <strong>{stats.orders}</strong>
            <p className="muted small">
              DEMO value (paid mock orders): {formatMoney(stats.paidValueMinor, stats.currency)}
            </p>
          </article>
        </div>
      </section>

      <section className="card section-tight">
        <h2>Order history</h2>
        {orders.length === 0 ? (
          <p className="muted small">This customer has not placed any orders yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Total</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Fulfillment</th>
                  <th scope="col">Date</th>
                  <th scope="col"><span className="visually-hidden">Inspect</span></th>
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
                    <td>{formatMoney(order.totalMinor, order.currency)}</td>
                    <td><StatusBadge status={order.paymentStatus} /></td>
                    <td><StatusBadge status={order.fulfillmentStatus} /></td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <Link className="button button-ghost button-small" href={`/admin/orders/${order.orderNumber}`}>
                        Inspect <ArrowRight className="inline-icon" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">DEMO order values are sums of paid mock payments and are not revenue.</p>
      </section>
    </>
  );
}
