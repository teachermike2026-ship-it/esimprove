import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listOrdersFiltered, orderStatusCounts } from "@/lib/admin-ops";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Admin orders",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const PAYMENT_STATUSES = ["pending", "paid", "failed", "partially_refunded", "refunded", "disputed", "cancelled"];
const FULFILLMENT_STATUSES = ["not_started", "queued", "provisioning", "delivered", "failed", "manual_review", "cancelled"];

function parseDay(value: string | undefined, endOfDay = false): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const day = new Date(`${value}T00:00:00Z`);
  return endOfDay ? new Date(day.getTime() + 86_400_000) : day;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; payment?: string; fulfillment?: string; method?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireStaff("/admin/orders", "orders");
  const params = await searchParams;
  const db = await getDb();
  const filters = {
    q: params.q?.slice(0, 120),
    payment: PAYMENT_STATUSES.includes(params.payment ?? "") ? params.payment : "",
    fulfillment: FULFILLMENT_STATUSES.includes(params.fulfillment ?? "") ? params.fulfillment : "",
    method: (params.method === "card" || params.method === "crypto" ? params.method : "") as "" | "card" | "crypto",
    from: parseDay(params.from),
    to: parseDay(params.to, true),
    page: Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  };
  const [result, counts] = await Promise.all([listOrdersFiltered(db, filters), orderStatusCounts(db)]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const query = (page: number) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "page") qs.set(key, value);
    qs.set("page", String(page));
    return `/admin/orders?${qs.toString()}`;
  };
  const tiles = [
    { label: "Pending payment", value: counts.payment.pending ?? 0, href: "/admin/orders?payment=pending" },
    { label: "Paid", value: counts.payment.paid ?? 0, href: "/admin/orders?payment=paid" },
    { label: "Delivered", value: counts.fulfillment.delivered ?? 0, href: "/admin/orders?fulfillment=delivered" },
    { label: "Failed", value: (counts.payment.failed ?? 0) + (counts.fulfillment.failed ?? 0), href: "/admin/orders?fulfillment=failed" },
    { label: "Refunded", value: counts.payment.refunded ?? 0, href: "/admin/orders?payment=refunded" },
    { label: "Partially refunded", value: counts.payment.partially_refunded ?? 0, href: "/admin/orders?payment=partially_refunded" },
    { label: "Manual review", value: counts.fulfillment.manual_review ?? 0, href: "/admin/orders?fulfillment=manual_review" },
    { label: "Disputed", value: counts.payment.disputed ?? 0, href: "/admin/orders?payment=disputed" },
  ];

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Orders</h1>
          <p className="muted">Search, filter and open any order. Date filters use UTC.</p>
        </div>
      </div>

      <div className="stat-grid">
        {tiles.map((tile) => (
          <Link className="card stat kpi-card" href={tile.href} key={tile.label}>
            <span>{tile.label}</span>
            <strong>{tile.value}</strong>
          </Link>
        ))}
      </div>

      <form className="card form section-tight admin-filters" action="/admin/orders">
        <div className="field">
          <label htmlFor="orders-q">Search</label>
          <input id="orders-q" name="q" defaultValue={params.q} placeholder="Order number, email, name or ID" />
        </div>
        <div className="field">
          <label htmlFor="orders-payment">Payment</label>
          <select id="orders-payment" name="payment" defaultValue={filters.payment}>
            <option value="">Any</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="orders-fulfillment">Delivery</label>
          <select id="orders-fulfillment" name="fulfillment" defaultValue={filters.fulfillment}>
            <option value="">Any</option>
            {FULFILLMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="orders-method">Method</label>
          <select id="orders-method" name="method" defaultValue={filters.method}>
            <option value="">Any</option>
            <option value="card">Card (Whop)</option>
            <option value="crypto">USDT</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="orders-from">From</label>
          <input id="orders-from" type="date" name="from" defaultValue={params.from} />
        </div>
        <div className="field">
          <label htmlFor="orders-to">To</label>
          <input id="orders-to" type="date" name="to" defaultValue={params.to} />
        </div>
        <div className="pill-row">
          <button className="button button-small" type="submit">
            Apply
          </button>
          <Link className="button button-small button-ghost" href="/admin/orders">
            Reset
          </Link>
        </div>
      </form>

      <p className="muted small section-tight">
        {result.total} order{result.total === 1 ? "" : "s"} · page {result.page} of {pages}
      </p>

      {result.rows.length === 0 ? (
        <div className="card form">
          <p className="muted">No orders match these filters.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Total</th>
                <th scope="col">Method</th>
                <th scope="col">Payment</th>
                <th scope="col">Delivery</th>
                <th scope="col">Created / paid</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderNumber}</strong>
                  </td>
                  <td>
                    {order.customerName || (order.userId ? "—" : "Guest checkout")}
                    <br />
                    <span className="small muted">{order.email || "No email (guest)"}</span>
                  </td>
                  <td>{formatMoney(order.totalMinor, order.currency)}</td>
                  <td className="small">
                    {order.paymentMethods === "crypto" ? "USDT" : order.paymentMethods === "whop" ? "Card" : order.paymentMethods}
                  </td>
                  <td>
                    <StatusBadge status={order.paymentStatus} />
                  </td>
                  <td>
                    <StatusBadge status={order.fulfillmentStatus} />
                  </td>
                  <td className="small">
                    {formatDate(order.createdAt)}
                    {order.paidAt ? (
                      <>
                        <br />
                        <span className="muted">paid {formatDate(order.paidAt)}</span>
                      </>
                    ) : null}
                  </td>
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

      {pages > 1 ? (
        <nav className="pill-row section-tight" aria-label="Pages">
          {result.page > 1 ? (
            <Link className="button button-small button-secondary" href={query(result.page - 1)}>
              Previous
            </Link>
          ) : null}
          {result.page < pages ? (
            <Link className="button button-small button-secondary" href={query(result.page + 1)}>
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
