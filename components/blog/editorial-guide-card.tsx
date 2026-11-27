import Link from "next/link";
import type { EditorialArticle } from "@/lib/editorial";

/**
 * Links a shop or help page to its in-depth editorial article, so destination,
 * region and guide pages pass readers (and link equity) to the blog and back.
 * Article text is English-only, hence `lang="en"` on the title and excerpt.
 */
export function EditorialGuideCard({
  article,
  href,
  eyebrow,
  linkLabel,
  intro,
}: {
  article: EditorialArticle;
  href: (path: string) => string;
  eyebrow: string;
  linkLabel: string;
  intro?: string;
}) {
  return (
    <aside className="editorial-guide-card" aria-label={eyebrow}>
      <p className="eyebrow">{eyebrow}</p>
      {intro ? <p className="muted small">{intro}</p> : null}
      <p lang="en" dir="ltr">
        <Link href={href(`/blog/${article.slug}`)} data-track="blog_guide_link_clicked">
          {article.title}
        </Link>
      </p>
      <p className="muted small" lang="en" dir="ltr">
        {article.excerpt}
      </p>
      <p>
        <Link href={href(`/blog/${article.slug}`)} data-track="blog_guide_link_clicked" tabIndex={-1} aria-hidden="true">
          {linkLabel}
        </Link>
      </p>
    </aside>
  );
}
