import Link from "next/link";
import { ArticleArt } from "@/components/blog/article-art";
import type { BlogCard } from "@/lib/blog-public";

export interface BlogCardLabels {
  minRead: (minutes: number) => string;
  formatDate: (date: Date) => string;
}

function Thumb({ card, eager }: { card: BlogCard; eager?: boolean }) {
  if (card.art) {
    // Decorative here: the card's heading already names the article.
    return <ArticleArt theme={card.art.theme} alt={card.art.alt} className="blog-thumb" decorative />;
  }
  if (card.image) {
    // CMS images are arbitrary admin-provided URLs (no next/image remote allow-list).
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={card.image.src}
        alt=""
        className="blog-thumb"
        width={640}
        height={360}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }
  return <div className="blog-thumb blog-card-placeholder" aria-hidden="true" />;
}

export function BlogCardView({
  card,
  href,
  labels,
  headingLevel = 3,
  variant = "card",
  eager,
  track,
}: {
  card: BlogCard;
  /** Analytics event name sent when the article link is clicked. */
  track?: string;
  href: (path: string) => string;
  labels: BlogCardLabels;
  headingLevel?: 2 | 3;
  variant?: "card" | "featured";
  eager?: boolean;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const url = href(`/blog/${card.slug}`);
  return (
    <article className={variant === "featured" ? "blog-tile blog-tile-featured" : "blog-tile"}>
      <Link href={url} className="blog-tile-media" tabIndex={-1} aria-hidden="true" data-track={track}>
        <Thumb card={card} eager={eager} />
      </Link>
      <div className="blog-tile-body">
        {card.categoryName ? <p className="blog-tile-category">{card.categoryName}</p> : null}
        <Heading className="blog-tile-title">
          <Link href={url} data-track={track}>
            {card.title}
          </Link>
        </Heading>
        <p className="blog-tile-excerpt">{card.excerpt}</p>
        <p className="blog-tile-meta">
          <time dateTime={card.publishedAt.toISOString()}>{labels.formatDate(card.publishedAt)}</time>
          <span aria-hidden="true"> · </span>
          <span>{labels.minRead(card.readingMinutes)}</span>
        </p>
      </div>
    </article>
  );
}
