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
import {
  getCommerceKpis,
  getDemoOrderValue,
  getOrdersByPaymentStatus,
  getOrdersSeries,
  getRecentActivity,
  getRegistrationsSeries,
  resolveCommerceRange,
} from "@/lib/analytics-commerce";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { BarList, LineChart } from "@/components/analytics-charts";
import { runJobsAction } from "./actions";
import { ArrowRight, RetryIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Admin overview",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const staff = await requireStaff("/admin", "overview");
  const is = (section: Parameters<typeof canAccessAdminSection>[1]) =>
    canAccessAdminSection(staff.role, section);
  const canSeeOrders = is("orders");
  const canSeeCustomers = is("customers");
  const canSeePlans = is("plans");
  const canSeeRefunds = is("refunds");
  const canSeeSupport = is("support");
  const canSeeJobs = is("jobs");
  const canSeeEmails = is("emails");
  const canRunJobs = is("jobs");

  const db = await getDb();
  const range30 = resolveCommerceRange("30d");
  const [stats, kpis, orders, jobs, emails, orderSeries, registrationSeries, demoValue, ordersByPayment, activity] =
    await Promise.all([
      getAdminStats(db),
      getCommerceKpis(db),
      listAdminOrders(db, 8),
      listAdminJobs(db, 8),
      is("emails") ? listAdminEmails(db, 5) : Promise.resolve([]),
      canSeeOrders ? getOrdersSeries(db, range30) : Promise.resolve([]),
      canSeeCustomers ? getRegistrationsSeries(db, range30) : Promise.resolve([]),
      canSeeOrders ? getDemoOrderValue(db, range30) : Promise.resolve(null),
      canSeeOrders ? getOrdersByPaymentStatus(db, range30) : Promise.resolve([]),
      getRecentActivity(db, 12, {
        order: canSeeOrders,
        registration: canSeeCustomers,
        refund: canSeeRefunds,
        ticket: canSeeSupport,
        catalogue: canSeePlans,
        job: canSeeJobs,
      }),
    ]);

  const kpiCards = [
    canSeeOrders && { label: "Orders (all time)", value: kpis.ordersTotal, href: "/admin/orders", link: "View orders", hint: "Every local order, newest activity included.", empty: "No orders yet. Mock checkouts will appear here." },
    canSeeOrders && { label: "Orders today", value: kpis.ordersToday, href: "/admin/orders", link: "View orders", hint: "Orders placed today (UTC).", empty: "No orders today so far." },
    canSeeOrders && { label: "Orders this month", value: kpis.ordersThisMonth, href: "/admin/orders", link: "View orders", hint: "Calendar month in UTC.", empty: "No orders this month yet." },
    canSeeCustomers && { label: "Customers", value: kpis.customersTotal, href: "/admin/customers", link: "View customers", hint: "Registered accounts with the customer role.", empty: "No customers yet." },
    canSeeCustomers && { label: "New customers this month", value: kpis.customersNewThisMonth, href: "/admin/customers", link: "View customers", hint: "Registered since the 1st of this month (UTC).", empty: "No new customers this month yet." },
    canSeePlans && { label: "Published plans", value: kpis.publishedPlans, href: "/admin/plans", link: "View plans", hint: "Live plans in the public catalogue.", empty: "No published plans. Check the catalogue." },
    canSeePlans && { label: "Destinations", value: kpis.destinationsTotal, href: "/admin/plans/destinations", link: "View destinations", hint: "Mapped destinations served by the catalogue.", empty: "No destinations configured." },
    canSeeRefunds && { label: "Pending refunds", value: kpis.pendingRefunds, href: "/admin/refunds", link: "Review refunds", hint: "Refund requests awaiting a decision.", empty: "No refunds awaiting review." },
    canSeeSupport && { label: "Open support tickets", value: kpis.openSupportTickets, href: "/admin/support", link: "View tickets", hint: "Open or awaiting staff.", empty: "No open support tickets." },
    canSeeJobs && { label: "Failed fulfillment jobs", value: kpis.failedJobs, href: "/admin/jobs", link: "View jobs", hint: "Jobs the mock supplier worker could not complete.", empty: "No failed jobs." },
  ].filter(Boolean) as Array<{ label: string; value: number; href: string; link: string; hint: string; empty: string }>;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Overview</h1>
          <p className="muted">
            Local orders, mock payments, mock fulfillment, and redacted email logs. All counts
            are local data. Everything marked DEMO is illustrative.
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
        {kpiCards.map((card) => (
          <article className="card stat kpi-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value.toLocaleString()}</strong>
            <p className="muted small">{card.value === 0 ? card.empty : card.hint}</p>
            <Link className="kpi-link small" href={card.href}>
              {card.link} <ArrowRight className="inline-icon" />
            </Link>
          </article>
        ))}
      </div>

      {(canSeeOrders || canSeeCustomers) && (
        <section className="card section-tight">
          <div className="admin-toolbar">
            <h2>Last 30 days (UTC)</h2>
            {canSeeOrders ? (
              <Link className="button button-ghost button-small" href="/admin/analytics?tab=commerce&range=30d">
                Commerce analytics <ArrowRight className="inline-icon" />
              </Link>
            ) : null}
          </div>
          <div className="inline-grid two">
            {canSeeOrders ? (
              <div>
                <h3 className="small muted">Orders per day</h3>
                <LineChart
                  ariaLabel="Orders per day, last 30 days"
                  data={orderSeries.map((point) => ({ label: point.bucket, value: point.value }))}
                />
              </div>
            ) : null}
            {canSeeCustomers ? (
              <div>
                <h3 className="small muted">New customers per day</h3>
                <LineChart
                  ariaLabel="New customer registrations per day, last 30 days"
                  data={registrationSeries.map((point) => ({ label: point.bucket, value: point.value }))}
                />
              </div>
            ) : null}
            {canSeeOrders && demoValue ? (
              <div>
                <h3 className="small muted">
                  DEMO order value per day{demoValue.primaryCurrency ? ` (${demoValue.primaryCurrency}, mock payments)` : ""}
                </h3>
                <LineChart
                  ariaLabel="Demo order value per day, last 30 days"
                  data={demoValue.series.map((point) => ({ label: point.bucket, value: Math.round(point.value / 100) }))}
                />
                <p className="muted small">
                  DEMO: sum of paid mock orders only. Not real revenue, not a financial report.
                  {demoValue.primaryCurrency ? ` Shown in major ${demoValue.primaryCurrency} units.` : ""}
                </p>
              </div>
            ) : null}
            {canSeeOrders ? (
              <div>
                <h3 className="small muted">Orders by payment status</h3>
                <BarList
                  ariaLabel="Orders by payment status, last 30 days"
                  rows={ordersByPayment.map((row) => ({ label: row.status, value: row.count }))}
                  emptyLabel="No orders in the last 30 days."
                />
              </div>
            ) : null}
          </div>
        </section>
      )}

      <section className="card section-tight">
        <h2>Recent activity</h2>
        {activity.length === 0 ? (
          <p className="muted small">No activity yet. Orders, registrations, refunds, tickets, catalogue changes, and failures will appear here.</p>
        ) : (
          <ol className="timeline">
            {activity.map((item) => (
              <li key={item.id}>
                <span className="timeline-dot" aria-hidden="true" />
                <div>
                  <strong>{item.title}</strong>{" "}
                  <span className="muted small">{item.detail}</span>
                  <div className="small muted">
                    {formatDate(item.at)}
                    {item.href ? <> · <Link className="link" href={item.href}>Open <ArrowRight className="inline-icon" /></Link></> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid grid-2 section-tight">
        <section className="card form">
          <div className="admin-toolbar">
            <h2>Recent orders</h2>
            <Link className="button button-ghost button-small" href="/admin/orders">
              All orders <ArrowRight className="inline-icon" />
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="muted small">No orders yet. Complete a mock checkout first.</p>
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
        {canSeeEmails ? (
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
          <h2>Catalogue</h2>
          <p className="muted small">
            {stats.publishedPlans} published plans, of which {stats.demoPlans} are labelled illustrative.
            {stats.customers} customer account{stats.customers === 1 ? "" : "s"} exist locally.
          </p>
          {canSeePlans ? (
            <Link className="button button-secondary" href="/admin/plans">
              Manage plans and pricing
            </Link>
          ) : null}
        </section>
      </div>
    </>
  );
}
