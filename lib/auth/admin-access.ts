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
  | "alerts";

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
};

export interface AdminNavItem {
  section: AdminSection;
  href: string;
  label: string;
  /** Rendered as a clearly-disabled entry; the surface is unavailable in this build. */
  comingLater?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/** Sidebar grouped by area of work. Keep entries in sync with the pages they link to. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { label: "Overview", items: [{ section: "overview", href: "/admin", label: "Overview" }] },
  {
    label: "Operations",
    items: [
      { section: "orders", href: "/admin/orders", label: "Orders" },
      { section: "attention", href: "/admin/attention", label: "Needs attention" },
      { section: "jobs", href: "/admin/jobs", label: "Fulfillment jobs" },
    ],
  },
  {
    label: "Money",
    items: [
      { section: "payments", href: "/admin/payments", label: "Payments & USDT" },
      { section: "refunds", href: "/admin/refunds", label: "Refunds & disputes" },
      { section: "revenue", href: "/admin/revenue", label: "Revenue & profit" },
      { section: "finance", href: "/admin/finance", label: "Finance ledger" },
    ],
  },
  { label: "Supplier", items: [{ section: "provider", href: "/admin/provider", label: "eSIM Access" }] },
  {
    label: "Customers",
    items: [
      { section: "customers", href: "/admin/customers", label: "Customers" },
      { section: "support", href: "/admin/support", label: "Support" },
      { section: "help", href: "/admin/help", label: "Help center" },
    ],
  },
  { label: "Analytics", items: [{ section: "analytics", href: "/admin/analytics", label: "Visitors & funnel" }] },
  {
    label: "Catalog",
    items: [
      { section: "plans", href: "/admin/plans", label: "Plans & pricing" },
      { section: "pricing", href: "/admin/pricing", label: "Markup rules" },
      { section: "plans", href: "/admin/plans/destinations", label: "Destinations" },
      { section: "plans", href: "/admin/plans/regions", label: "Regions" },
      { section: "coupons", href: "/admin/coupons", label: "Promotions" },
    ],
  },
  { label: "Communication", items: [{ section: "emails", href: "/admin/emails", label: "Email Center" }] },
  {
    label: "System",
    items: [
      { section: "alerts", href: "/admin/alerts", label: "Alerts" },
      { section: "monitoring", href: "/admin/monitoring", label: "Monitoring" },
      { section: "audit", href: "/admin/audit", label: "Audit log" },
    ],
  },
  {
    label: "Settings",
    items: [
      { section: "settings", href: "/admin/settings", label: "Settings" },
      { section: "legal", href: "/admin/legal", label: "Legal & compliance" },
      { section: "integrations", href: "/admin/integrations", label: "API Integrations" },
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
