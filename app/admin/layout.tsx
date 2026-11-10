import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { ADMIN_NAV_ITEMS, canAccessAdminSection } from "@/lib/auth/admin-access";
import { demoMode, integrationModes } from "@/lib/config";
import { ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Demo admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff("/admin");
  // Only render links the current role can actually open. Page-level guards
  // enforce the same matrix server-side, so hiding a link is never the control.
  const links = ADMIN_NAV_ITEMS.filter((item) =>
    canAccessAdminSection(staff.role, item.section),
  );

  return (
    <div className="admin-layout">
      <aside className="admin-nav" aria-label="Admin navigation">
        <div className="admin-nav-head">
          <span className="badge badge-demo">Operator</span>
          <p className="small muted">{staff.email}</p>
        </div>
        {links.map((item) => (
          <Link key={item.section} href={item.href}>
            {item.label}
          </Link>
        ))}
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
