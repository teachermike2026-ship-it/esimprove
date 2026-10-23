import { redirect } from "next/navigation";
import { getCurrentSession, getCurrentUser } from "@/lib/auth/session";

export async function requireUser(nextPath = "/portal") {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

export async function requireAdmin(nextPath = "/admin") {
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (session.pendingTwoFactor) {
    redirect("/login/2fa");
  }
  if (session.user.role !== "admin") {
    redirect("/portal");
  }
  return session.user;
}
