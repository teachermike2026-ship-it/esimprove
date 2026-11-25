import type { Metadata } from "next";
import Link from "next/link";
import { CompatibilityChecker } from "@/components/compatibility-checker";
import { ArrowRight, QrIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/compatibility",
    title: t("compatibility.metaTitle"),
    description: t("compatibility.metaDescription"),
  });
}

export default async function CompatibilityPage() {
  const { t, href } = await getI18n();
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("compatibility.eyebrow")}</p>
          <h1>{t("compatibility.title")}</h1>
          <p className="lead">{t("compatibility.lead")}</p>
        </div>
      </div>
      <CompatibilityChecker />
      <section className="section" aria-labelledby="compat-more">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("compatibility.nextEyebrow")}</p>
            <h2 id="compat-more">{t("compatibility.nextTitle")}</h2>
          </div>
        </div>
        <div className="grid grid-3">
          <article className="card form">
            <h3>
              <QrIcon className="inline-icon" /> {t("compatibility.settingsTitle")}
            </h3>
            <p className="muted small">{t("compatibility.settingsBody")}</p>
          </article>
          <article className="card form">
            <h3>{t("compatibility.unlockedTitle")}</h3>
            <p className="muted small">{t("compatibility.unlockedBody")}</p>
          </article>
          <article className="card form">
            <h3>{t("compatibility.guideTitle")}</h3>
            <p className="muted small">{t("compatibility.guideBody")}</p>
            <Link className="button button-ghost button-small" href={href("/guides")}>
              {t("compatibility.guidesLink")} <ArrowRight className="inline-icon" />
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}
