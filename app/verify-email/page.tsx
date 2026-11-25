import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmailAction } from "@/lib/auth/actions";
import { AlertIcon, CheckIcon, MailIcon } from "@/components/icons";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const meta = await localizedMetadata({
    path: "/verify-email",
    title: t("auth.metaVerify"),
    robots: { index: false, follow: false },
  });
  return { ...meta, referrer: "no-referrer" };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;
  const { t, href } = await getI18n();
  const tokenValue = token ?? "";

  return (
    <div className="auth-layout auth-layout-narrow">
      <section className="auth-copy">
        <p className="eyebrow">{t("auth.securityEyebrow")}</p>
        <h1>{t("auth.verifyHeading")}</h1>
        <p className="lead">{t("auth.verifyLead")}</p>
        <div className="callout">
          <MailIcon className="inline-icon" />
          <p>{t("auth.verifyMailNote", { email: LEGAL_CONTACT_EMAIL })}</p>
        </div>
      </section>
      <section className="auth-form">
        {status === "invalid" ? (
          <div className="form-error" role="alert">
            <AlertIcon className="inline-icon" />
            <p>{t("auth.verifyInvalid")}</p>
          </div>
        ) : null}

        {tokenValue ? (
          <form action={verifyEmailAction} className="form card">
            <h2>{t("auth.verifyConfirmTitle")}</h2>
            <p className="muted small">{t("auth.verifyConfirmBody")}</p>
            <input type="hidden" name="token" value={tokenValue} />
            <button className="button" type="submit">
              <CheckIcon className="inline-icon" />
              {t("auth.verifyButton")}
            </button>
          </form>
        ) : (
          <div className="card form">
            <h2>{t("auth.verifyLinkTitle")}</h2>
            <p className="muted">{t("auth.verifyLinkBody", { email: LEGAL_CONTACT_EMAIL })}</p>
          </div>
        )}

        <p className="form-note" style={{ textAlign: "center" }}>
          <Link href={href("/login")}>{t("auth.backToSignIn")}</Link>.{" "}
          <Link href={href("/portal/profile")}>{t("nav.profile")}</Link>.
        </p>
      </section>
    </div>
  );
}
