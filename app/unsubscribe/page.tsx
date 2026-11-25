import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { findSubscriptionByUnsubscribeToken } from "@/lib/email-subscriptions";
import { unsubscribeAction } from "./actions";
import { AlertIcon, CheckIcon, LockIcon, MailIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { localeIntl } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const meta = await localizedMetadata({
    path: "/unsubscribe",
    title: t("unsubscribe.metaTitle"),
    description: t("unsubscribe.lead"),
    robots: { index: false, follow: false, nocache: true },
  });
  return { ...meta, referrer: "no-referrer" };
}

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string; error?: string }>;
}) {
  const { t, href, locale } = await getI18n();
  const flags = await searchParams;
  const token = typeof flags.token === "string" ? flags.token.trim() : "";
  const db = token ? await getDb() : null;
  const subscription =
    db && token && token.length <= 200
      ? await findSubscriptionByUnsubscribeToken(db, token)
      : null;
  const done = flags.done === "1";
  const invalid = !token || flags.error === "missing" || flags.error === "invalid" || !subscription;
  const alreadyUnsubscribed = subscription?.status === "unsubscribed";
  const maskEmail = (email: string) => {
    const [local, domain] = email.split("@");
    if (!local || !domain) return t("unsubscribe.maskedFallback");
    return `${local.slice(0, 1)}${"*".repeat(Math.min(Math.max(local.length - 1, 3), 8))}@${domain}`;
  };

  return (
    <div className="legal-page">
      <header className="legal-header">
        <p className="eyebrow">{t("unsubscribe.pageEyebrow")}</p>
        <h1>{t("unsubscribe.heading")}</h1>
        <p className="lead">{t("unsubscribe.pageLead")}</p>
      </header>

      {done ? (
        <div className="callout callout-success" role="status">
          <CheckIcon className="inline-icon" />
          <div>
            <p>
              <strong>{t("unsubscribe.doneTitle")}</strong> {t("unsubscribe.doneBody")}
            </p>
            <p className="small">{t("unsubscribe.doneNote")}</p>
          </div>
        </div>
      ) : invalid ? (
        <div className="callout callout-warning" role="alert">
          <AlertIcon className="inline-icon" />
          <div>
            <p>
              <strong>{t("unsubscribe.invalidTitle")}</strong> {t("unsubscribe.invalidBody")}
            </p>
            <p className="small">{t("unsubscribe.invalidHelp")}</p>
          </div>
        </div>
      ) : alreadyUnsubscribed ? (
        <div className="callout" role="status">
          <CheckIcon className="inline-icon" />
          <div>
            <p>
              <strong>{t("unsubscribe.alreadyTitle")}</strong> {t("unsubscribe.alreadyBody")}
            </p>
            {subscription.unsubscribedAt ? (
              <p className="small">
                {t("unsubscribe.recordedOn", {
                  date: new Intl.DateTimeFormat(localeIntl(locale), {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  }).format(subscription.unsubscribedAt),
                })}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <section className="card form" aria-labelledby="unsubscribe-confirm-title">
          <h2 id="unsubscribe-confirm-title">{t("unsubscribe.confirmTitle")}</h2>
          <p>
            <MailIcon className="inline-icon" />{" "}
            {t("unsubscribe.address", { email: maskEmail(subscription.email) })}
          </p>
          <p>
            {t("unsubscribe.confirmBody")}{" "}
            <Link href={href("/legal/privacy")}>{t("profile.privacyPolicyLink")}</Link>
          </p>
          <form action={unsubscribeAction}>
            <input type="hidden" name="token" value={token} />
            <button className="button button-danger" type="submit">
              <LockIcon className="inline-icon" />
              {t("unsubscribe.confirmButton")}
            </button>
          </form>
          <p className="form-note">{t("unsubscribe.openNote")}</p>
        </section>
      )}

      <section className="card form section-tight" aria-labelledby="unsubscribe-about-title">
        <h2 id="unsubscribe-about-title">{t("unsubscribe.aboutTitle")}</h2>
        <ul className="simple-list">
          <li>{t("unsubscribe.aboutMarketing")}</li>
          <li>{t("unsubscribe.aboutTransactional")}</li>
          <li>{t("unsubscribe.aboutPrivacy")}</li>
        </ul>
        <p className="small muted">{t("unsubscribe.tokenNote")}</p>
      </section>
    </div>
  );
}
