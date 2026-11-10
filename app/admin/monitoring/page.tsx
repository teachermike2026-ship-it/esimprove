import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAdminAuditLogs } from "@/lib/admin";
import { formatDate } from "@/lib/money";

export const metadata = {
  title: "Admin monitoring and alerts",
  robots: { index: false, follow: false },
};

export default async function AdminMonitoringPage() {
  await requireStaff("/admin/monitoring", "monitoring");
  const db = await getDb();
  const logs = await listAdminAuditLogs(db, 200);

  const criticalEvents = logs.filter((log) =>
    [
      "order.payment_failed",
      "order.fulfillment_failed",
      "refund.requested",
      "refund.approved",
      "supplier.sync_failed",
      "pricing.rule_changed",
    ].includes(log.action),
  );

  const alertCounts = {
    high: criticalEvents.filter((e) => e.action.includes("failed")).length,
    medium: criticalEvents.filter((e) => e.action.includes("requested") || e.action.includes("changed")).length,
    low: criticalEvents.filter((e) => !e.action.includes("failed") && !e.action.includes("changed") && !e.action.includes("requested")).length,
  };

  const alertRules = [
    {
      name: "Supplier API downtime",
      condition: "provider.healthCheck.status = 'failed'",
      threshold: "> 1 hour",
      recipients: "ops-team@esimprove.com",
    },
    {
      name: "Failed catalog synchronization",
      condition: "provider.syncJob.status = 'failed'",
      threshold: "> 3 attempts",
      recipients: "catalog-team@esimprove.com",
    },
    {
      name: "Low supplier balance",
      condition: "provider.balance < threshold",
      threshold: "< $1000",
      recipients: "finance-team@esimprove.com",
    },
    {
      name: "Increased fulfillment failure rate",
      condition: "order.fulfillmentStatus = 'failed'",
      threshold: "> 5% of daily orders",
      recipients: "ops-team@esimprove.com",
    },
    {
      name: "Payment webhook failures",
      condition: "webhookEvent.provider = 'stripe' && webhookEvent.status = 'failed'",
      threshold: "> 10 failures in 1 hour",
      recipients: "payments-team@esimprove.com",
    },
    {
      name: "Queue backlog",
      condition: "fulfillmentJob.status = 'queued'",
      threshold: "> 100 jobs",
      recipients: "ops-team@esimprove.com",
    },
    {
      name: "Repeated job failures",
      condition: "fulfillmentJob.attempts >= 5",
      threshold: "> 10 jobs",
      recipients: "ops-team@esimprove.com",
    },
    {
      name: "Email delivery problems",
      condition: "emailEvent.status = 'failed'",
      threshold: "> 5% of emails",
      recipients: "communication-team@esimprove.com",
    },
    {
      name: "Suspicious transaction spikes",
      condition: "order.totalMinor > 10000",
      threshold: "> 20 orders per hour",
      recipients: "security-team@esimprove.com",
    },
  ];

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Monitoring & alerts</h1>
          <p className="muted">Real-time operational alerts and incident history.</p>
        </div>
      </div>

      <div className="stat-grid">
        <article className="card stat">
          <span>Critical alerts</span>
          <strong>{alertCounts.high}</strong>
          <p className="muted small">Action required</p>
        </article>
        <article className="card stat">
          <span>Medium alerts</span>
          <strong>{alertCounts.medium}</strong>
          <p className="muted small">Monitoring</p>
        </article>
        <article className="card stat">
          <span>Low alerts</span>
          <strong>{alertCounts.low}</strong>
          <p className="muted small">Informational</p>
        </article>
        <article className="card stat">
          <span>Active rules</span>
          <strong>{alertRules.length}</strong>
          <p className="muted small">Configured thresholds</p>
        </article>
      </div>

      <section className="card form section-tight">
        <h2>Alert rules configuration</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Rule name</th>
                <th scope="col">Condition</th>
                <th scope="col">Threshold</th>
                <th scope="col">Recipients</th>
              </tr>
            </thead>
            <tbody>
              {alertRules.map((rule, index) => (
                <tr key={index}>
                  <td>{rule.name}</td>
                  <td className="small">{rule.condition}</td>
                  <td>{rule.threshold}</td>
                  <td>{rule.recipients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card form section-tight">
        <h2>Recent incidents</h2>
        {criticalEvents.length === 0 ? (
          <p className="muted">No critical incidents recorded.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Action</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {criticalEvents.map((event) => (
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
