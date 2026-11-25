import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { demoMode, mockCommerceAllowed } from "@/lib/config";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";
import { LockIcon, MailIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/login/forgot",
    title: t("auth.metaForgot"),
    robots: { index: false, follow: false },
  });
}

export default async function ForgotPasswordPage() {
  const { t, href } = await getI18n();
  return (
    <div className="auth-layout auth-layout-narrow">
      <section className="auth-copy">
        <p className="eyebrow">{t("auth.securityEyebrow")}</p>
        <h1>{t("auth.forgotTitle")}</h1>
        <p className="lead">{t("auth.forgotLead")}</p>
        <ul className="check-list">
          <li>
            <MailIcon className="inline-icon" /> {t("auth.forgotBullet")}
          </li>
          <li>
            <LockIcon className="inline-icon" /> {t("auth.resetHelp")}
          </li>
        </ul>
        {!mockCommerceAllowed ? (
          <div className="callout callout-warning">
            <p>{t("auth.forgotUnavailable", { email: LEGAL_CONTACT_EMAIL })}</p>
          </div>
        ) : demoMode ? (
          <div className="callout">
            <p>{t("auth.forgotDemo", { email: LEGAL_CONTACT_EMAIL })}</p>
          </div>
        ) : null}
      </section>
      <section className="auth-form">
        <ForgotPasswordForm />
        <p className="form-note" style={{ textAlign: "center" }}>
          {t("auth.remembered")} <Link href={href("/login")}>{t("auth.backToSignIn")}</Link>.
        </p>
      </section>
    </div>
  );
}
