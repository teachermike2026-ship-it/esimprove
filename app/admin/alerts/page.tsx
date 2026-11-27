import type { Metadata } from "next";
import Link from "next/link";
import { desc, like } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";
import { listAdminAlerts } from "@/lib/admin-ops";
import { resolveAlertAction } from "@/app/admin/ops-actions";
import { formatDate } from "@/lib/money";
import { AlertIcon, CheckIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Alerts",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff("/admin/alerts", "alerts");
  const { show } = await searchParams;
  const db = await getDb();
  const [orderAlerts, systemAlerts] = await Promise.all([
    listAdminAlerts(db, 200),
    db.select().from(auditLogs).where(like(auditLogs.action, "alert.%")).orderBy(desc(auditLogs.createdAt)).limit(50),
  ]);
  const visible = show === "all" ? orderAlerts : orderAlerts.filter((a) => !a.resolvedAt);
  const openCount = orderAlerts.filter((a) => !a.resolvedAt).length;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">System</p>
          <h1>Alerts</h1>
          <p className="muted">
            Order alerts (payments held for review, refunds, disputes, failed fulfillment) and system alerts (supplier
            balance and API). Resolving an alert keeps it on record.
          </p>
        </div>
      </div>

      <nav className="pill-row admin-toolbar" aria-label="Filter">
        <Link className={`button button-small ${show === "all" ? "button-secondary" : ""}`} href="/admin/alerts">
          Unresolved ({openCount})
        </Link>
        <Link className={`button button-small ${show === "all" ? "" : "button-secondary"}`} href="/admin/alerts?show=all">
          All ({orderAlerts.length})
        </Link>
      </nav>

      <section className="card form section-tight">
        <h2>Order alerts</h2>
        {visible.length === 0 ? (
          <p className="muted">
            <CheckIcon className="inline-icon" /> No {show === "all" ? "" : "unresolved "}order alerts.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Severity</th>
                  <th>Kind</th>
                  <th>Order</th>
                  <th>Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((alert) => (
                  <tr key={alert.id}>
                    <td className="small">{formatDate(alert.createdAt)}</td>
                    <td>
                      <span className={`badge ${alert.severity === "high" ? "badge-warning" : "badge-neutral"}`}>{alert.severity}</span>
                    </td>
                    <td className="small">{alert.kind}</td>
                    <td>
                      {alert.orderNumber ? <Link href={`/admin/orders/${alert.orderNumber}`}>{alert.orderNumber}</Link> : "—"}
                    </td>
                    <td className="small">{alert.message}</td>
                    <td>
                      {alert.resolvedAt ? (
                        <span className="small muted">Resolved {formatDate(alert.resolvedAt)}</span>
                      ) : (
                        <form action={resolveAlertAction}>
                          <input type="hidden" name="alertId" value={alert.id} />
                          <button className="button button-small button-secondary" type="submit">
                            Mark resolved
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card form section-tight">
        <h2>System alerts</h2>
        {systemAlerts.length === 0 ? (
          <p className="muted">No system alerts recorded.</p>
        ) : (
          <ul className="timeline">
            {systemAlerts.map((alert) => (
              <li key={alert.id}>
                <AlertIcon className="inline-icon" />
                <div>
                  <strong>{alert.action.replace(/^alert\./, "").replaceAll(".", " · ").replaceAll("_", " ")}</strong>
                  <p className="small muted">
                    {formatDate(alert.createdAt)} · {String((alert.metadata as Record<string, unknown> | null)?.summary ?? "")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="form-note">The same supplier alert is recorded at most once every 6 hours.</p>
      </section>
    </>
  );
}
