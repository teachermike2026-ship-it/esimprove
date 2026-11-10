import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { createSupplierConnectionAction } from "../actions";

export const metadata = {
  title: "Admin add supplier connection",
  robots: { index: false, follow: false },
};

export default async function AddIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStaff("/admin/integrations/new", "integrations");
  const { error } = await searchParams;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Supplier connect</p>
          <h1>Add connection</h1>
          <p className="muted">
            Store a supplier connection description and encrypted credential. Saving a
            connection does not enable supplier traffic.
          </p>
        </div>
        <Link className="button button-secondary" href="/admin/integrations">
          Back to integrations
        </Link>
      </div>

      {error ? (
        <div className="form-error section-tight" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      <section className="card form section-tight">
        <h2>Connection form</h2>
        <form action={createSupplierConnectionAction}>
          <dl className="meta-list">
            <div>
              <dt>Display name</dt>
              <dd><input type="text" name="displayName" required maxLength={80} placeholder="e.g. Supplier Sandbox" /></dd>
            </div>
            <div>
              <dt>Adapter type</dt>
              <dd><input type="text" name="adapterType" required maxLength={60} pattern="[A-Za-z0-9-]+" placeholder="e.g. generic-api" /></dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>
                <select name="environment"><option value="sandbox">Sandbox</option><option value="production">Production</option></select>
              </dd>
            </div>
            <div>
              <dt>Base URL</dt>
              <dd><input type="url" name="baseUrl" required maxLength={2048} placeholder="https://api.supplier.example.com" /></dd>
            </div>
            <div>
              <dt>Authentication method</dt>
              <dd><select name="authMethod"><option value="api_key">API key</option><option value="bearer_token">Bearer token</option></select></dd>
            </div>
            <div>
              <dt>API key (encrypted at rest)</dt>
              <dd><input type="password" name="credentialSecret" required maxLength={4096} autoComplete="off" /></dd>
            </div>
          </dl>
          <button type="submit" className="button button-primary">Save connection</button>
        </form>
        <ul className="small muted">
          <li className="callout callout-warning">No supplier adapter is implemented. Saving does not test, sync, or enable the connection.</li>
          <li className="callout callout-neutral">Credentials are encrypted with AES-256-GCM and bound to this connection record. The plaintext is never logged.</li>
        </ul>
      </section>
    </>
  );
}
