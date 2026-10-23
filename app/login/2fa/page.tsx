import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { TwoFactorForm } from "@/components/auth-forms";
import { safeNextPath } from "@/lib/validation";
import { LockIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Two-factor verification",
  robots: { index: false, follow: false },
};

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(safeNextPath(next, "/admin"))}`);
  if (!session.pendingTwoFactor) {
    redirect(session.user.role === "admin" ? "/admin" : "/portal");
  }
  const nextPath = safeNextPath(next, "/admin");

  return (
    <div className="auth-layout auth-layout-narrow">
      <section className="auth-copy">
        <p className="eyebrow">Operator verification</p>
        <h1>Enter your authenticator code</h1>
        <p className="lead">
          The password step succeeded. Admin access requires a current 6-digit TOTP code.
        </p>
        <div className="callout">
          <LockIcon className="inline-icon" />
          <p>
            Pending sessions expire after 10 minutes. After verification, this admin session
            expires according to <code>ADMIN_SESSION_TTL_MINUTES</code>.
          </p>
        </div>
      </section>
      <section className="auth-form">
        <TwoFactorForm next={nextPath} />
      </section>
    </div>
  );
}
