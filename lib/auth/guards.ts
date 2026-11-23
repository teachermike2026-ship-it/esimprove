import { redirect } from "next/navigation";
import { getCurrentSession, getCurrentUser } from "@/lib/auth/session";
import {
  canAccessAdminSection,
  type AdminSection,
} from "@/lib/auth/admin-access";
import { isAdminRole, isStaffRole, requirePermissionFor, type Permission } from "@/lib/auth/roles";

export async function requireUser(nextPath = "/portal") {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

/**
 * Admin guard with optional per-resource permission enforcement. When no
 * permission is supplied the caller requires an administrator role.
 */
export async function requireAdmin(nextPath = "/admin", permission?: Permission) {
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (session.pendingTwoFactor) {
    redirect("/login/2fa");
  }
  if (session.user.passwordChangeRequired) {
    redirect("/admin/set-password");
  }
  const allowed = permission
    ? requirePermissionFor(session.user.role, permission)
    : isAdminRole(session.user.role);
  if (!allowed) {
    redirect("/portal");
  }
  return session.user;
}

export async function requirePermission(nextPath: string, permission: Permission) {
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (session.pendingTwoFactor) {
    redirect("/login/2fa");
  }
  if (session.user.passwordChangeRequired) {
    redirect("/admin/set-password");
  }
  if (!requirePermissionFor(session.user.role, permission)) {
    redirect("/portal");
  }
  return session.user;
}

/**
 * Staff guard for the operator console. Any authenticated staff role passes
 * unless a section is supplied, in which case the shared access matrix decides.
 * Use this instead of `requireAdmin()` for sections that support or finance may
 * legitimately read (for example orders or the help center).
 */
export async function requireStaff(nextPath = "/admin", section?: AdminSection) {
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (session.pendingTwoFactor) {
    redirect("/login/2fa");
  }
  if (session.user.passwordChangeRequired) {
    redirect("/admin/set-password");
  }
  const allowed = section
    ? canAccessAdminSection(session.user.role, section)
    : isStaffRole(session.user.role);
  if (!allowed) {
    redirect("/portal");
  }
  return session.user;
}
