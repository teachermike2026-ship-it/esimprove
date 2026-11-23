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
            Signed in as {user.email}. Orders and activation records linked to this
            account appear here.
          </p>
        </div>
      </div>

      <div className="split">
        <section className="stack" aria-labelledby="portal-orders">
          <div className="section-heading">
            <div>
              <p className="eyebrow">History</p>
              <h2 id="portal-orders">Your orders</h2>
            </div>
          </div>
          {orders.length === 0 ? (
            <EmptyState title="No orders yet" action={{ href: "/plans", label: "Browse plans" }}>
              Your orders and activation records will appear here once you place an order.
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
              <div>
                <dt>Verification</dt>
                <dd>{user.emailVerifiedAt ? "Verified" : "Not verified"}</dd>
              </div>
            </dl>
            <div className="stack-sm">
              <Link className="button button-secondary button-small" href="/portal/profile">
                Profile and security
              </Link>
              <Link className="button button-ghost button-small" href="/portal/support">
                Support conversations
              </Link>
              <Link className="button button-ghost button-small" href="/legal/privacy">
                Privacy and data
              </Link>
            </div>
            <p className="form-note">
              Important account and order status is always shown here in your portal.
            </p>
          </section>
          <section className="card form">
            <h2>
              <QrIcon className="inline-icon" /> Need a plan?
            </h2>
            <p className="muted small">
              Browse plans by destination and validity.
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
