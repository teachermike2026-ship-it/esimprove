import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { checkSupplierHealth } from "@/lib/provider-health";
import { listProviderBalanceSnapshots, listProviderSyncJobs } from "@/lib/operations";
import { formatDate } from "@/lib/money";

export const metadata: Metadata = {
  title: "Admin provider",
  robots: { index: false, follow: false },
};

export default async function AdminProviderPage() {
  await requireStaff("/admin/provider", "provider");
  const db = await getDb();
  const health = await checkSupplierHealth(db, "mock");
  const syncJobs = await listProviderSyncJobs(db, 20);
  const balances = await listProviderBalanceSnapshots(db, "mock", 20);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Demo operations</p>
          <h1>Supplier</h1>
          <p className="muted">Provider health, synchronization, and balance snapshot status.</p>
        </div>
      </div>
      <div className="stat-grid">
        <article className="card stat">
          <span>Health</span>
          <strong>{health.ok ? "OK" : "DOWN"}</strong>
          <p className="muted small">{health.message}</p>
        </article>
        <article className="card stat">
          <span>Last sync</span>
          <strong>{syncJobs[0] ? formatDate(syncJobs[0].startedAt) : "—"}</strong>
          <p className="muted small">{syncJobs[0]?.status ?? "none"}</p>
        </article>
        <article className="card stat">
          <span>Balance snapshots</span>
          <strong>{balances.length}</strong>
          <p className="muted small">Mock provider · wallet endpoint unsupported</p>
        </article>
      </div>
      <section className="card form section-tight">
        <h2>Recent synchronization jobs</h2>
        {syncJobs.length === 0 ? (
          <p className="muted">No synchronization jobs recorded.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {syncJobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.providerKey}</td>
                    <td>{job.status}</td>
                    <td>{formatDate(job.startedAt)}</td>
                    <td className="small">{JSON.stringify(job.details)}</td>
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
