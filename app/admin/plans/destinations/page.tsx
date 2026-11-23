import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import {
  listCatalogueDestinations,
  listCatalogueRegions,
} from "@/lib/catalogue";
import {
  deleteDestinationAction,
  upsertDestinationAction,
} from "@/app/admin/catalogue-actions";

export const metadata: Metadata = {
  title: "Admin destinations",
  robots: { index: false, follow: false },
};

export default async function AdminDestinationsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const staff = await requireStaff("/admin/plans/destinations", "plans");
  const canManage = hasPermission(staff.role, "plans.manage");
  const { saved, error } = await searchParams;
  const db = await getDb();
  const [destinations, regions] = await Promise.all([
    listCatalogueDestinations(db),
    listCatalogueRegions(db),
  ]);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Destinations</h1>
          <p className="muted">
            Markets shown in the storefront. Each destination belongs to a region and carries the
            content shown on its public page.
          </p>
        </div>
        <div className="pill-row">
          <Link className="button button-ghost button-small" href="/admin/plans">
            Plans
          </Link>
          <Link className="button button-ghost button-small" href="/admin/plans/regions">
            Regions
          </Link>
        </div>
      </div>

      {saved ? (
        <div className="callout callout-success section-tight" role="status">
          <p>{saved === "deleted" ? "Destination deleted." : "Destination saved."}</p>
        </div>
      ) : null}
      {error ? (
        <div className="form-error section-tight" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      {!canManage ? (
        <div className="callout callout-warning section-tight">
          <p>
            Your role can view catalogue destinations but cannot change them. Ask an administrator
            with catalogue permissions.
          </p>
        </div>
      ) : null}

      {canManage ? (
        <details className="card form section-tight">
          <summary className="admin-details-summary">Add a destination</summary>
          <form action={upsertDestinationAction} className="form section-tight">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="destination-region">Region</label>
                <select id="destination-region" name="regionId" required defaultValue={regions[0]?.id ?? ""}>
                  <option value="" disabled>
                    Choose a region
                  </option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="destination-name">Name</label>
                <input id="destination-name" name="name" required minLength={2} maxLength={80} />
              </div>
              <div className="field">
                <label htmlFor="destination-slug">Slug</label>
                <input
                  id="destination-slug"
                  name="slug"
                  required
                  minLength={2}
                  maxLength={80}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="japan"
                />
              </div>
              <div className="field">
                <label htmlFor="destination-country">Country code</label>
                <input
                  id="destination-country"
                  name="countryCode"
                  required
                  minLength={2}
                  maxLength={3}
                  pattern="[A-Za-z]{2,3}"
                  placeholder="JP"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="destination-summary">Short summary</label>
              <textarea id="destination-summary" name="summary" required minLength={5} maxLength={300} rows={2} />
            </div>
            <div className="field">
              <label htmlFor="destination-description">Description</label>
              <textarea id="destination-description" name="description" required minLength={10} maxLength={2000} rows={4} />
            </div>
            <label className="checkbox">
              <input type="checkbox" name="popular" />
              <span>Feature as a popular destination</span>
            </label>
            <button className="button" type="submit">Create destination</button>
          </form>
        </details>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Destination</th>
              <th scope="col">Region</th>
              <th scope="col">Code</th>
              <th scope="col">Plans</th>
              <th scope="col">Manage</th>
            </tr>
          </thead>
          <tbody>
            {destinations.map((destination) => (
              <tr key={destination.id}>
                <td>
                  <strong>
                    {destination.name}
                    {destination.popular ? " ★" : ""}
                  </strong>
                  <br />
                  <span className="small muted">{destination.summary}</span>
                </td>
                <td>{destination.regionName}</td>
                <td>{destination.countryCode}</td>
                <td>{destination.planCount}</td>
                <td>
                  {canManage ? (
                    <div className="stack-sm">
                      <details>
                        <summary className="button button-ghost button-small">Edit</summary>
                        <form action={upsertDestinationAction} className="form section-tight">
                          <input type="hidden" name="destinationId" value={destination.id} />
                          <div className="form-grid">
                            <div className="field">
                              <label htmlFor={`region-${destination.id}`}>Region</label>
                              <select id={`region-${destination.id}`} name="regionId" required defaultValue={destination.regionId}>
                                {regions.map((region) => (
                                  <option key={region.id} value={region.id}>
                                    {region.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="field">
                              <label htmlFor={`name-${destination.id}`}>Name</label>
                              <input id={`name-${destination.id}`} name="name" required minLength={2} maxLength={80} defaultValue={destination.name} />
                            </div>
                            <div className="field">
                              <label htmlFor={`slug-${destination.id}`}>Slug</label>
                              <input id={`slug-${destination.id}`} name="slug" required minLength={2} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={destination.slug} />
                            </div>
                            <div className="field">
                              <label htmlFor={`country-${destination.id}`}>Country code</label>
                              <input id={`country-${destination.id}`} name="countryCode" required minLength={2} maxLength={3} pattern="[A-Za-z]{2,3}" defaultValue={destination.countryCode} />
                            </div>
                          </div>
                          <div className="field">
                            <label htmlFor={`summary-${destination.id}`}>Short summary</label>
                            <textarea id={`summary-${destination.id}`} name="summary" required minLength={5} maxLength={300} rows={2} defaultValue={destination.summary} />
                          </div>
                          <div className="field">
                            <label htmlFor={`description-${destination.id}`}>Description</label>
                            <textarea id={`description-${destination.id}`} name="description" required minLength={10} maxLength={2000} rows={4} defaultValue={destination.description} />
                          </div>
                          <label className="checkbox">
                            <input type="checkbox" name="popular" defaultChecked={destination.popular} />
                            <span>Feature as a popular destination</span>
                          </label>
                          <button className="button button-secondary button-small" type="submit">Save destination</button>
                        </form>
                      </details>
                      <form action={deleteDestinationAction}>
                        <input type="hidden" name="destinationId" value={destination.id} />
                        <button className="button button-ghost button-small" type="submit" disabled={destination.planCount > 0} title={destination.planCount > 0 ? "Destination still contains plans" : "Delete destination"}>
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
        A destination containing plans cannot be deleted. Plans sold in orders can never be deleted;
        archive them instead. Every change is recorded in the audit log.
      </p>
    </>
  );
}
