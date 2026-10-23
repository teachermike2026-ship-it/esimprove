import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { demoMode, integrationModes } from "@/lib/config";
import { AdminIcon, ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Demo admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin("/admin");

  return (
    <div className="admin-layout">
      <aside className="admin-nav" aria-label="Admin navigation">
        <div className="admin-nav-head">
          <span className="badge badge-demo">Operator</span>
          <p className="small muted">{admin.email}</p>
        </div>
        <Link href="/admin">
          <AdminIcon className="inline-icon" /> Overview
        </Link>
        <Link href="/admin/orders">Orders</Link>
        <Link href="/admin/jobs">Fulfillment jobs</Link>
        <Link href="/admin/plans">Plans &amp; pricing</Link>
        <Link href="/admin/emails">Email log</Link>
        <Link href="/admin/settings">Settings</Link>
        <Link href="/">View storefront</Link>
      </aside>
      <section className="admin-main">
        <div className="admin-toolbar">
          <div>
            <p className="eyebrow">Operator console</p>
            <p className="small muted">
              {demoMode ? "Demo mode" : "Live mode"} · supplier {integrationModes.supplier} ·
              payments {integrationModes.payments} · email {integrationModes.email}
            </p>
          </div>
          <span className="badge badge-warning">
            <ShieldIcon className="inline-icon" /> No live integrations
          </span>
        </div>
        {children}
      </section>
    </div>
  );
}
