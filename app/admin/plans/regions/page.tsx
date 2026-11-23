import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { listCatalogueRegions } from "@/lib/catalogue";
import {
  deleteRegionAction,
  upsertRegionAction,
} from "@/app/admin/catalogue-actions";

export const metadata: Metadata = {
  title: "Admin regions",
  robots: { index: false, follow: false },
};

export default async function AdminRegionsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const staff = await requireStaff("/admin/plans/regions", "plans");
  const canManage = hasPermission(staff.role, "plans.manage");
  const { saved, error } = await searchParams;
  const db = await getDb();
  const regions = await listCatalogueRegions(db);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Regions</h1>
          <p className="muted">
            Group destinations by market region. Regions are used for storefront grouping and
            for catalogue reporting.
          </p>
        </div>
        <div className="pill-row">
          <Link className="button button-ghost button-small" href="/admin/plans">
            Plans
          </Link>
          <Link className="button button-ghost button-small" href="/admin/plans/destinations">
            Destinations
          </Link>
        </div>
      </div>

      {saved ? (
        <div className="callout callout-success section-tight" role="status">
          <p>{saved === "deleted" ? "Region deleted." : "Region saved."}</p>
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
            Your role can view catalogue regions but cannot change them. Ask an administrator
            with catalogue permissions.
          </p>
        </div>
      ) : null}

      {canManage ? (
        <details className="card form section-tight">
          <summary className="admin-details-summary">Add a region</summary>
          <form action={upsertRegionAction} className="form section-tight">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="region-name">Name</label>
                <input id="region-name" name="name" required minLength={2} maxLength={80} />
              </div>
              <div className="field">
                <label htmlFor="region-slug">Slug</label>
                <input
                  id="region-slug"
                  name="slug"
                  required
                  minLength={2}
                  maxLength={80}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="europe"
                />
              </div>
              <div className="field">
                <label htmlFor="region-accent">Accent key</label>
                <input id="region-accent" name="accent" required maxLength={30} defaultValue="teal" />
              </div>
              <div className="field">
                <label htmlFor="region-sort">Sort order</label>
                <input id="region-sort" name="sortOrder" type="number" min={0} max={10000} defaultValue={0} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="region-description">Description</label>
              <textarea id="region-description" name="description" required minLength={10} maxLength={600} rows={3} />
            </div>
            <button className="button" type="submit">Create region</button>
          </form>
        </details>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">Slug</th>
              <th scope="col">Destinations</th>
              <th scope="col">Sort</th>
              <th scope="col">Manage</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((region) => (
              <tr key={region.id}>
                <td>
                  <strong>{region.name}</strong>
                  <br />
                  <span className="small muted">{region.description}</span>
                </td>
                <td>{region.slug}</td>
                <td>{region.destinationCount}</td>
                <td>{region.sortOrder}</td>
                <td>
                  {canManage ? (
                    <div className="stack-sm">
                      <details>
                        <summary className="button button-ghost button-small">Edit</summary>
                        <form action={upsertRegionAction} className="form section-tight">
                          <input type="hidden" name="regionId" value={region.id} />
                          <div className="field">
                            <label htmlFor={`name-${region.id}`}>Name</label>
                            <input id={`name-${region.id}`} name="name" required minLength={2} maxLength={80} defaultValue={region.name} />
                          </div>
                          <div className="field">
                            <label htmlFor={`slug-${region.id}`}>Slug</label>
                            <input id={`slug-${region.id}`} name="slug" required minLength={2} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={region.slug} />
                          </div>
                          <div className="field">
                            <label htmlFor={`accent-${region.id}`}>Accent key</label>
                            <input id={`accent-${region.id}`} name="accent" required maxLength={30} defaultValue={region.accent} />
                          </div>
                          <div className="field">
                            <label htmlFor={`sort-${region.id}`}>Sort order</label>
                            <input id={`sort-${region.id}`} name="sortOrder" type="number" min={0} max={10000} defaultValue={region.sortOrder} />
                          </div>
                          <div className="field">
                            <label htmlFor={`description-${region.id}`}>Description</label>
                            <textarea id={`description-${region.id}`} name="description" required minLength={10} maxLength={600} rows={3} defaultValue={region.description} />
                          </div>
                          <button className="button button-secondary button-small" type="submit">Save region</button>
                        </form>
                      </details>
                      <form action={deleteRegionAction}>
                        <input type="hidden" name="regionId" value={region.id} />
                        <button className="button button-ghost button-small" type="submit" disabled={region.destinationCount > 0} title={region.destinationCount > 0 ? "Region still contains destinations" : "Delete region"}>
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
        A region containing destinations cannot be deleted. Move or remove the destinations first.
        Every create, update, and delete is recorded in the audit log.
      </p>
    </>
  );
}
