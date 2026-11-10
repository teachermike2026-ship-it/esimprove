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
  | "orders";

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
};

export interface AdminNavItem {
  section: AdminSection;
  href: string;
  label: string;
}

/** Sidebar order. Keep entries in sync with the pages they link to. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { section: "overview", href: "/admin", label: "Overview" },
  { section: "analytics", href: "/admin/analytics", label: "Analytics" },
  { section: "finance", href: "/admin/finance", label: "Finance" },
  { section: "customers", href: "/admin/customers", label: "Customers" },
  { section: "legal", href: "/admin/legal", label: "Legal & compliance" },
  { section: "monitoring", href: "/admin/monitoring", label: "Monitoring & alerts" },
  { section: "seo", href: "/admin/seo", label: "SEO & CMS" },
  { section: "blog", href: "/admin/blog", label: "Blog & articles" },
  { section: "help", href: "/admin/help", label: "Help center" },
  { section: "support", href: "/admin/support", label: "Support" },
  { section: "audit", href: "/admin/audit", label: "Audit log" },
  { section: "provider", href: "/admin/provider", label: "Supplier" },
  { section: "integrations", href: "/admin/integrations", label: "API Integrations" },
  { section: "jobs", href: "/admin/jobs", label: "Fulfillment jobs" },
  { section: "plans", href: "/admin/plans", label: "Plans & pricing" },
  { section: "payments", href: "/admin/payments", label: "Payments" },
  { section: "refunds", href: "/admin/refunds", label: "Refunds" },
  { section: "coupons", href: "/admin/coupons", label: "Coupons" },
  { section: "pricing", href: "/admin/pricing", label: "Pricing rules" },
  { section: "emails", href: "/admin/emails", label: "Email log" },
  { section: "settings", href: "/admin/settings", label: "Settings" },
  { section: "orders", href: "/admin/orders", label: "Orders" },
];

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
