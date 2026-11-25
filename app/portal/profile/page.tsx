import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getOrCreateUserPreferences } from "@/lib/user-preferences";
import { formatDate } from "@/lib/money";
import { ProfileForm, RequestVerificationButton } from "@/components/profile-forms";
import { ChangePasswordForm } from "@/components/auth-forms";
import {
  AlertIcon,
  CheckIcon,
  HeadsetIcon,
  LockIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/portal/profile",
    title: t("profile.metaTitle"),
    robots: { index: false, follow: false },
  });
}

export default async function PortalProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; verification?: string }>;
}) {
  const { t, href } = await getI18n();
  const user = await requireUser("/portal/profile");
  const { verified, verification } = await searchParams;
  const db = await getDb();
  const preferences = await getOrCreateUserPreferences(db, user.id);
  const isVerified = Boolean(user.emailVerifiedAt);

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href={href("/portal")}>{t("profile.breadcrumbPortal")}</Link>
          </li>
          <li aria-current="page">{t("profile.breadcrumbProfile")}</li>
        </ol>
      </nav>

      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("profile.eyebrow")}</p>
          <h1>{t("profile.title")}</h1>
          <p className="muted">{t("profile.lead")}</p>
        </div>
        <span className={isVerified ? "badge" : "badge badge-warning"}>
          {isVerified ? t("profile.emailVerified") : t("profile.emailNotVerified")}
        </span>
      </div>

      {verification === "sent" ? (
        <div className="callout callout-success section-tight" role="status">
          <CheckIcon className="inline-icon" />
          <p>{t("profile.accountCreated")}</p>
        </div>
      ) : null}
      {verified === "1" ? (
        <div className="callout callout-success section-tight" role="status">
          <CheckIcon className="inline-icon" />
          <p>{t("profile.emailVerifiedMsg")}</p>
        </div>
      ) : null}
      {verified === "invalid" ? (
        <div className="form-error section-tight" role="alert">
          <AlertIcon className="inline-icon" />
          <p>{t("profile.invalidVerification")}</p>
        </div>
      ) : null}

      <div className="split">
        <section className="stack" aria-labelledby="profile-settings">
          <h2 id="profile-settings">{t("profile.settings")}</h2>
          <ProfileForm
            name={user.name}
            locale={preferences.locale}
            marketingOptIn={preferences.marketingOptIn}
            productUpdatesOptIn={preferences.productUpdatesOptIn}
            orderUpdatesOptIn={preferences.orderUpdatesOptIn}
          />
          <ChangePasswordForm />
        </section>

        <aside className="checkout-sidebar">
          <section className="card form">
            <h2>
              <UserIcon className="inline-icon" /> {t("profile.accountDetails")}
            </h2>
            <dl className="meta-list">
              <div>
                <dt>{t("portal.name")}</dt>
                <dd>{user.name}</dd>
              </div>
              <div>
                <dt>{t("portal.email")}</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>{t("profile.role")}</dt>
                <dd>{user.role}</dd>
              </div>
              <div>
                <dt>{t("profile.verified")}</dt>
                <dd>
                  {user.emailVerifiedAt
                    ? formatDate(user.emailVerifiedAt)
                    : t("portal.notVerified")}
                </dd>
              </div>
            </dl>
            <p className="form-note">
              {t("profile.changeEmailNote")}{" "}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
            </p>
          </section>

          <section className="card form">
            <h2>
              <ShieldIcon className="inline-icon" /> {t("profile.emailVerification")}
            </h2>
            <RequestVerificationButton verified={isVerified} email={user.email} />
          </section>

          <section className="card form">
            <h2>
              <HeadsetIcon className="inline-icon" /> {t("profile.helpPrivacy")}
            </h2>
            <div className="stack-sm">
              <Link className="button button-secondary" href={href("/portal/support")}>
                {t("profile.support")}
              </Link>
              <Link className="button button-ghost" href={href("/portal")}>
                {t("profile.ordersEsims")}
              </Link>
              <Link className="button button-ghost" href={href("/legal/privacy")}>
                {t("profile.privacyPolicyLink")}
              </Link>
              <Link className="button button-ghost" href={href("/legal/terms")}>
                {t("profile.terms")}
              </Link>
            </div>
          </section>

          <section className="card form">
            <h2>
              <LockIcon className="inline-icon" /> {t("profile.sessionSecurity")}
            </h2>
            <p className="muted small">{t("profile.sessionSecurityBody")}</p>
          </section>
        </aside>
      </div>
    </>
  );
}
