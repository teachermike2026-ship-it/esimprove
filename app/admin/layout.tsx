import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/guards";
import { getCurrentSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/roles";
import { ADMIN_NAV_GROUPS, canAccessAdminSection } from "@/lib/auth/admin-access";
import { demoMode, integrationModes } from "@/lib/config";
import { ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Admin console",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "/admin";
  if (pathname === "/admin/set-password") {
    const session = await getCurrentSession();
    if (!session) redirect("/login");
    if (session.pendingTwoFactor) redirect("/login/2fa");
    if (!isStaffRole(session.user.role)) redirect("/portal");
    return <main className="admin-main">{children}</main>;
  }
  const staff = await requireStaff("/admin");
  // Only render links the current role can actually open. Page-level guards
  // enforce the same matrix server-side, so hiding a link is never the control.
  const groups = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessAdminSection(staff.role, item.section)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="admin-layout">
      <aside className="admin-nav" aria-label="Admin navigation">
        <div className="admin-nav-head">
          <span className="badge badge-demo">Operator</span>
          <p className="small muted">{staff.email}</p>
        </div>
        {groups.map((group) => (
          <div className="admin-nav-group" key={group.label}>
            <p className="admin-nav-group-label">{group.label}</p>
            {group.items.map((item) =>
              item.comingLater ? (
                <span key={item.href} className="admin-nav-disabled" aria-disabled="true">
                  {item.label} <span className="badge badge-neutral">Coming later</span>
                </span>
              ) : (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ),
            )}
          </div>
        ))}
        <Link href="/">View storefront</Link>
      </aside>
      <section className="admin-main">
        <div className="admin-toolbar">
          <div>
            <p className="eyebrow">Operator console</p>
            <p className="small muted">
              {demoMode ? "Local mode" : "Live mode"} · supplier {integrationModes.supplier} ·
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
