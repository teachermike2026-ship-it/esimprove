import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/roles";
import { SetPasswordForm } from "@/components/set-password-form";

export const metadata: Metadata = {
  title: "Set new password",
  robots: { index: false, follow: false },
};

export default async function AdminSetPasswordPage() {
  const session = await getCurrentSession();
  const isAdmin = isAdminRole(session?.user.role ?? "");
  if (!session || !isAdmin) {
    redirect("/login?next=%2Fadmin%2Fset-password");
  }
  if (session.pendingTwoFactor) redirect("/login/2fa?next=%2Fadmin%2Fset-password");
  if (!session.user.passwordChangeRequired) {
    redirect("/admin");
  }

  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">Owner security</p>
        <h1>Set your new password</h1>
        <p className="muted">
          Your temporary owner password was accepted. Choose a strong new password to finish the
          first-login rotation. The temporary password will stop working and existing sessions will be
          invalidated.
        </p>
      </div>
      <SetPasswordForm />
    </div>
  );
}
