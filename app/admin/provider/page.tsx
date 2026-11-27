import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getPlanMargins, getSupplierStatus } from "@/lib/supplier-ops";
import { checkSupplierAction, setLowBalanceThresholdAction } from "@/app/admin/ops-actions";
import { formatDate, formatMoney } from "@/lib/money";
import { AlertIcon, CheckIcon, RetryIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Supplier — eSIM Access",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminProviderPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireStaff("/admin/provider", "provider");
  const { notice } = await searchParams;
  const db = await getDb();
  const [status, margins] = await Promise.all([getSupplierStatus(db), getPlanMargins(db, 15)]);
  const usd = (minor: number) => formatMoney(minor, "USD");
  const low = status.lastBalanceMinor !== null && status.lastBalanceMinor < status.thresholdMinor;
  const insufficient =
    status.lastBalanceMinor !== null && status.reservedMinor !== null && status.lastBalanceMinor < status.reservedMinor;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Supplier</p>
          <h1>eSIM Access</h1>
          <p className="muted">
            Balance, API health, catalogue and margins. Balance checks are read-only. If a check fails, the last known
            balance and its time are shown, never an invented value.
          </p>
        </div>
      </div>

      {notice ? (
        <div className="callout section-tight" role="status">
          <p>{notice}</p>
        </div>
      ) : null}
      {low || insufficient ? (
        <div className="callout callout-warning section-tight" role="alert">
          <AlertIcon className="inline-icon" />
          <p>
            {low ? `Balance is below your ${usd(status.thresholdMinor)} threshold. ` : ""}
            {insufficient ? `Balance does not cover ${usd(status.reservedMinor!)} of orders waiting for eSIMs. ` : ""}
            Top up in the eSIM Access console.
          </p>
        </div>
      ) : null}

      <div className="stat-grid">
        <article className="card stat kpi-card">
          <span>Last known balance</span>
          <strong>{status.lastBalanceMinor === null ? "Unavailable" : usd(status.lastBalanceMinor)}</strong>
          <p className="muted small">
            {status.lastBalanceAt ? `Read ${formatDate(status.lastBalanceAt)}` : "Never read. Use “Check balance now”."}
          </p>
        </article>
        <article className="card stat kpi-card">
          <span>API status</span>
          <strong>{status.apiStatus}</strong>
          <p className="muted small">
            {status.lastCheckAt ? `Last check ${formatDate(status.lastCheckAt)}` : "No checks recorded yet."}
            {status.lastSuccessAt ? ` · last success ${formatDate(status.lastSuccessAt)}` : ""}
          </p>
        </article>
        <article className="card stat kpi-card">
          <span>Committed to pending orders</span>
          <strong>{status.reservedMinor === null ? "Unavailable" : usd(status.reservedMinor)}</strong>
          <p className="muted small">Supplier cost of paid or in-progress orders not issued yet.</p>
        </article>
        <article className="card stat kpi-card">
          <span>Live ordering</span>
          <strong>{status.liveOrdering ? "On" : "Off"}</strong>
          <p className="muted small">
            Credentials {status.credentialsConfigured ? "configured" : "missing"} on this server.
          </p>
        </article>
      </div>

      <div className="inline-grid two section-tight">
        <section className="card form">
          <h2>Check balance now</h2>
          <p className="muted small">One read-only call to eSIM Access. Records the result and raises alerts if needed.</p>
          <form action={checkSupplierAction}>
            <button className="button button-small" type="submit">
              <RetryIcon className="inline-icon" /> Check balance now
            </button>
          </form>
        </section>
        <section className="card form">
          <h2>Low-balance alert threshold</h2>
          <form action={setLowBalanceThresholdAction} className="pill-row">
            <label className="small" htmlFor="threshold">
              Alert below (USD)
            </label>
            <input
              id="threshold"
              name="thresholdUsd"
              inputMode="decimal"
              defaultValue={(status.thresholdMinor / 100).toFixed(2)}
              required
            />
            <button className="button button-small button-secondary" type="submit">
              Save
            </button>
          </form>
          <p className="form-note">Changes are recorded in the audit log. The same alert is not repeated within 6 hours.</p>
        </section>
      </div>

      <div className="inline-grid two section-tight">
        <section className="card form">
          <h2>Recent API checks</h2>
          {status.recentChecks.length === 0 ? (
            <p className="muted">No checks recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Status</th>
                    <th>Latency</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {status.recentChecks.map((check) => (
                    <tr key={check.id}>
                      <td className="small">{formatDate(check.checkedAt)}</td>
                      <td>
                        {check.status === "ok" ? <CheckIcon className="inline-icon" /> : <AlertIcon className="inline-icon" />}{" "}
                        {check.status}
                      </td>
                      <td className="small">{check.latencyMs ?? "—"} ms</td>
                      <td className="small">{check.message ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card form">
          <h2>Supplier alerts</h2>
          {status.recentAlerts.length === 0 ? (
            <p className="muted">No supplier alerts.</p>
          ) : (
            <ul className="timeline">
              {status.recentAlerts.map((alert) => (
                <li key={alert.id}>
                  <AlertIcon className="inline-icon" />
                  <div>
                    <strong>{alert.action.replace("alert.supplier.", "").replaceAll("_", " ")}</strong>
                    <p className="small muted">{formatDate(alert.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card form section-tight">
        <h2>Catalogue</h2>
        <p className="muted small">
          eSIM Access plans: {status.planCounts.published ?? 0} published
          {Object.entries(status.planCounts)
            .filter(([key]) => key !== "published")
            .map(([key, n]) => ` · ${n} ${key}`)
            .join("")}
          . Price changes in the last 30 days: {status.priceChanges.length}
          {status.priceChanges.length === 20 ? "+" : ""}.
        </p>
        {status.lastSync.length === 0 ? (
          <p className="muted">No synchronization jobs recorded.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {status.lastSync.map((job) => (
                  <tr key={job.id}>
                    <td className="small">{formatDate(job.startedAt)}</td>
                    <td>{job.status}</td>
                    <td className="small">{JSON.stringify(job.details).slice(0, 240)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card form section-tight">
        <h2>Lowest gross margins</h2>
        <p className="muted small">
          {margins.count} published plans. Gross margin = selling price − supplier cost. It is not net profit: card fees
          ({margins.negative} plan{margins.negative === 1 ? "" : "s"} below cost) are accounted for on Revenue &amp; profit.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Supplier cost</th>
                <th>Price</th>
                <th>Gross margin</th>
                <th>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {margins.lowest.map((plan) => (
                <tr key={plan.slug}>
                  <td>{plan.name}</td>
                  <td>{formatMoney(plan.costMinor, plan.currency)}</td>
                  <td>{formatMoney(plan.priceMinor, plan.currency)}</td>
                  <td>{formatMoney(plan.grossMarginMinor, plan.currency)}</td>
                  <td>{plan.marginPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
