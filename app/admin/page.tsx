import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { canAccessAdminSection } from "@/lib/auth/admin-access";
import { getDb } from "@/lib/db/client";
import { getNeedsAttention, getOverviewDashboard } from "@/lib/admin-ops";
import { getSupplierStatus } from "@/lib/supplier-ops";
import { emailDiagnostics } from "@/lib/email-ops";
import { formatDate, formatMoney } from "@/lib/money";
import { AdminIcon, type AdminIconName } from "@/components/admin/admin-icons";
import { FunnelGraphic, RevenueOrdersChart, StatusDonut } from "@/components/admin/admin-charts";
import { CountryFlag } from "@/components/country-flag";
import { runJobsAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin overview",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
] as const;

const STATUS_COLORS = {
  delivered: "#16a34a",
  processing: "#2563eb",
  pending: "#f59e0b",
  failed: "#dc2626",
  refunded: "#7c6cf0",
};

function Trend({ value, unit = "%", suffix = "vs. previous period" }: { value: number | null; unit?: string; suffix?: string }) {
  if (value === null) return <span className="ov-trend is-none">No earlier data to compare</span>;
  const up = value >= 0;
  return (
    <span className={`ov-trend ${up ? "is-up" : "is-down"}`}>
      <span aria-hidden="true">{up ? "↑" : "↓"}</span> {up ? "+" : ""}
      {value}
      {unit} {suffix ? <span className="muted">{suffix}</span> : null}
    </span>
  );
}

function Kpi({
  icon,
  tone,
  label,
  value,
  children,
}: {
  icon: AdminIconName;
  tone: string;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <article className="ov-kpi">
      <span className={`ov-kpi-icon is-${tone}`}>
        <AdminIcon name={icon} size={22} />
      </span>
      <div>
        <span className="ov-kpi-label">{label}</span>
        <strong className="ov-kpi-value">{value}</strong>
        {children}
      </div>
    </article>
  );
}

