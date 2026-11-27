import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { attentionCountsBySeverity, getNeedsAttention, PAID_UNDELIVERED_ALERT_MINUTES, STUCK_JOB_MINUTES } from "@/lib/admin-ops";
import { formatDate } from "@/lib/money";
import { AlertIcon, ArrowRight, CheckIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Needs attention",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function waiting(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `${Math.floor(minutes / 1440)} days`;
}

const SEVERITY_BADGE = { critical: "badge-danger", high: "badge-warning", medium: "badge-neutral" } as const;

export default async function NeedsAttentionPage() {
  await requireStaff("/admin/attention", "attention");
  const db = await getDb();
  const items = await getNeedsAttention(db);
  const counts = attentionCountsBySeverity(items);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Needs attention</h1>
          <p className="muted">
            Orders and payments that need a person, most urgent first. Computed from live records on each visit.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <article className="card stat kpi-card">
          <span>Critical</span>
          <strong>{counts.critical}</strong>
          <p className="muted small">Paid customers without an eSIM, or records that disagree.</p>
        </article>
        <article className="card stat kpi-card">
          <span>High</span>
          <strong>{counts.high}</strong>
          <p className="muted small">Slow deliveries, stuck jobs, reviews and disputes.</p>
        </article>
        <article className="card stat kpi-card">
          <span>Medium</span>
          <strong>{counts.medium}</strong>
          <p className="muted small">USDT transfers confirming for over an hour.</p>
        </article>
        <article className="card stat kpi-card">
          <span>Total open</span>
          <strong>{items.length}</strong>
          <p className="muted small">
            Paid orders count after {PAID_UNDELIVERED_ALERT_MINUTES} min; jobs after {STUCK_JOB_MINUTES} min.
          </p>
        </article>
      </div>

      {items.length === 0 ? (
        <section className="card form section-tight">
          <p>
            <CheckIcon className="inline-icon" /> Nothing needs attention right now.
          </p>
        </section>
      ) : (
        <div className="table-wrap section-tight">
          <table className="data-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Order</th>
                <th>What is wrong</th>
                <th>Waiting</th>
                <th>Since</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.kind}-${item.reference ?? item.orderId ?? index}`}>
                  <td>
                    <span className={`badge ${SEVERITY_BADGE[item.severity]}`}>
                      {item.severity === "critical" ? <AlertIcon className="inline-icon" /> : null} {item.severity}
                    </span>
                  </td>
                  <td>
                    {item.orderNumber ? <strong>{item.orderNumber}</strong> : <span className="muted">—</span>}
                    {item.reference ? (
                      <>
                        <br />
                        <span className="small muted">{item.reference}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{item.summary}</td>
                  <td>{waiting(item.ageMinutes)}</td>
                  <td className="small">{formatDate(item.since)}</td>
                  <td>
                    {item.orderNumber ? (
                      <Link className="button button-small button-secondary" href={`/admin/orders/${item.orderNumber}`}>
                        Open <ArrowRight className="inline-icon" />
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="form-note">
        Refunds are never issued from here. Retry fulfillment, resend emails and add notes on the order page; refunds
        are executed in the Whop dashboard and reconciled automatically from verified webhooks.
      </p>
    </>
  );
}
