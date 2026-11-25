import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth-forms";
import { LockIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/login/reset",
    title: t("auth.metaReset"),
    robots: { index: false, follow: false },
  });
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const { t, href } = await getI18n();
  const tokenValue = token ?? "";

  return (
    <div className="auth-layout auth-layout-narrow">
      <section className="auth-copy">
        <p className="eyebrow">{t("auth.securityEyebrow")}</p>
        <h1>{t("auth.resetTitle")}</h1>
        <p className="lead">{t("auth.resetLead")}</p>
        <div className="callout">
          <LockIcon className="inline-icon" />
          <p>{t("auth.resetLinkNote")}</p>
        </div>
      </section>
      <section className="auth-form">
        <ResetPasswordForm token={tokenValue} />
        <p className="form-note" style={{ textAlign: "center" }}>
          {t("auth.remembered")} <Link href={href("/login")}>{t("auth.backToSignIn")}</Link>.
        </p>
      </section>
    </div>
  );
}
