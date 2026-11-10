import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAdminPlans } from "@/lib/admin";
import { formatMoney } from "@/lib/money";
import { updatePlanAction } from "../actions";
import { StatusBadge } from "@/components/status-badge";
import { AlertIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Plans and pricing",
  robots: { index: false, follow: false },
};

export default async function AdminPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { updated, error } = await searchParams;
  await requireStaff("/admin/plans", "plans");
  const db = await getDb();
  const rows = await listAdminPlans(db, 200);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Demo catalogue</p>
          <h1>Plans &amp; pricing</h1>
          <p className="muted">
            Update demo markup and publication status. Prices are recalculated from the stored
            cost with the local pricing engine.
          </p>
        </div>
      </div>

      {updated ? (
        <div className="callout section-tight" role="status">
          <p>Plan updated: {updated}</p>
        </div>
      ) : null}
      {error ? (
        <div className="form-error section-tight" role="alert">
          <AlertIcon className="inline-icon" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="callout callout-warning section-tight">
        <AlertIcon className="inline-icon" />
        <p>
          Changing a demo price affects the local catalogue and new checkouts. Existing orders
          retain their captured line prices. No supplier price is being updated.
        </p>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Plan</th>
              <th scope="col">Cost</th>
              <th scope="col">Price</th>
              <th scope="col">Status</th>
              <th scope="col">Update</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ plan, destinationName, regionName }) => (
              <tr key={plan.id}>
                <td>
                  <strong>{plan.name}</strong>
                  <br />
                  <span className="small muted">
                    {destinationName} · {regionName} · {plan.dataMb} MB / {plan.validityDays} days
                  </span>
                  <br />
                  <span className={`badge ${plan.isDemo ? "badge-demo" : "badge-neutral"}`}>
                    {plan.isDemo ? "Demo" : "Non-demo"}
                  </span>
                </td>
                <td>{formatMoney(plan.costMinor, plan.currency)}</td>
                <td>
                  <strong>{formatMoney(plan.priceMinor, plan.currency)}</strong>
                  <br />
                  <span className="small muted">{plan.markupBps} bps</span>
                </td>
                <td>
                  <StatusBadge status={plan.status} />
                </td>
                <td>
                  <form action={updatePlanAction} className="admin-plan-form">
                    <input type="hidden" name="planId" value={plan.id} />
                    <label className="visually-hidden" htmlFor={`markup-${plan.id}`}>
                      Markup in basis points for {plan.name}
                    </label>
                    <input
                      id={`markup-${plan.id}`}
                      name="markupBps"
                      type="number"
                      min="0"
                      max="100000"
                      step="50"
                      defaultValue={plan.markupBps}
                    />
                    <label className="visually-hidden" htmlFor={`status-${plan.id}`}>
                      Publication status for {plan.name}
                    </label>
                    <select id={`status-${plan.id}`} name="status" defaultValue={plan.status}>
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                    <button className="button button-secondary button-small" type="submit">
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
