import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import {
  PrivacyRequestForm,
  PrivacyRequestLookupForm,
} from "@/components/privacy-request-form";
import {
  BusinessDetails,
  PrivacyContact,
  SupportChannelNotice,
} from "@/components/legal-document";
import { ClockIcon, LockIcon } from "@/components/icons";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/privacy/request",
    title: t("privacyRequest.metaTitle"),
    description: t("privacyRequest.lead"),
  });
}

export const dynamic = "force-dynamic";

function splitAround(text: string, marker: string, node: ReactNode): ReactNode {
  const index = text.indexOf(marker);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      {node}
      {text.slice(index + marker.length)}
    </>
  );
}

export default async function PrivacyRequestPage() {
  const { t, href } = await getI18n();
  const user = await getCurrentUser();
  const privacyLabel = t("privacyRequest.privacyLink");
  const rightsText = t("privacyRequest.rightsBody2", {
    privacyLink: privacyLabel,
    email: LEGAL_CONTACT_EMAIL,
  });
  const noEmailText = t("privacyRequest.noEmailNote", { email: LEGAL_CONTACT_EMAIL });
  const privacyNode = <Link href={href("/legal/privacy")}>{privacyLabel}</Link>;
  const emailNode = <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;

  return (
    <div className="legal-page">
      <header className="legal-header">
        <p className="eyebrow">{t("privacyRequest.eyebrow")}</p>
        <h1>{t("privacyRequest.heading")}</h1>
        <p className="lead">{t("privacyRequest.pageLead")}</p>
      </header>

      <div className="privacy-request-grid">
        <section aria-labelledby="privacy-request-form-title">
          <h2 id="privacy-request-form-title">{t("privacyRequest.submitTitle")}</h2>
          <PrivacyRequestForm defaultEmail={user?.email ?? ""} />
        </section>

        <aside className="privacy-request-aside">
          <section className="card form" aria-labelledby="privacy-request-process-title">
            <h2 id="privacy-request-process-title">
              <ClockIcon className="inline-icon" /> {t("privacyRequest.whatNext")}
            </h2>
            <ol className="simple-list">
              <li>{t("privacyRequest.step1")}</li>
              <li>{t("privacyRequest.step2")}</li>
              <li>{t("privacyRequest.step3")}</li>
              <li>{t("privacyRequest.step4")}</li>
            </ol>
            <p className="small muted">
              {splitAround(noEmailText, LEGAL_CONTACT_EMAIL, emailNode)}
            </p>
          </section>

          <section className="card form" aria-labelledby="privacy-request-rights-title">
            <h2 id="privacy-request-rights-title">
              <LockIcon className="inline-icon" /> {t("privacyRequest.rightsTitle")}
            </h2>
            <p>{t("privacyRequest.rightsBody1")}</p>
            <p>{splitAround(rightsText, privacyLabel, privacyNode)}</p>
          </section>

          <section className="card form" aria-labelledby="privacy-request-auth-title">
            <h2 id="privacy-request-auth-title">{t("privacyRequest.signedInTitle")}</h2>
            <p>{t("privacyRequest.signedInBody1")}</p>
            <p>{t("privacyRequest.signedInBody2")}</p>
          </section>

          <section className="card form" aria-labelledby="privacy-request-format-title">
            <h2 id="privacy-request-format-title">{t("privacyRequest.notIncludeTitle")}</h2>
            <p>{t("privacyRequest.notIncludeBody")}</p>
          </section>
        </aside>
      </div>

      <section className="section-tight" aria-labelledby="privacy-lookup-title">
        <h2 id="privacy-lookup-title">{t("privacyRequest.lookupTitle")}</h2>
        <PrivacyRequestLookupForm />
      </section>

      <BusinessDetails />
      <PrivacyContact />
      <SupportChannelNotice />
    </div>
  );
}
