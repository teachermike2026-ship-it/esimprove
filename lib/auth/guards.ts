import { redirect } from "next/navigation";
import { getCurrentSession, getCurrentUser } from "@/lib/auth/session";
import { isAdminRole, requirePermissionFor, type Permission } from "@/lib/auth/roles";

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
  if (!requirePermissionFor(session.user.role, permission)) {
    redirect("/portal");
  }
  return session.user;
}
