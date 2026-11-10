import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { canAccessAdminSection } from "@/lib/auth/admin-access";
import { getDb } from "@/lib/db/client";
import {
  getAdminStats,
  listAdminEmails,
  listAdminJobs,
  listAdminOrders,
} from "@/lib/admin";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { runJobsAction } from "./actions";
import { ArrowRight, RetryIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Admin overview",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const staff = await requireStaff("/admin", "overview");
  const canRunJobs = canAccessAdminSection(staff.role, "jobs");
  const canViewEmails = canAccessAdminSection(staff.role, "emails");
  const canViewPlans = canAccessAdminSection(staff.role, "plans");
  const db = await getDb();
  const [stats, orders, jobs, emails] = await Promise.all([
    getAdminStats(db),
    listAdminOrders(db, 8),
    listAdminJobs(db, 8),
    listAdminEmails(db, 5),
  ]);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Demo operations</p>
          <h1>Overview</h1>
          <p className="muted">
            Local orders, mock payments, mock fulfillment, and redacted email logs. All counts
            are demo data.
          </p>
        </div>
        {canRunJobs ? (
          <form action={runJobsAction}>
            <button className="button" type="submit">
              <RetryIcon className="inline-icon" /> Run due jobs
            </button>
          </form>
        ) : null}
      </div>

      <div className="stat-grid">
        <article className="card stat">
          <span>Orders</span>
          <strong>{stats.totalOrders}</strong>
          <p className="muted small">{stats.paidOrders} paid · {stats.deliveredOrders} delivered</p>
        </article>
        <article className="card stat">
          <span>Needs attention</span>
          <strong>{stats.failedOrders}</strong>
          <p className="muted small">{stats.failedJobs} failed jobs</p>
        </article>
        <article className="card stat">
          <span>Queued jobs</span>
          <strong>{stats.queuedJobs}</strong>
          <p className="muted small">Mock supplier worker</p>
        </article>
        <article className="card stat">
          <span>Email log</span>
          <strong>{stats.loggedEmails}</strong>
          <p className="muted small">Logged locally, never sent</p>
        </article>
      </div>

      <div className="grid grid-2 section-tight">
        <section className="card form">
          <div className="admin-toolbar">
            <h2>Recent orders</h2>
            <Link className="button button-ghost button-small" href="/admin/orders">
              All orders <ArrowRight className="inline-icon" />
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="muted small">No demo orders yet. Complete a mock checkout first.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Total</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link href={`/admin/orders/${order.orderNumber}`}>
                          {order.orderNumber}
                        </Link>
                        <br />
                        <span className="small muted">{formatDate(order.createdAt)}</span>
                      </td>
                      <td>{formatMoney(order.totalMinor, order.currency)}</td>
                      <td>
                        <StatusBadge status={order.fulfillmentStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card form">
          <div className="admin-toolbar">
            <h2>Fulfillment jobs</h2>
            {canRunJobs ? (
              <Link className="button button-ghost button-small" href="/admin/jobs">
                All jobs <ArrowRight className="inline-icon" />
              </Link>
            ) : null}
          </div>
          {jobs.length === 0 ? (
            <p className="muted small">No jobs have been queued.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Status</th>
                    <th scope="col">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(({ job, orderNumber }) => (
                    <tr key={job.id}>
                      <td>
                        <Link href={`/admin/orders/${orderNumber}`}>{orderNumber}</Link>
                      </td>
                      <td>
                        <StatusBadge status={job.status} />
                      </td>
                      <td>
                        {job.attempts}/{job.maxAttempts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-2 section-tight">
        {canViewEmails ? (
          <section className="card form">
            <h2>Latest email events</h2>
            {emails.length === 0 ? (
              <p className="muted small">No mock delivery emails have been logged.</p>
            ) : (
              <ul className="check-list">
                {emails.map(({ email, orderNumber }) => (
                  <li key={email.id}>
                    <StatusBadge status={email.status} />
                    <span>
                      {email.recipient} · {email.subject}
                      {orderNumber ? ` · ${orderNumber}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link className="button button-ghost button-small" href="/admin/emails">
              Open email log <ArrowRight className="inline-icon" />
            </Link>
          </section>
        ) : null}
        <section className="card form">
          <h2>Demo catalogue</h2>
          <p className="muted small">
            {stats.publishedPlans} published plans, of which {stats.demoPlans} are labelled demo.
            {stats.customers} customer account{stats.customers === 1 ? "" : "s"} exist locally.
          </p>
          {canViewPlans ? (
            <Link className="button button-secondary" href="/admin/plans">
              Manage plans and pricing
            </Link>
          ) : null}
        </section>
      </div>
    </>
  );
}
