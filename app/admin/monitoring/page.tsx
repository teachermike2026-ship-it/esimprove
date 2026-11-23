import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getOperationalHealth, listRecentAttentionEvents } from "@/lib/monitoring";
import { formatDate } from "@/lib/money";
import { AlertIcon, CheckIcon, ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Operational status",
  robots: { index: false, follow: false },
};

export default async function AdminMonitoringPage() {
  await requireStaff("/admin/monitoring", "monitoring");
  const db = await getDb();
  const [health, recentFailures] = await Promise.all([
    getOperationalHealth(db),
    listRecentAttentionEvents(db, 15),
  ]);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Operational status</h1>
          <p className="muted">
            Live signals read from this database. Alerting, paging, and external dashboards are not
            configured in this build; nothing is emailed or alerted on.
          </p>
        </div>
        <span className={health.attentionCount > 0 ? "badge badge-warning" : "badge"}>
          {health.attentionCount > 0
            ? `${health.attentionCount} check${health.attentionCount === 1 ? "" : "s"} need attention`
            : "All checks healthy"}
        </span>
      </div>

      <div className="callout callout-warning section-tight">
        <ShieldIcon className="inline-icon" />
        <p>
          Continuous monitoring and on-call paging are <strong>Not configured</strong>. There is no
          external observability provider, uptime probe, or alert recipient in this build. This page
          is a read-only snapshot of local database state only.
        </p>
      </div>

      <section className="stack" aria-labelledby="health-checks-title">
        <h2 id="health-checks-title">Health checks (computed just now)</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Signal</th>
                <th scope="col">Value</th>
                <th scope="col">Status</th>
                <th scope="col">If attention is needed</th>
              </tr>
            </thead>
            <tbody>
              {health.checks.map((check) => (
                <tr key={check.id}>
                  <td>
                    <strong>{check.label}</strong>
                    <br />
                    <span className="small muted">{check.detail}</span>
                  </td>
                  <td>{check.value}</td>
                  <td>
                    {check.state === "ok" ? (
                      <span className="badge">
                        <CheckIcon className="inline-icon" /> OK
                      </span>
                    ) : (
                      <span className="badge badge-warning">
                        <AlertIcon className="inline-icon" /> Attention
                      </span>
                    )}
                  </td>
                  <td className="small muted">{check.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Checked at {formatDate(health.checkedAt)}.</p>
      </section>

      <section className="card form section-tight" aria-labelledby="future-monitoring-title">
        <h2 id="future-monitoring-title">Future integration (Coming later)</h2>
        <p className="muted small">
          The following are planned for a later operations phase and are intentionally
          not connected: uptime and synthetic probing, log aggregation, traces and metrics,
          on-call scheduling, and webhook/email/SMS alert delivery. No alerting provider will be
          selected until an operator confirms the vendor, thresholds, and recipient roster.
        </p>
      </section>

      <section className="card form section-tight" aria-labelledby="recent-failures-title">
        <h2 id="recent-failures-title">Recent failure audit events</h2>
        {recentFailures.length === 0 ? (
          <p className="muted">No failure-related audit events recorded.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentFailures.map((event) => (
                  <tr key={event.id}>
                    <td>{event.action}</td>
                    <td>
                      <span className="badge badge-neutral">{event.entityType}</span>
                    </td>
                    <td>
                      {event.actorType}
                      {event.actorId ? ` · ${event.actorId}` : ""}
                    </td>
                    <td>{formatDate(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
