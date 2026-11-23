import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import {
  listCatalogueDestinations,
  listCatalogueRegions,
  listPlansWithOrderUsage,
} from "@/lib/catalogue";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import {
  deletePlanAction,
  upsertPlanAction,
} from "@/app/admin/catalogue-actions";
import { AlertIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Plans and pricing",
  robots: { index: false, follow: false },
};

function costInputValue(minor: number, currency: string): string {
  const decimals = currency === "JPY" ? 0 : 2;
  return (minor / 10 ** decimals).toFixed(decimals);
}

export default async function AdminPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const staff = await requireStaff("/admin/plans", "plans");
  const canManage = hasPermission(staff.role, "plans.manage");
  const { saved, error } = await searchParams;
  const db = await getDb();
  const [planUsage, destinations, regions] = await Promise.all([
    listPlansWithOrderUsage(db),
    listCatalogueDestinations(db),
    listCatalogueRegions(db),
  ]);
  const destinationRows = destinations.map((destination) => ({
    id: destination.id,
    name: destination.name,
    regionName: destination.regionName,
  }));
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const regionNameById = new Map(
    destinations.map((destination) => [
      destination.id,
      regionById.get(destination.regionId)?.name ?? "Unknown region",
    ]),
  );
  const destinationNameById = new Map(destinationRows.map((row) => [row.id, row.name]));

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Plans &amp; pricing</h1>
          <p className="muted">
            Create and edit the published catalogue. Prices are recalculated from the stored cost
            with the local pricing engine. Supplier product IDs reference mock supplier records
            until live sourcing is configured.
          </p>
        </div>
        <div className="pill-row">
          <Link className="button button-ghost button-small" href="/admin/plans/regions">
            Regions
          </Link>
          <Link className="button button-ghost button-small" href="/admin/plans/destinations">
            Destinations
          </Link>
        </div>
      </div>

      {saved ? (
        <div className="callout callout-success section-tight" role="status">
          <p>{saved === "deleted" ? "Plan deleted." : "Plan saved."}</p>
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
          Changing a plan affects the local catalogue and new checkouts. Existing orders retain
          their captured line prices. Selling a plan locks it: it can only be archived, never
          deleted. No supplier price or live catalogue is updated.
        </p>
      </div>

      {!canManage ? (
        <div className="callout callout-warning section-tight">
          <p>
            Your role can view the catalogue but cannot change plans. Ask an administrator with
            catalogue permissions.
          </p>
        </div>
      ) : null}

      {canManage ? (
        <details className="card form section-tight">
          <summary className="admin-details-summary">Add a plan</summary>
          <form action={upsertPlanAction} className="form section-tight">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="plan-destination">Destination</label>
                <select id="plan-destination" name="destinationId" required defaultValue={destinationRows[0]?.id ?? ""}>
                  <option value="" disabled>
                    Choose a destination
                  </option>
                  {destinationRows.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.name} · {destination.regionName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="plan-name">Name</label>
                <input id="plan-name" name="name" required minLength={2} maxLength={100} />
              </div>
              <div className="field">
                <label htmlFor="plan-slug">Slug</label>
                <input id="plan-slug" name="slug" required minLength={2} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="japan-10gb-30d" />
              </div>
              <div className="field">
                <label htmlFor="plan-status">Status</label>
                <select id="plan-status" name="status" defaultValue="draft">
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="plan-supplier">Supplier key</label>
                <input id="plan-supplier" name="supplierKey" required maxLength={60} defaultValue="mock" />
              </div>
              <div className="field">
                <label htmlFor="plan-product">Supplier product ID</label>
                <input id="plan-product" name="supplierProductId" required maxLength={120} placeholder="mock-product-id" />
              </div>
              <div className="field">
                <label htmlFor="plan-data">Data (MB)</label>
                <input id="plan-data" name="dataMb" type="number" min={1} max={10000000} required />
              </div>
              <div className="field">
                <label htmlFor="plan-validity">Validity (days)</label>
                <input id="plan-validity" name="validityDays" type="number" min={1} max={3650} required />
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="plan-cost">Cost</label>
                <input id="plan-cost" name="cost" type="text" inputMode="decimal" required pattern="[0-9]{1,9}([.][0-9]{1,3})?" placeholder="4.50" />
              </div>
              <div className="field">
                <label htmlFor="plan-markup">Markup (basis points)</label>
                <input id="plan-markup" name="markupBps" type="number" min={0} max={100000} step={50} defaultValue={2500} />
              </div>
              <div className="field">
                <label htmlFor="plan-currency">Currency</label>
                <input id="plan-currency" name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" defaultValue="USD" />
              </div>
              <div className="field">
                <label htmlFor="plan-tax">Tax (basis points)</label>
                <input id="plan-tax" name="taxBps" type="number" min={0} max={100000} step={10} defaultValue={0} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="plan-coverage">Coverage summary</label>
              <textarea id="plan-coverage" name="coverageSummary" required minLength={3} maxLength={300} rows={2} />
            </div>
            <div className="field">
              <label htmlFor="plan-network">Network summary</label>
              <textarea id="plan-network" name="networkSummary" required minLength={3} maxLength={300} rows={2} />
            </div>
            <div className="field">
              <label htmlFor="plan-description">Description</label>
              <textarea id="plan-description" name="description" required minLength={10} maxLength={4000} rows={4} />
            </div>
            <div className="field">
              <label htmlFor="plan-features">Features (one per line)</label>
              <textarea id="plan-features" name="features" maxLength={2000} rows={3} placeholder="Instant delivery&#10;Low-latency network&#10;No physical SIM required" />
            </div>
            <label className="checkbox">
              <input type="checkbox" name="isDemo" defaultChecked />
              <span>Illustrative catalogue entry (marked DEMO; never sold as a live offer)</span>
            </label>
            <button className="button" type="submit">Create plan</button>
          </form>
        </details>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Plan</th>
              <th scope="col">Cost</th>
              <th scope="col">Price</th>
              <th scope="col">Status</th>
              <th scope="col">Manage</th>
            </tr>
          </thead>
          <tbody>
            {planUsage.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <strong>{plan.name}</strong>
                  <br />
                  <span className="small muted">
                    {destinationNameById.get(plan.destinationId) ?? "Unknown destination"} ·{" "}
                    {regionNameById.get(plan.destinationId) ?? ""} · {plan.dataMb} MB /{" "}
                    {plan.validityDays} days
                  </span>
                  <br />
                  <span className={`badge ${plan.isDemo ? "badge-demo" : "badge-neutral"}`}>
                    {plan.isDemo ? "Illustrative" : "Live offer"}
                  </span>
                  {plan.orderItemCount > 0 ? (
                    <>
                      {" "}
                      <span className="badge badge-neutral">
                        Sold {plan.orderItemCount}×
                      </span>
                    </>
                  ) : null}
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
                  {canManage ? (
                    <div className="stack-sm">
                      <details>
                        <summary className="button button-ghost button-small">Edit</summary>
                        <form action={upsertPlanAction} className="form section-tight">
                          <input type="hidden" name="planId" value={plan.id} />
                          <div className="form-grid">
                            <div className="field">
                              <label htmlFor={`destination-${plan.id}`}>Destination</label>
                              <select id={`destination-${plan.id}`} name="destinationId" required defaultValue={plan.destinationId}>
                                {destinationRows.map((destination) => (
                                  <option key={destination.id} value={destination.id}>
                                    {destination.name} · {destination.regionName}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="field">
                              <label htmlFor={`name-${plan.id}`}>Name</label>
                              <input id={`name-${plan.id}`} name="name" required minLength={2} maxLength={100} defaultValue={plan.name} />
                            </div>
                            <div className="field">
                              <label htmlFor={`slug-${plan.id}`}>Slug</label>
                              <input id={`slug-${plan.id}`} name="slug" required minLength={2} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={plan.slug} />
                            </div>
                            <div className="field">
                              <label htmlFor={`status-${plan.id}`}>Status</label>
                              <select id={`status-${plan.id}`} name="status" defaultValue={plan.status}>
                                <option value="published">Published</option>
                                <option value="draft">Draft</option>
                                <option value="archived">Archived</option>
                              </select>
                            </div>
                          </div>
                          <div className="form-grid">
                            <div className="field">
                              <label htmlFor={`supplier-${plan.id}`}>Supplier key</label>
                              <input id={`supplier-${plan.id}`} name="supplierKey" required maxLength={60} defaultValue={plan.supplierKey} />
                            </div>
                            <div className="field">
                              <label htmlFor={`product-${plan.id}`}>Supplier product ID</label>
                              <input id={`product-${plan.id}`} name="supplierProductId" required maxLength={120} defaultValue={plan.supplierProductId} />
                            </div>
                            <div className="field">
                              <label htmlFor={`data-${plan.id}`}>Data (MB)</label>
                              <input id={`data-${plan.id}`} name="dataMb" type="number" min={1} max={10000000} required defaultValue={plan.dataMb} />
                            </div>
                            <div className="field">
                              <label htmlFor={`validity-${plan.id}`}>Validity (days)</label>
                              <input id={`validity-${plan.id}`} name="validityDays" type="number" min={1} max={3650} required defaultValue={plan.validityDays} />
                            </div>
                          </div>
                          <div className="form-grid">
                            <div className="field">
                              <label htmlFor={`cost-${plan.id}`}>Cost</label>
                              <input id={`cost-${plan.id}`} name="cost" type="text" inputMode="decimal" required pattern="[0-9]{1,9}([.][0-9]{1,3})?" defaultValue={costInputValue(plan.costMinor, plan.currency)} />
                            </div>
                            <div className="field">
                              <label htmlFor={`markup-${plan.id}`}>Markup (basis points)</label>
                              <input id={`markup-${plan.id}`} name="markupBps" type="number" min={0} max={100000} step={50} defaultValue={plan.markupBps} />
                            </div>
                            <div className="field">
                              <label htmlFor={`currency-${plan.id}`}>Currency</label>
                              <input id={`currency-${plan.id}`} name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" defaultValue={plan.currency} />
                            </div>
                            <div className="field">
                              <label htmlFor={`tax-${plan.id}`}>Tax (basis points)</label>
                              <input id={`tax-${plan.id}`} name="taxBps" type="number" min={0} max={100000} step={10} defaultValue={plan.taxBps} />
                            </div>
                          </div>
                          <div className="field">
                            <label htmlFor={`coverage-${plan.id}`}>Coverage summary</label>
                            <textarea id={`coverage-${plan.id}`} name="coverageSummary" required minLength={3} maxLength={300} rows={2} defaultValue={plan.coverageSummary} />
                          </div>
                          <div className="field">
                            <label htmlFor={`network-${plan.id}`}>Network summary</label>
                            <textarea id={`network-${plan.id}`} name="networkSummary" required minLength={3} maxLength={300} rows={2} defaultValue={plan.networkSummary} />
                          </div>
                          <div className="field">
                            <label htmlFor={`description-${plan.id}`}>Description</label>
                            <textarea id={`description-${plan.id}`} name="description" required minLength={10} maxLength={4000} rows={4} defaultValue={plan.description} />
                          </div>
                          <div className="field">
                            <label htmlFor={`features-${plan.id}`}>Features (one per line)</label>
                            <textarea id={`features-${plan.id}`} name="features" maxLength={2000} rows={3} defaultValue={(plan.features ?? []).join("\n")} />
                          </div>
                          <label className="checkbox">
                            <input type="checkbox" name="isDemo" defaultChecked={plan.isDemo} />
                            <span>Illustrative catalogue entry (marked DEMO; never sold as a live offer)</span>
                          </label>
                          <button className="button button-secondary button-small" type="submit">Save plan</button>
                        </form>
                      </details>
                      <form action={deletePlanAction}>
                        <input type="hidden" name="planId" value={plan.id} />
                        <button
                          className="button button-ghost button-small"
                          type="submit"
                          disabled={plan.orderItemCount > 0}
                          title={plan.orderItemCount > 0 ? "Sold in orders; archive it instead" : "Delete plan"}
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  ) : (
                    <span className="small muted">Read only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Every create, update, and delete is recorded in the audit log with the acting administrator.
        Plans referenced by any order line cannot be deleted; archive them instead so historical
        orders remain valid.
      </p>
    </>
  );
}
