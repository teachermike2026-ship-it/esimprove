import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuide } from "@/lib/guides";
import { canonicalUrl } from "@/lib/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Guide not found" };
  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical: canonicalUrl(`/guides/${guide.slug}`) },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href="/guides">Guides</Link>
          </li>
          <li aria-current="page">{guide.title}</li>
        </ol>
      </nav>
      <div className="split">
        <article className="card form prose">
          <p className="eyebrow">{guide.readingTime}</p>
          <h1>{guide.title}</h1>
          <p className="lead">{guide.summary}</p>
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
            <h2>Demo boundary</h2>
            <p className="muted small">
              These guides are general information, not a guarantee that a specific device,
              carrier, or plan will work. No live supplier support is available in this build.
            </p>
            <Link className="button button-secondary" href="/compatibility">
              Check compatibility
            </Link>
          </div>
          <div className="card form">
            <h2>More guides</h2>
            <ul className="check-list">
              <li>
                <Link href="/guides/before-you-travel">Before you travel</Link>
              </li>
              <li>
                <Link href="/guides/install-ios">Install on iPhone</Link>
              </li>
              <li>
                <Link href="/guides/install-android">Install on Android</Link>
              </li>
              <li>
                <Link href="/guides/troubleshooting">Troubleshooting</Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
