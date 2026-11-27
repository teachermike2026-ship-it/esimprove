import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, like, notInArray, sql } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/guards";
import { getCurrentSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/roles";
import { ADMIN_NAV_GROUPS, canAccessAdminSection, type AdminNavBadge } from "@/lib/auth/admin-access";
import { flags } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import { apiHealthChecks, orders, supportTickets } from "@/lib/db/schema";
import { attentionCountsBySeverity, getNeedsAttention, listAdminAlerts } from "@/lib/admin-ops";
import { whopMode } from "@/lib/integrations/payment/whop";
import { AdminShell, type ShellNavGroup } from "@/components/admin/admin-shell";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin console",
  robots: { index: false, follow: false },
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super administrator",
  admin: "Administrator",
  support: "Support",
  finance: "Finance",
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
  const can = (section: Parameters<typeof canAccessAdminSection>[1]) => canAccessAdminSection(staff.role, section);
  const db = await getDb();

  // Live counts for the sidebar, only for sections this role can open.
  const [processing, attention, openTickets, alerts, supplierCheck] = await Promise.all([
    can("orders")
      ? db
          .select({ n: sql<number>`count(*)::int` })
          .from(orders)
          .where(and(eq(orders.paymentStatus, "paid"), notInArray(orders.fulfillmentStatus, ["delivered", "cancelled"])))
      : Promise.resolve([{ n: 0 }]),
    can("attention") ? getNeedsAttention(db) : Promise.resolve([]),
    can("support")
      ? db.select({ n: sql<number>`count(*)::int` }).from(supportTickets).where(inArray(supportTickets.status, ["open", "pending_staff"]))
      : Promise.resolve([{ n: 0 }]),
    can("alerts") ? listAdminAlerts(db, 200) : Promise.resolve([]),
    can("provider")
      ? db.select().from(apiHealthChecks).where(like(apiHealthChecks.target, "esimaccess%")).orderBy(desc(apiHealthChecks.checkedAt)).limit(1)
      : Promise.resolve([]),
  ]);
  const unresolvedAlerts = alerts.filter((a) => !a.resolvedAt).length;
  const severity = attentionCountsBySeverity(attention);
  const badgeFor: Record<AdminNavBadge, { count: number; tone: "neutral" | "danger" }> = {
    processing: { count: Number(processing[0]?.n ?? 0), tone: "neutral" },
    attention: { count: attention.length, tone: "danger" },
    support: { count: Number(openTickets[0]?.n ?? 0), tone: "neutral" },
    alerts: { count: unresolvedAlerts, tone: "danger" },
  };
  const supplierStatus: "ok" | "error" | "unknown" = supplierCheck[0]
    ? supplierCheck[0].status === "ok"
      ? "ok"
      : "error"
    : "unknown";

  const groups: ShellNavGroup[] = ADMIN_NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => canAccessAdminSection(staff.role, item.section))
      .map((item) => ({
        href: item.href,
        label: item.label,
        icon: item.icon,
        badgeCount: item.badge ? badgeFor[item.badge].count : undefined,
        badgeTone: item.badge ? badgeFor[item.badge].tone : undefined,
        statusDot: item.statusDot ? supplierStatus : undefined,
      })),
  })).filter((group) => group.items.length > 0);

  const mode = whopMode();
  const environment =
    mode === "live" && flags.paymentsLive
      ? { label: "Live", tone: "live" as const, detail: "Live card payments are enabled" }
      : mode === "sandbox"
        ? { label: "Sandbox", tone: "sandbox" as const, detail: "Whop sandbox: test payments only" }
        : { label: "Local", tone: "local" as const, detail: "Card payments are not live on this server" };

  // System status states only what is known. It never claims "operational"
  // without a successful supplier check.
  const systemStatus =
    severity.critical > 0
      ? { tone: "error" as const, title: "Action needed", detail: `${severity.critical} critical item(s)`, href: "/admin/attention" }
      : supplierStatus === "error"
        ? { tone: "error" as const, title: "Supplier check failed", detail: "See Supplier for details", href: "/admin/provider" }
        : supplierStatus === "unknown"
          ? { tone: "warn" as const, title: "System status", detail: "Supplier not checked yet", href: "/admin/provider" }
          : { tone: "ok" as const, title: "System status", detail: "No critical issues", href: "/admin/monitoring" };

  return (
    <AdminShell
      groups={groups}
      environment={environment}
      systemStatus={systemStatus}
      alertsCount={unresolvedAlerts}
      admin={{ name: staff.name || staff.email, email: staff.email, role: ROLE_LABEL[staff.role] ?? staff.role }}
    >
      {children}
    </AdminShell>
  );
}
