import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import {
  listCapabilitiesForConnections,
  listConnections,
} from "@/lib/adapters/connection-store";
import { ShieldIcon } from "@/components/icons";

export const metadata = {
  title: "Admin supplier integrations",
  robots: { index: false, follow: false },
};

export default async function AdminIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  await requireStaff("/admin/integrations", "integrations");
  const { created } = await searchParams;
  const connections = await listConnections();
  const capabilities = await listCapabilitiesForConnections(connections.map((conn) => conn.id));
  const capabilityLabels: Record<string, string[]> = {};
  for (const capability of capabilities) {
    const labels = capabilityLabels[capability.connectionId] ?? [];
    labels.push(`${capability.capability} (${capability.status})`);
    capabilityLabels[capability.connectionId] = labels;
  }

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Supplier connect</p>
          <h1>API Integrations</h1>
          <p className="muted">Configure and monitor supplier API connections securely.</p>
        </div>
        <Link className="button" href="/admin/integrations/new">Add connection</Link>
      </div>

      {created === "1" ? (
        <div className="callout callout-success section-tight" role="status">
          <p>
            Connection stored with an encrypted credential. It remains disabled and no
            supplier request was made.
          </p>
        </div>
      ) : null}

      <section className="card form section-tight">
        <h2>Security notes</h2>
        <ul className="simple-list small muted">
          <li>No supplier adapter is implemented; no live supplier has been selected or contacted.</li>
          <li>Connection creation validates the base URL against localhost, private, link-local, metadata, and reserved destinations before saving.</li>
          <li>DNS resolution is validated by the same guard when an outbound request path is implemented; no outbound connection test exists in this build.</li>
          <li>API keys and credentials are encrypted with AES-256-GCM and bound to their connection record.</li>
          <li>Supplier traffic stays disabled until a contract, adapter documentation, and sandbox verification exist.</li>
        </ul>
      </section>

      {connections.length === 0 && (
        <section className="card form section-tight">
          <div className="callout callout-neutral">
            <p>No supplier connection configured.</p>
            <p className="small muted">When a supplier is selected, this module records the connection metadata and encrypted credential only. Adapter endpoints remain unimplemented.</p>
            <Link className="button button-small" href="/admin/integrations/new">Add connection</Link>
          </div>
        </section>
      )}

      {connections.map((conn) => (
        <section key={conn.id} className="card form section-tight">
          <div className="flex-between">
            <h3>{conn.displayName}</h3>
            <span className="badge badge-neutral">{conn.environment}</span>
          </div>
          <p className="small muted">Adapter: {conn.adapterType} · Base URL: {conn.baseUrl}</p>
          <dl className="meta-list">
            <div><dt>Enabled</dt><dd>{conn.enabled ? "Yes" : "No"}</dd></div>
            <div><dt>Connection status</dt><dd>{conn.status}</dd></div>
            <div><dt>Last test</dt><dd>{conn.lastTestAt ? new Date(conn.lastTestAt).toLocaleString() : "—"}</dd></div>
            <div><dt>Last sync</dt><dd>{conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : "—"}</dd></div>
            <div><dt>Verified capabilities</dt><dd>{capabilityLabels[conn.id]?.join(", ") || "None verified"}</dd></div>
          </dl>
          {conn.lastErrorSafe && (
            <p className="small muted callout callout-warning">Sanitized error: {conn.lastErrorSafe}</p>
          )}
          <p className="small muted">
            <ShieldIcon className="inline-icon" /> Connection settings, tests, and sync are not
            implemented. No outbound supplier request is available in this build.
          </p>
        </section>
      ))}
    </>
  );
}
