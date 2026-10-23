import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listOrdersForUser } from "@/lib/orders";
import { formatMoney, formatDate } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ArrowRight, QrIcon, UserIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Customer portal",
  robots: { index: false, follow: false },
};

export default async function PortalPage() {
  const user = await requireUser("/portal");
  const db = await getDb();
  const orders = await listOrdersForUser(db, user.id);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Customer portal</p>
          <h1>Welcome, {user.name}</h1>
          <p className="muted">
            Signed in as {user.email}. Demo orders and activation records linked to this
            account appear here.
          </p>
        </div>
        <span className="badge badge-demo">Demo account</span>
      </div>

      <div className="split">
        <section className="stack" aria-labelledby="portal-orders">
          <div className="section-heading">
            <div>
              <p className="eyebrow">History</p>
              <h2 id="portal-orders">Your demo orders</h2>
            </div>
          </div>
          {orders.length === 0 ? (
            <EmptyState title="No demo orders yet" action={{ href: "/plans", label: "Browse demo plans" }}>
              Complete a mock checkout to see an order, fulfillment job, and activation record
              here.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Created</th>
                    <th scope="col">Total</th>
                    <th scope="col">Status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.orderNumber}</strong>
                      </td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>{formatMoney(order.totalMinor, order.currency)}</td>
                      <td>
                        <StatusBadge status={order.fulfillmentStatus} />
                      </td>
                      <td>
                        <Link className="button button-ghost button-small" href={`/portal/orders/${order.orderNumber}`}>
                          Open <ArrowRight className="inline-icon" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="checkout-sidebar">
          <section className="card form">
            <h2>
              <UserIcon className="inline-icon" /> Account
            </h2>
            <dl className="meta-list">
              <div>
                <dt>Name</dt>
                <dd>{user.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{user.role}</dd>
              </div>
            </dl>
            <p className="form-note">
              Account email verification is not implemented in this demo. Do not use real
              personal data.
            </p>
          </section>
          <section className="card form">
            <h2>
              <QrIcon className="inline-icon" /> Need a plan?
            </h2>
            <p className="muted small">
              Browse the demo catalogue, then complete a mock checkout to test fulfillment and
              activation.
            </p>
            <Link className="button button-secondary" href="/plans">
              Browse plans
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
