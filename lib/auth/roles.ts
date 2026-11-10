export const ROLES = [
  "customer",
  "admin",
  "support",
  "finance",
  "super_admin",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "orders.read",
  "orders.write",
  "orders.refund",
  "invoices.read",
  "refunds.write",
  "support.read",
  "support.write",
  "coupons.manage",
  "pricing.manage",
  "plans.manage",
  "destinations.manage",
  "integrations.manage",
  "users.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS: Permission[] = [
  "orders.read",
  "orders.write",
  "orders.refund",
  "invoices.read",
  "refunds.write",
  "support.read",
  "support.write",
  "coupons.manage",
  "pricing.manage",
  "plans.manage",
  "destinations.manage",
  "integrations.manage",
  "users.manage",
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  customer: [],
  admin: ALL_PERMISSIONS,
  super_admin: ALL_PERMISSIONS,
  support: ["orders.read", "support.read", "support.write"],
  // Refund execution is an administrator-only operation in this build. The
  // finance role remains read-only until a four-eyes approval workflow and a
  // finance-specific admin surface are implemented.
  finance: ["orders.read", "invoices.read"],
};

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export function isStaffRole(role: string | null | undefined): boolean {
  return (
    role === "admin" ||
    role === "super_admin" ||
    role === "support" ||
    role === "finance"
  );
}

export function hasPermission(
  role: string | null | undefined,
  permission: Permission,
): boolean {
  const resolved = (role ?? "customer") as Role;
  const allowed = ROLE_PERMISSIONS[resolved] ?? ROLE_PERMISSIONS.customer;
  if (allowed.includes(permission)) return true;
  if (
    (resolved === "admin" || resolved === "super_admin") &&
    ROLE_PERMISSIONS.admin.includes(permission)
  ) {
    return true;
  }
  return false;
}

/**
 * Authorization decision for staff-only surfaces. Customers never receive staff
 * permissions; they only ever reach their own records.
 */
export function requirePermissionFor(
  role: string | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  const resolved = (role ?? "customer") as Role;
  const allowed = ROLE_PERMISSIONS[resolved] ?? ROLE_PERMISSIONS.customer;
  if (allowed.includes(permission)) return true;
  if (
    (resolved === "admin" || resolved === "super_admin") &&
    ROLE_PERMISSIONS.admin.includes(permission)
  ) {
    return true;
  }
  return false;
}
