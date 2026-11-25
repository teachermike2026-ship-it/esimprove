import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuide } from "@/lib/guides";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

const GUIDE_TITLE_KEYS: Record<string, string> = {
  "before-you-travel": "guides.beforeYouTravel",
  "install-ios": "guides.installIos",
  "install-android": "guides.installAndroid",
  troubleshooting: "guides.troubleshooting",
};

function titleFor(slug: string, fallback: string, t: (key: string) => string): string {
  const key = GUIDE_TITLE_KEYS[slug];
  return key ? t(key) : fallback;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { t } = await getI18n();
  const guide = getGuide(slug);
  if (!guide) notFound();
  return localizedMetadata({
    path: `/guides/${guide.slug}`,
    title: titleFor(guide.slug, guide.title, t),
    description: guide.summary,
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, href } = await getI18n();
  const guide = getGuide(slug);
  if (!guide) notFound();
  const minutes = /(\d+)/.exec(guide.readingTime)?.[1];

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href={href("/guides")}>{t("guides.breadcrumb")}</Link>
          </li>
          <li aria-current="page">{titleFor(guide.slug, guide.title, t)}</li>
        </ol>
      </nav>
      <div className="split">
        <article className="card form prose">
          <p className="eyebrow">
            {minutes ? t("guides.readingTime", { minutes }) : guide.readingTime}
          </p>
          <h1>{titleFor(guide.slug, guide.title, t)}</h1>
          <p className="lead">{guide.summary}</p>
          <p className="muted small">{t("guides.contentNotice")}</p>
          {guide.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>
        <aside className="checkout-sidebar">
          <div className="card form">
            <h2>{t("guides.goodToKnow")}</h2>
            <p className="muted small">
              {t("guides.goodToKnowBody", { email: LEGAL_CONTACT_EMAIL })}
            </p>
            <Link className="button button-secondary" href={href("/compatibility")}>
              {t("guides.checkCompatibility")}
            </Link>
          </div>
          <div className="card form">
            <h2>{t("guides.moreGuides")}</h2>
            <ul className="check-list">
              <li>
                <Link href={href("/guides/before-you-travel")}>
                  {t("guides.beforeYouTravel")}
                </Link>
              </li>
              <li>
                <Link href={href("/guides/install-ios")}>{t("guides.installIos")}</Link>
              </li>
              <li>
                <Link href={href("/guides/install-android")}>{t("guides.installAndroid")}</Link>
              </li>
              <li>
                <Link href={href("/guides/troubleshooting")}>{t("guides.troubleshooting")}</Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
