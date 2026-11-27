import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth-forms";
import { safeNextPath } from "@/lib/validation";
import { isAdminRole } from "@/lib/auth/roles";
import { AlertIcon, CheckIcon, LockIcon } from "@/components/icons";
import { OAuthButtons, OAuthLegalNote, oauthOffered } from "@/components/oauth-buttons";
import type { TranslationKey } from "@/lib/i18n/dictionaries/en";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/login",
    title: t("auth.metaLogin"),
    robots: { index: false, follow: false },
  });
}

const OAUTH_ERROR_KEYS: Record<string, TranslationKey> = {
  unavailable: "oauth.error.unavailable",
  cancelled: "oauth.error.cancelled",
  expired: "oauth.error.expired",
  email_unverified: "oauth.error.emailUnverified",
  admin: "oauth.error.admin",
  conflict: "oauth.error.conflict",
  rate_limited: "oauth.error.rateLimited",
  failed: "oauth.error.failed",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string; oauth_error?: string }>;
}) {
  const { next, verified, oauth_error: oauthError } = await searchParams;
  const { t, href } = await getI18n();
  const user = await getCurrentUser();
  if (user) redirect(safeNextPath(next, isAdminRole(user.role) ? "/admin" : "/portal"));
  const nextPath = safeNextPath(next, "/portal");

  return (
    <div className="auth-layout">
      <section className="auth-copy">
        <p className="eyebrow">{t("auth.customerAccount")}</p>
        <h1>{t("auth.loginTitle")}</h1>
        <p className="lead">{t("auth.loginLead")}</p>
        <ul className="check-list">
          <li>
            <LockIcon className="inline-icon" /> {t("auth.passwordHash")}
          </li>
          <li>
            <LockIcon className="inline-icon" /> {t("auth.sessions")}
          </li>
          <li>
            <LockIcon className="inline-icon" /> {t("auth.adminTotp")}
          </li>
        </ul>
      </section>
      <section className="auth-form">
        {verified === "1" ? (
          <div className="callout callout-success" role="status">
            <CheckIcon className="inline-icon" />
            <p>{t("auth.emailVerifiedNotice")}</p>
          </div>
        ) : null}
        {oauthError ? (
          <div className="form-error" role="alert">
            <AlertIcon className="inline-icon" />
            <span>{t(OAUTH_ERROR_KEYS[oauthError] ?? "oauth.error.failed")}</span>
          </div>
        ) : null}
        {oauthOffered() ? (
          <>
            <OAuthButtons next={nextPath} />
            <OAuthLegalNote />
            <p className="oauth-divider">
              <span>{t("oauth.orEmail")}</span>
            </p>
          </>
        ) : null}
        <LoginForm next={nextPath} />
        <p className="form-note" style={{ textAlign: "center" }}>
          {t("auth.noAccount")}{" "}
          <Link href={`${href("/register")}?next=${encodeURIComponent(nextPath)}`}>
            {t("auth.createCustomerAccount")}
          </Link>
          .{" "}
          <Link href={href("/login/forgot")}>{t("auth.forgotPassword")}</Link>
        </p>
      </section>
    </div>
  );
}
