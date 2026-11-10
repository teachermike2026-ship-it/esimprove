import { describe, expect, it } from "vitest";
import {
  hasPermission,
  isAdminRole,
  isStaffRole,
  requirePermissionFor,
} from "@/lib/auth/roles";
import {
  ADMIN_NAV_ITEMS,
  canAccessAdminSection,
} from "@/lib/auth/admin-access";

describe("role and permission policy", () => {
  it("recognizes administrator and super-administrator accounts", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
    expect(isAdminRole("finance")).toBe(false);
    expect(isAdminRole("support")).toBe(false);
    expect(isAdminRole("customer")).toBe(false);
  });

  it("keeps refund execution administrator-only", () => {
    expect(hasPermission("admin", "refunds.write")).toBe(true);
    expect(hasPermission("super_admin", "refunds.write")).toBe(true);
    expect(requirePermissionFor("finance", "refunds.write")).toBe(false);
    expect(requirePermissionFor("support", "refunds.write")).toBe(false);
    expect(requirePermissionFor("customer", "refunds.write")).toBe(false);
  });

  it("keeps finance read-only and support scoped to support/read tasks", () => {
    expect(hasPermission("finance", "orders.read")).toBe(true);
    expect(hasPermission("finance", "invoices.read")).toBe(true);
    expect(hasPermission("finance", "orders.write")).toBe(false);
    expect(hasPermission("support", "support.write")).toBe(true);
    expect(hasPermission("support", "orders.read")).toBe(true);
    expect(hasPermission("support", "invoices.read")).toBe(false);
    expect(hasPermission("support", "plans.manage")).toBe(false);
    expect(isStaffRole("support")).toBe(true);
    expect(isStaffRole("customer")).toBe(false);
  });

  it("uses one access matrix for console pages and navigation", () => {
    expect(canAccessAdminSection("admin", "legal")).toBe(true);
    expect(canAccessAdminSection("super_admin", "analytics")).toBe(true);
    expect(canAccessAdminSection("finance", "legal")).toBe(false);
    expect(canAccessAdminSection("finance", "analytics")).toBe(false);

    expect(canAccessAdminSection("finance", "overview")).toBe(true);
    expect(canAccessAdminSection("finance", "orders")).toBe(true);
    expect(canAccessAdminSection("finance", "finance")).toBe(true);
    expect(canAccessAdminSection("finance", "payments")).toBe(true);
    expect(canAccessAdminSection("finance", "refunds")).toBe(true);
    expect(canAccessAdminSection("finance", "customers")).toBe(false);
    expect(canAccessAdminSection("finance", "support")).toBe(false);
    expect(canAccessAdminSection("finance", "jobs")).toBe(false);

    expect(canAccessAdminSection("support", "overview")).toBe(true);
    expect(canAccessAdminSection("support", "orders")).toBe(true);
    expect(canAccessAdminSection("support", "customers")).toBe(true);
    expect(canAccessAdminSection("support", "support")).toBe(true);
    expect(canAccessAdminSection("support", "finance")).toBe(false);
    expect(canAccessAdminSection("support", "payments")).toBe(false);
    expect(canAccessAdminSection("support", "refunds")).toBe(false);
    expect(canAccessAdminSection("support", "plans")).toBe(false);

    expect(canAccessAdminSection("customer", "overview")).toBe(false);
    expect(canAccessAdminSection("customer", "help")).toBe(false);
    expect(canAccessAdminSection(null, "overview")).toBe(false);

    const adminLinks = ADMIN_NAV_ITEMS.filter((item) =>
      canAccessAdminSection("admin", item.section),
    );
    expect(adminLinks).toHaveLength(ADMIN_NAV_ITEMS.length);

    const supportLinks = ADMIN_NAV_ITEMS.filter((item) =>
      canAccessAdminSection("support", item.section),
    );
    expect(supportLinks.map((item) => item.section)).toEqual([
      "overview",
      "customers",
      "help",
      "support",
      "orders",
    ]);
    expect(supportLinks.map((item) => item.href)).not.toContain("/admin/payments");
  });

  it("only grants integration management to administrators", () => {
    expect(hasPermission("admin", "integrations.manage")).toBe(true);
    expect(hasPermission("super_admin", "integrations.manage")).toBe(true);
    expect(hasPermission("finance", "integrations.manage")).toBe(false);
    expect(hasPermission("support", "integrations.manage")).toBe(false);
  });
});
