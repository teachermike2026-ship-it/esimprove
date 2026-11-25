import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/lib/guides";
import { ArrowRight, ClockIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

const GUIDE_TITLE_KEYS: Record<string, string> = {
  "before-you-travel": "guides.beforeYouTravel",
  "install-ios": "guides.installIos",
  "install-android": "guides.installAndroid",
  troubleshooting: "guides.troubleshooting",
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/guides",
    title: t("guides.metaTitle"),
    description: t("guides.metaDescription"),
  });
}

export default async function GuidesPage() {
  const { t, href } = await getI18n();
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("guides.eyebrow")}</p>
          <h1>{t("guides.title")}</h1>
          <p className="lead">{t("guides.lead")}</p>
          <p className="muted small">{t("guides.contentNotice")}</p>
        </div>
      </div>
      <div className="grid grid-2">
        {guides.map((guide) => {
          const minutes = /(\d+)/.exec(guide.readingTime)?.[1];
          const titleKey = GUIDE_TITLE_KEYS[guide.slug];
          return (
            <article key={guide.slug} className="card form">
              <p className="eyebrow">
                <ClockIcon className="inline-icon" />{" "}
                {minutes ? t("guides.readingTime", { minutes }) : guide.readingTime}
              </p>
              <h2>
                <Link href={href(`/guides/${guide.slug}`)}>
                  {titleKey ? t(titleKey) : guide.title}
                </Link>
              </h2>
              <p className="muted">{guide.summary}</p>
              <Link
                className="button button-ghost button-small"
                href={href(`/guides/${guide.slug}`)}
              >
                {t("guides.readGuide")} <ArrowRight className="inline-icon" />
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}
