import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getReconciliation } from "@/lib/admin-ops";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Reconciliation",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ReconciliationPage() {
  await requireStaff("/admin/reconciliation", "reconciliation");
  const db = await getDb();
  const days = await getReconciliation(db, 30);
  const totals = days.reduce(
    (acc, d) => ({
      paid: acc.paid + d.paidOrdersMinor,
      whop: acc.whop + d.whopPaidMinor,
      usdt: acc.usdt + d.usdtPaidMinor,
      refunds: acc.refunds + d.confirmedRefundsMinor,
      unmatched: acc.unmatched + d.unmatchedOrders,
    }),
    { paid: 0, whop: 0, usdt: 0, refunds: 0, unmatched: 0 },
  );
  const usd = (minor: number) => formatMoney(minor, "USD");

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Money</p>
          <h1>Reconciliation</h1>
          <p className="muted">
            ESIMPROVE paid orders compared with verified Whop payments, confirmed USDT transfers and provider-confirmed
            refunds, per day (UTC, last 30 days). Only verified payments count; return pages never do.
          </p>
        </div>
      </div>
      <div className="stat-grid">
        <article className="card stat kpi-card">
          <span>Paid orders</span>
          <strong>{usd(totals.paid)}</strong>
        </article>
        <article className="card stat kpi-card">
          <span>Whop verified</span>
          <strong>{usd(totals.whop)}</strong>
        </article>
        <article className="card stat kpi-card">
          <span>USDT confirmed</span>
          <strong>{usd(totals.usdt)}</strong>
        </article>
        <article className="card stat kpi-card">
          <span>Unmatched orders</span>
          <strong>{totals.unmatched}</strong>
          <p className="muted small">{totals.unmatched === 0 ? "Everything matches." : "Investigate on Needs attention."}</p>
        </article>
      </div>
      <section className="card form section-tight">
        <h2>Daily comparison</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Paid orders</th>
                <th>Whop verified</th>
                <th>USDT confirmed</th>
                <th>Confirmed refunds</th>
                <th>In review</th>
                <th>Unmatched</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.day}>
                  <td className="small">{day.day}</td>
                  <td>
                    {day.paidOrders} · {usd(day.paidOrdersMinor)}
                  </td>
                  <td>
                    {day.whopPaid} · {usd(day.whopPaidMinor)}
                  </td>
                  <td>
                    {day.usdtPaid} · {usd(day.usdtPaidMinor)}
                  </td>
                  <td>
                    {day.confirmedRefunds} · {usd(day.confirmedRefundsMinor)}
                  </td>
                  <td>{day.casesInReview}</td>
                  <td>{day.unmatchedOrders === 0 ? "0" : <strong>{day.unmatchedOrders}</strong>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="form-note">
          “Unmatched” counts paid orders with no verified provider payment that day. Refund totals use provider-settled
          amounts, which can differ slightly from the order price through exchange rates.
        </p>
      </section>
    </>
  );
}
