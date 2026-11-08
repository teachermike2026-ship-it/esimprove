import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAdminAuditLogs } from "@/lib/admin";
import { formatDate } from "@/lib/money";

export const metadata: Metadata = {
  title: "Admin audit logs",
  robots: { index: false, follow: false },
};

export default async function AdminAuditPage() {
  await requireAdmin();
  const db = await getDb();
  const logs = await listAdminAuditLogs(db, 200);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Demo operations</p>
          <h1>Audit log</h1>
          <p className="muted">Administrative and operational audit events.</p>
        </div>
      </div>
      {logs.length === 0 ? (
        <div className="card form">
          <p className="muted">No audit events recorded yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">At</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    {log.actorType}
                    {log.actorId ? ` · ${log.actorId}` : ""}
                  </td>
                  <td>{log.action}</td>
                  <td>
                    {log.entityType} · {log.entityId}
                  </td>
                  <td>{formatDate(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
