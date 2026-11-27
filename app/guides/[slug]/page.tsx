import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getGuide, guides } from "@/lib/guides";
import { EditorialGuideCard } from "@/components/blog/editorial-guide-card";
import { editorialForGuide } from "@/lib/editorial";
import { siteUrl } from "@/lib/config";
import { absoluteLocalizedUrl } from "@/lib/i18n/config";
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
  const { t, href, locale } = await getI18n();
  const guide = getGuide(slug);
  if (!guide) notFound();
  const fuller = editorialForGuide(guide.slug);
  const minutes = /(\d+)/.exec(guide.readingTime)?.[1];
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const title = titleFor(guide.slug, guide.title, t);
  const url = absoluteLocalizedUrl(`/guides/${guide.slug}`, locale, siteUrl);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: title,
        description: guide.summary,
        url,
        mainEntityOfPage: url,
        inLanguage: "en",
        publisher: { "@type": "Organization", name: "ESIMPROVE" },
        articleSection: "Travel eSIM guides",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("guides.breadcrumb"), item: absoluteLocalizedUrl("/guides", locale, siteUrl) },
          { "@type": "ListItem", position: 2, name: title, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
          {fuller ? (
            <EditorialGuideCard
              article={fuller}
              href={href}
              eyebrow={t("blog.guideEyebrow")}
              intro={t("guides.fullArticle")}
              linkLabel={t("blog.readGuide")}
            />
          ) : null}
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
              {guides
                .filter((item) => item.slug !== guide.slug)
                .map((item) => (
                  <li key={item.slug}>
                    <Link href={href(`/guides/${item.slug}`)}>{titleFor(item.slug, item.title, t)}</Link>
                  </li>
                ))}
            </ul>
          </div>
          <div className="card form">
            <Link className="button" href={href("/destinations")}>
              {t("common.browsePlans")}
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
