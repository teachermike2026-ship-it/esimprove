import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAdminJobs } from "@/lib/admin";
import { formatDate } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { runJobsAction, retryJobAction } from "../actions";
import { AlertIcon, RetryIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Fulfillment jobs",
  robots: { index: false, follow: false },
};

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ ran?: string; failed?: string; retried?: string }>;
}) {
  const { ran, failed, retried } = await searchParams;
  await requireStaff("/admin/jobs", "jobs");
  const db = await getDb();
  const jobs = await listAdminJobs(db, 200);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Fulfillment jobs</h1>
          <p className="muted">
            The worker is mock-only. It never contacts a supplier. Failed jobs can be retried
            after inspection.
          </p>
        </div>
        <form action={runJobsAction}>
          <button className="button" type="submit">
            <RetryIcon className="inline-icon" /> Run due jobs
          </button>
        </form>
      </div>

      {ran !== undefined ? (
        <div className="callout section-tight" role="status">
          <p>
            Worker run complete: {ran} processed, {failed ?? "0"} failed or scheduled.
          </p>
        </div>
      ) : null}
      {retried ? (
        <div className="callout section-tight" role="status">
          <p>Job queued for retry.</p>
        </div>
      ) : null}

      {jobs.length === 0 ? (
        <div className="card form">
          <p className="muted">No fulfillment jobs yet. A successful mock payment queues them.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Plan</th>
                <th scope="col">Status</th>
                <th scope="col">Attempts</th>
                <th scope="col">Next attempt</th>
                <th scope="col">Last error</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(({ job, orderNumber, planName }) => (
                <tr key={job.id}>
                  <td>
                    <Link href={`/admin/orders/${orderNumber}`}>{orderNumber}</Link>
                  </td>
                  <td>{planName}</td>
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td>
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td>{formatDate(job.nextAttemptAt)}</td>
                  <td className="small">
                    {job.lastError ? (
                      <span className="text-danger">{job.lastError}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <form action={retryJobAction}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <button
                        className="button button-secondary button-small"
                        type="submit"
                        disabled={!["failed", "queued", "under_investigation"].includes(job.status)}
                      >
                        <RetryIcon className="inline-icon" /> Retry
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="callout callout-warning section-tight">
        <AlertIcon className="inline-icon" />
        <p>
          A retry does not contact a real supplier. It re-runs the deterministic mock adapter
          and may reuse an existing mock activation.
        </p>
      </div>
    </>
  );
}
