import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { TwoFactorForm } from "@/components/auth-forms";
import { isAdminRole } from "@/lib/auth/roles";
import { safeNextPath } from "@/lib/validation";
import { LockIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/login/2fa",
    title: t("auth.metaTwoFactor"),
    robots: { index: false, follow: false },
  });
}

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const { t } = await getI18n();
  const session = await getCurrentSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(safeNextPath(next, "/admin"))}`);
  if (!session.pendingTwoFactor) {
    redirect(isAdminRole(session.user.role) ? "/admin" : "/portal");
  }
  const nextPath = safeNextPath(next, "/admin");

  return (
    <div className="auth-layout auth-layout-narrow">
      <section className="auth-copy">
        <p className="eyebrow">{t("auth.twoFactorTitle")}</p>
        <h1>{t("auth.twoFactorHeading")}</h1>
        <p className="lead">{t("auth.twoFactorPasswordStep")}</p>
        <div className="callout">
          <LockIcon className="inline-icon" />
          <p>{t("auth.twoFactorExpiry")}</p>
        </div>
      </section>
      <section className="auth-form">
        <TwoFactorForm next={nextPath} />
      </section>
    </div>
  );
}
