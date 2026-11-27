import {
  hasPermission,
  isAdminRole,
  isStaffRole,
  type Permission,
} from "@/lib/auth/roles";

/**
 * Single access matrix for the operator console. Pages, the sidebar, and tests
 * all read from this map so a link is never shown to a role that the page
 * guard would reject (and vice versa).
 *
 * - `staff`: any authenticated staff role (admin, super_admin, support, finance)
 * - `admin`: administrator or super-administrator only
 * - `permission`: the role must hold the named permission
 */
export type AdminSection =
  | "overview"
  | "analytics"
  | "finance"
  | "customers"
  | "legal"
  | "monitoring"
  | "seo"
  | "blog"
  | "help"
  | "support"
  | "audit"
  | "provider"
  | "integrations"
  | "jobs"
  | "plans"
  | "payments"
  | "refunds"
  | "coupons"
  | "pricing"
  | "emails"
  | "settings"
  | "orders"
  | "attention"
  | "revenue"
  | "alerts"
  | "reconciliation"
  | "search";

type AdminSectionAccess =
  | { kind: "staff" }
  | { kind: "admin" }
  | { kind: "permission"; permission: Permission };

export const ADMIN_SECTION_ACCESS: Record<AdminSection, AdminSectionAccess> = {
  overview: { kind: "staff" },
  analytics: { kind: "admin" },
  // Financial read surfaces are finance/administrator-only. Support does not
  // receive invoices.read, so customer-support staff cannot browse payments.
  finance: { kind: "permission", permission: "invoices.read" },
  customers: { kind: "permission", permission: "support.read" },
  legal: { kind: "admin" },
  monitoring: { kind: "admin" },
  seo: { kind: "admin" },
  blog: { kind: "admin" },
  help: { kind: "staff" },
  support: { kind: "permission", permission: "support.read" },
  audit: { kind: "admin" },
  provider: { kind: "admin" },
  integrations: { kind: "permission", permission: "integrations.manage" },
  jobs: { kind: "permission", permission: "orders.write" },
  plans: { kind: "permission", permission: "plans.manage" },
  payments: { kind: "permission", permission: "invoices.read" },
  refunds: { kind: "permission", permission: "invoices.read" },
  coupons: { kind: "permission", permission: "coupons.manage" },
  pricing: { kind: "permission", permission: "pricing.manage" },
  emails: { kind: "admin" },
  settings: { kind: "admin" },
  orders: { kind: "permission", permission: "orders.read" },
  // Acting on stuck/failed orders is an operator task (retries, emails).
  attention: { kind: "permission", permission: "orders.write" },
  revenue: { kind: "permission", permission: "invoices.read" },
  alerts: { kind: "admin" },
  reconciliation: { kind: "permission", permission: "invoices.read" },
  // Search results are filtered per role inside the page.
  search: { kind: "staff" },
};

export type AdminNavBadge = "processing" | "attention" | "support" | "alerts";

export interface AdminNavItem {
  section: AdminSection;
  href: string;
  label: string;
  /** Icon name from components/admin/admin-icons. */
  icon?: string;
  /** Live count shown next to the item (computed in the layout). */
  badge?: AdminNavBadge;
  /** Shows the supplier health dot. */
  statusDot?: boolean;
  /** Rendered as a clearly-disabled entry; the surface is unavailable in this build. */
  comingLater?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/** Sidebar grouped by area of work. Keep entries in sync with the pages they link to. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Main",
    items: [
      { section: "overview", href: "/admin", label: "Overview", icon: "home" },
      { section: "orders", href: "/admin/orders", label: "Orders", icon: "cart", badge: "processing" },
      { section: "attention", href: "/admin/attention", label: "Needs Attention", icon: "alert", badge: "attention" },
      { section: "payments", href: "/admin/payments", label: "Payments", icon: "card" },
      { section: "reconciliation", href: "/admin/reconciliation", label: "Reconciliation", icon: "scale" },
      { section: "provider", href: "/admin/provider", label: "Supplier", icon: "server", statusDot: true },
      { section: "revenue", href: "/admin/revenue", label: "Revenue & Profit", icon: "chart" },
      { section: "customers", href: "/admin/customers", label: "Customers", icon: "users" },
      { section: "support", href: "/admin/support", label: "Support", icon: "lifebuoy", badge: "support" },
      { section: "analytics", href: "/admin/analytics", label: "Visitor Analytics", icon: "activity" },
      { section: "analytics", href: "/admin/analytics?tab=funnel", label: "Marketing Funnel", icon: "funnel" },
      { section: "plans", href: "/admin/plans", label: "Catalog", icon: "layers" },
      { section: "coupons", href: "/admin/coupons", label: "Promotions", icon: "tag" },
      { section: "emails", href: "/admin/emails", label: "Email Center", icon: "mail" },
      { section: "alerts", href: "/admin/alerts", label: "Alerts", icon: "bell", badge: "alerts" },
      { section: "audit", href: "/admin/audit", label: "Audit Log", icon: "file" },
      { section: "settings", href: "/admin/settings", label: "Settings", icon: "settings" },
    ],
  },
  {
    label: "More tools",
    items: [
      { section: "refunds", href: "/admin/refunds", label: "Refunds & disputes" },
      { section: "finance", href: "/admin/finance", label: "Finance ledger" },
      { section: "jobs", href: "/admin/jobs", label: "Fulfillment jobs" },
      { section: "pricing", href: "/admin/pricing", label: "Markup rules" },
      { section: "plans", href: "/admin/plans/destinations", label: "Destinations" },
      { section: "plans", href: "/admin/plans/regions", label: "Regions" },
      { section: "monitoring", href: "/admin/monitoring", label: "Monitoring" },
      { section: "help", href: "/admin/help", label: "Help center" },
      { section: "legal", href: "/admin/legal", label: "Legal & compliance" },
      { section: "integrations", href: "/admin/integrations", label: "API integrations" },
      { section: "seo", href: "/admin/seo", label: "SEO & CMS" },
      { section: "blog", href: "/admin/blog", label: "Blog & articles" },
    ],
  },
];

/** Flat compatibility export: every reachable console route. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

export function canAccessAdminSection(
  role: string | null | undefined,
  section: AdminSection,
): boolean {
  if (!isStaffRole(role)) return false;
  const access = ADMIN_SECTION_ACCESS[section];
  if (access.kind === "staff") return true;
  if (access.kind === "admin") return isAdminRole(role);
  return hasPermission(role, access.permission);
}