function waiting(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  return `${Math.floor(minutes / 1440)}d`;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; series?: string }>;
}) {
  const staff = await requireStaff("/admin", "overview");
  const params = await searchParams;
  const is = (section: Parameters<typeof canAccessAdminSection>[1]) => canAccessAdminSection(staff.role, section);
  const canRevenue = is("revenue");
  const canOrders = is("orders");
  const canAnalytics = is("analytics");
  const canAttention = is("attention");
  const canSupplier = is("provider");
  const canEmail = is("emails");
  const canRunJobs = is("jobs");
  const db = await getDb();
  const [dash, attention, supplier, email] = await Promise.all([
    getOverviewDashboard(db, params.range),
    canAttention ? getNeedsAttention(db) : Promise.resolve([]),
    canSupplier ? getSupplierStatus(db) : Promise.resolve(null),
    canEmail ? emailDiagnostics(db) : Promise.resolve(null),
  ]);
  const usd = (minor: number) => formatMoney(minor, "USD");
  const series = params.series === "orders" ? "orders" : params.series === "revenue" ? "revenue" : "both";
  const rangeQuery = `range=${dash.range.key}`;
  const statusRows = [
    { key: "delivered", label: "Delivered", value: dash.status.delivered },
    { key: "processing", label: "Paid (processing)", value: dash.status.processing },
    { key: "pending", label: "Pending", value: dash.status.pending },
    { key: "failed", label: "Failed", value: dash.status.failed },
    { key: "refunded", label: "Refunded", value: dash.status.refunded },
  ] as const;
  const funnelStages = [
    ...dash.funnel.stages.map((s) => ({ label: s.label, value: s.count })),
    { label: "Payment confirmed", value: dash.current.orders },
  ];
  const funnelHasData = dash.funnel.stages.some((s) => s.count > 0);
  const destinationTotal = dash.current.byDestination.reduce((sum, d) => sum + d.orders, 0);
  const lowBalance = supplier && supplier.lastBalanceMinor !== null && supplier.lastBalanceMinor < supplier.thresholdMinor;

  return (
    <div className="ov">
      <div className="ov-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">Your eSIM business at a glance. Orders, revenue, supplier, and performance.</p>
        </div>
        <div className="ov-head-actions">
          <form action="/admin" className="ov-range">
            <AdminIcon name="calendar" size={18} />
            <label className="sr-only" htmlFor="ov-range">
              Period
            </label>
            <select id="ov-range" name="range" defaultValue={dash.range.key}>
              {RANGES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
            <button type="submit" className="ov-range-apply">
              Apply
            </button>
          </form>
          <Link className="ov-icon-button" href={`/admin?${rangeQuery}`} aria-label="Refresh">
            <AdminIcon name="refresh" size={18} />
          </Link>
          {canRunJobs ? (
            <form action={runJobsAction}>
              <button className="ov-icon-button" type="submit" aria-label="Run due fulfillment jobs" title="Run due fulfillment jobs">
                <AdminIcon name="server" size={18} />
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <section className="ov-kpis" aria-label="Key figures">
        {canOrders ? (
          <Kpi icon="cart" tone="blue" label="Total Orders" value={String(dash.current.orders)}>
            <Trend value={dash.changes.orders} />
          </Kpi>
        ) : null}
        {canRevenue ? (
          <Kpi icon="dollar" tone="green" label="Revenue" value={usd(dash.current.grossMinor)}>
            <Trend value={dash.changes.revenue} suffix="" />
          </Kpi>
        ) : null}
        {canRevenue ? (
          <Kpi icon="trending" tone="green" label="Profit (Est.)" value={usd(dash.current.estimatedProfitMinor)}>
            <Trend value={dash.changes.profit} suffix="" />
          </Kpi>
        ) : null}
        {canAnalytics ? (
          <Kpi icon="funnel" tone="violet" label="Conversion Rate" value={dash.conversion === null ? "No data" : `${dash.conversion}%`}>
            {dash.conversion === null ? (
              <span className="ov-trend is-none">No consenting visitor sessions yet</span>
            ) : (
              <Trend value={dash.conversionChange} unit=" pp" suffix="" />
            )}
          </Kpi>
        ) : null}
        {canRevenue ? (
          <Kpi icon="tag" tone="amber" label="Avg. Order Value" value={usd(dash.current.averageOrderMinor)}>
            <Trend value={dash.changes.aov} suffix="" />
          </Kpi>
        ) : null}
      </section>

      <div className="ov-row ov-row-main">
        {canRevenue ? (
          <section className="ov-card">
            <div className="ov-card-head">
              <h2>Revenue &amp; Orders</h2>
              <nav className="ov-seg" aria-label="Series">
                <Link className={series !== "orders" ? "is-active" : ""} href={`/admin?${rangeQuery}&series=revenue`}>
                  Revenue
                </Link>
                <Link className={series !== "revenue" ? "is-active" : ""} href={`/admin?${rangeQuery}&series=orders`}>
                  Orders
                </Link>
              </nav>
            </div>
            <RevenueOrdersChart
              series={series}
              points={dash.current.byDay.map((d) => ({ day: d.day, revenue: d.grossMinor / 100, orders: d.orders }))}
            />
            {dash.current.orders === 0 ? <p className="ov-empty">No paid orders in this period yet.</p> : null}
          </section>
        ) : null}

        {canAnalytics ? (
          <section className="ov-card">
            <div className="ov-card-head">
              <h2>
                Sales Funnel{" "}
                <span
                  className="ov-info"
                  title="Browsing stages count consenting visitor sessions; payment confirmed counts verified paid orders."
                >
                  <AdminIcon name="help" size={16} />
                </span>
              </h2>
            </div>
            <div className="ov-funnel">
              <FunnelGraphic stages={funnelStages} />
              <table className="ov-funnel-table">
                <tbody>
                  {funnelStages.map((stage, i) => (
                    <tr key={stage.label}>
                      <td>{stage.label}</td>
                      <td className="num">
                        <strong>{funnelHasData || i === funnelStages.length - 1 ? stage.value : "—"}</strong>
                      </td>
                      <td className="num muted">
                        {i === 0 || !funnelHasData || funnelStages[0]!.value === 0
                          ? ""
                          : `${Math.round((stage.value / funnelStages[0]!.value) * 1000) / 10}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!funnelHasData ? <p className="ov-empty">Data unavailable: no consenting visitor sessions in this period yet.</p> : null}
          </section>
        ) : null}
      </div>

      <div className="ov-row ov-row-three">
        {canOrders ? (
          <section className="ov-card">
            <h2>Order Status</h2>
            <div className="ov-status">
              <StatusDonut
                total={dash.createdOrders}
                label="Orders"
                segments={statusRows.map((r) => ({ label: r.label, value: r.value, color: STATUS_COLORS[r.key] }))}
              />
              <table className="ov-legend-table">
                <tbody>
                  {statusRows.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <i className="ov-swatch" style={{ background: STATUS_COLORS[r.key] }} /> {r.label}
                      </td>
                      <td className="num">
                        <strong>{r.value}</strong>
                      </td>
                      <td className="num muted">
                        {dash.createdOrders ? `${Math.round((r.value / dash.createdOrders) * 1000) / 10}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {canRevenue ? (
          <section className="ov-card">
            <h2>Top Countries by Orders</h2>
            {dash.current.byDestination.length === 0 ? (
              <p className="ov-empty">No paid orders in this period yet.</p>
            ) : (
              <ul className="ov-countries">
                {dash.current.byDestination.slice(0, 5).map((d) => {
                  const share = destinationTotal ? (d.orders / destinationTotal) * 100 : 0;
                  return (
                    <li key={d.name}>
                      {d.code ? <CountryFlag code={d.code} label={d.name} /> : <span className="ov-flag-blank" />}
                      <span className="ov-country-name">{d.name}</span>
                      <span className="ov-bar">
                        <span style={{ width: `${Math.max(4, share)}%` }} />
                      </span>
                      <strong>{d.orders}</strong>
                      <span className="muted">({Math.round(share * 10) / 10}%)</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        {canRevenue ? (
          <section className="ov-card">
            <h2>Top Plans</h2>
            {dash.current.topPlans.length === 0 ? (
              <p className="ov-empty">No paid orders in this period yet.</p>
            ) : (
              <ul className="ov-plans">
                {dash.current.topPlans.slice(0, 5).map((p) => (
                  <li key={p.name}>
                    {p.code ? <CountryFlag code={p.code} label={p.name} /> : <span className="ov-flag-blank" />}
                    <span className="ov-plan-name">{p.name}</span>
                    <span className="muted">
                      {p.quantity} order{p.quantity === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      <div className="ov-row ov-row-ops">
        {canAttention ? (
          <section className={`ov-card ov-attention${attention.length > 0 ? " has-items" : ""}`}>
            <div className="ov-card-head">
              <h2>
                <AdminIcon name="alert" size={20} /> Needs Attention ({attention.length})
              </h2>
              <Link href="/admin/attention" className="ov-link">
                View all →
              </Link>
            </div>
            {attention.length === 0 ? (
              <p className="ov-empty">
                <AdminIcon name="check" size={16} /> Nothing needs attention right now.
              </p>
            ) : (
              <ul className="ov-attention-list">
                {attention.slice(0, 4).map((item, i) => (
                  <li key={`${item.kind}-${item.reference ?? item.orderId ?? i}`}>
                    <strong>{item.orderNumber ?? item.reference ?? "—"}</strong>
                    <span className={`ov-pill is-${item.severity}`}>{item.kind.replaceAll("_", " ")}</span>
                    <span className="ov-attention-summary">{item.summary}</span>
                    <span className="ov-wait">{waiting(item.ageMinutes)}</span>
                    {item.orderNumber ? (
                      <Link className="ov-action" href={`/admin/orders/${item.orderNumber}`}>
                        {item.kind === "fulfillment_failed" || item.kind === "job_stuck"
                          ? "Retry"
                          : item.kind.startsWith("crypto")
                            ? "Check"
                            : "Review"}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {supplier ? (
          <section className="ov-card">
            <div className="ov-card-head">
              <h2>
                <AdminIcon name="server" size={20} /> Supplier <span className="muted small">(eSIM Access)</span>
              </h2>
              <span
                className={`ov-status-pill is-${supplier.apiStatus === "ok" ? "ok" : supplier.apiStatus === "never-checked" ? "unknown" : "error"}`}
              >
                {supplier.apiStatus === "ok" ? "Online" : supplier.apiStatus === "never-checked" ? "Not checked" : "Check failed"}
              </span>
            </div>
            <p className="ov-mini-label">Balance</p>
            <p className="ov-big">{supplier.lastBalanceMinor === null ? "Unavailable" : usd(supplier.lastBalanceMinor)}</p>
            {lowBalance ? (
              <p className="ov-warn">
                <AdminIcon name="bell" size={16} /> Low balance alert: below {usd(supplier.thresholdMinor)}
              </p>
            ) : null}
            <p className="muted small">
              {supplier.lastBalanceAt ? `Balance read ${formatDate(supplier.lastBalanceAt)}` : "Balance not read yet"}
              {supplier.lastSync[0] ? ` · last sync ${formatDate(supplier.lastSync[0].startedAt)}` : ""}
            </p>
            <Link className="ov-link" href="/admin/provider">
              Open supplier →
            </Link>
          </section>
        ) : null}

        {email ? (
          <section className="ov-card">
            <div className="ov-card-head">
              <h2>
                <AdminIcon name="send" size={20} /> Email <span className="muted small">(Resend)</span>
              </h2>
              <span
                className={`ov-status-pill is-${email.resend.status === "ok" ? "ok" : email.resend.status === "not-configured" ? "unknown" : "error"}`}
              >
                {email.resend.status === "ok" ? "Connected" : email.resend.status === "not-configured" ? "Not configured" : "Error"}
              </span>
            </div>
            <dl className="ov-dl">
              <div>
                <dt>Status</dt>
                <dd>{email.emailLiveEnabled && email.liveProblems.length === 0 ? "Sending live" : "Logging only (live email off)"}</dd>
              </div>
              <div>
                <dt>Domain</dt>
                <dd>
                  {email.resend.senderDomain ?? "—"}{" "}
                  {email.resend.senderDomainVerified ? (
                    <span className="ov-ok">✓ Verified</span>
                  ) : email.resend.senderDomainVerified === false ? (
                    <span className="ov-bad">Not verified</span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Last send</dt>
                <dd>{email.lastSuccessfulSend?.sentAt ? formatDate(email.lastSuccessfulSend.sentAt) : "None recorded"}</dd>
              </div>
            </dl>
            <Link className="ov-test-button" href="/admin/emails#email-testing-title">
              <AdminIcon name="send" size={16} /> Test Email
            </Link>
          </section>
        ) : null}
      </div>
    </div>
  );
}
