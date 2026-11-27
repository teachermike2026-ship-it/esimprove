import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getRevenueReport, resolveRevenueRange } from "@/lib/admin-ops";
import { pricingPolicy } from "@/lib/pricing-config";
import { formatMoney } from "@/lib/money";
import { BarList, LineChart } from "@/components/analytics-charts";

export const metadata: Metadata = {
  title: "Revenue & profit",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "prev_month", label: "Previous month" },
] as const;

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireStaff("/admin/revenue", "revenue");
  const params = await searchParams;
  const range = resolveRevenueRange(params.range, params.from, params.to);
  const db = await getDb();
  const report = await getRevenueReport(db, range.from, range.to);
  const policy = pricingPolicy();
  const usd = (minor: number) => formatMoney(minor, "USD");
  const lastDay = new Date(range.to.getTime() - 86_400_000).toISOString().slice(0, 10);

  const cards = [
    { label: "Gross sales", value: usd(report.grossMinor), hint: `${report.orders} paid orders` },
    { label: "Confirmed refunds", value: usd(report.confirmedRefundsMinor), hint: "Provider-confirmed and approved refunds" },
    { label: "Net sales", value: usd(report.netSalesMinor), hint: "Gross minus confirmed refunds" },
    { label: "Supplier cost", value: usd(report.supplierCostMinor), hint: "Delivered eSIMs only" },
    {
      label: "Payment fees (estimate)",
      value: usd(report.estimatedPaymentFeesMinor),
      hint: `Card: ${(policy.feeBps / 100).toFixed(1)}% + ${usd(policy.feeFixedMinor)}; USDT: none`,
    },
    { label: "Profit (estimate)", value: usd(report.estimatedProfitMinor), hint: "Net sales − supplier cost − estimated fees" },
    { label: "Average order value", value: usd(report.averageOrderMinor), hint: "Gross sales ÷ paid orders" },
    { label: "Orders", value: String(report.orders), hint: "Paid in this period (UTC)" },
  ];

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Money</p>
          <h1>Revenue &amp; profit</h1>
          <p className="muted">
            Paid orders only ({range.from.toISOString().slice(0, 10)} to {lastDay}, UTC). Unpaid and failed orders are
            excluded. Fees and profit are estimates; Whop&apos;s actual fees appear in its dashboard.
          </p>
        </div>
      </div>

      <nav className="pill-row admin-toolbar" aria-label="Period">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            className={`button button-small ${range.key === r.key ? "" : "button-secondary"}`}
            href={`/admin/revenue?range=${r.key}`}
            aria-current={range.key === r.key ? "page" : undefined}
          >
            {r.label}
          </Link>
        ))}
        <form className="pill-row" action="/admin/revenue">
          <input type="hidden" name="range" value="custom" />
          <label className="small">
            From <input type="date" name="from" defaultValue={params.from} required />
          </label>
          <label className="small">
            To <input type="date" name="to" defaultValue={params.to} required />
          </label>
          <button className={`button button-small ${range.key === "custom" ? "" : "button-secondary"}`} type="submit">
            Apply
          </button>
        </form>
      </nav>

      <div className="stat-grid section-tight">
        {cards.map((card) => (
          <article className="card stat kpi-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p className="muted small">{card.hint}</p>
          </article>
        ))}
      </div>

      {report.otherCurrencyOrders > 0 ? (
        <p className="callout callout-warning section-tight">
          {report.otherCurrencyOrders} paid order(s) in other currencies are not included in these USD totals.
        </p>
      ) : null}

      <div className="inline-grid two section-tight">
        <section className="card section-tight">
          <h2>Revenue per day</h2>
          <LineChart ariaLabel="Gross sales per day" data={report.byDay.map((d) => ({ label: d.day, value: d.grossMinor / 100 }))} />
        </section>
        <section className="card section-tight">
          <h2>Orders per day</h2>
          <LineChart ariaLabel="Paid orders per day" data={report.byDay.map((d) => ({ label: d.day, value: d.orders }))} />
        </section>
        <section className="card section-tight">
          <h2>Estimated profit per day</h2>
          <LineChart
            ariaLabel="Estimated profit per day"
            color="#0f766e"
            data={report.byDay.map((d) => ({ label: d.day, value: Math.max(0, d.estimatedProfitMinor) / 100 }))}
          />
          <p className="form-note">Days with a loss are shown at zero; see the totals above.</p>
        </section>
        <section className="card section-tight">
          <h2>Sales by payment method</h2>
          <BarList
            ariaLabel="Gross sales by payment method"
            rows={report.byMethod.map((m) => ({ label: m.method, value: m.grossMinor / 100, hint: `USD · ${m.orders} orders` }))}
          />
        </section>
        <section className="card section-tight">
          <h2>Top destinations</h2>
          <BarList
            ariaLabel="Gross sales by destination"
            rows={report.byDestination.map((d) => ({ label: d.name, value: d.grossMinor / 100, hint: `USD · ${d.orders} orders` }))}
          />
        </section>
        <section className="card section-tight">
          <h2>Top-selling plans</h2>
          <BarList
            ariaLabel="Top plans by quantity"
            rows={report.topPlans.map((p) => ({ label: p.name, value: p.quantity, hint: `sold · ${usd(p.grossMinor)}` }))}
          />
        </section>
      </div>
    </>
  );
}
