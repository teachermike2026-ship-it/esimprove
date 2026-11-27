import Link from "next/link";
import type { ReactNode } from "react";
import type { Database } from "@/lib/db/client";
import { getDestinationBySlug, getDestinations, getPlansForDestination } from "@/lib/catalog";
import { destinationFacts, type PlanPick } from "@/lib/destination-facts";
import { formatData, formatMoney } from "@/lib/money";
import { headingId, type ArticleBlock, type EditorialArticle } from "@/lib/editorial";

type T = (key: string, vars?: Record<string, string | number>) => string;
type Href = (path: string) => string;

/** Analytics name for a click on an internal link inside an article. */
function trackFor(path: string): string | undefined {
  if (path.startsWith("/destinations/") || path.startsWith("/regions/")) return "blog_destination_clicked";
  if (path.startsWith("/plans/")) return "blog_plan_clicked";
  if (path.startsWith("/blog/")) return "related_article_clicked";
  return undefined;
}

/** `[label](href)`, `**bold**` and `` `code` `` inside article text. */
export function renderArticleInline(text: string, href: Href): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    if (match[1] && match[2]) {
      const target = match[2];
      if (target.startsWith("/")) {
        out.push(
          <Link key={key++} href={href(target)} data-track={trackFor(target)}>
            {match[1]}
          </Link>,
        );
      } else {
        out.push(
          <a key={key++} href={target} target="_blank" rel="noopener noreferrer">
            {match[1]}
          </a>,
        );
      }
    } else if (match[3]) {
      out.push(<strong key={key++}>{match[3]}</strong>);
    } else if (match[4]) {
      out.push(
        <code key={key++} dir="ltr">
          {match[4]}
        </code>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function PickRow({ label, pick, href }: { label: string; pick: PlanPick | null; href: Href }) {
  if (!pick) return null;
  return (
    <li>
      <span className="blog-live-pick-label">{label}</span>
      <Link href={href(`/plans/${pick.slug}`)} data-track="blog_plan_clicked">
        {formatData(pick.dataMb)} · {pick.validityDays} {pick.validityDays === 1 ? "day" : "days"}
      </Link>
      <strong dir="ltr">{formatMoney(pick.priceMinor, "USD")}</strong>
    </li>
  );
}

async function CatalogBox({ db, slug, t, href }: { db: Database; slug: string; t: T; href: Href }) {
  const row = await getDestinationBySlug(db, slug);
  if (!row) return null;
  const facts = destinationFacts(await getPlansForDestination(db, row.destination.id));
  if (!facts) return null;
  const country = row.destination.name;
  return (
    <aside className="blog-live" aria-label={t("blog.catalogTitle", { country })}>
      <p className="blog-live-badge">{t("blog.catalogLive")}</p>
      <h3 className="blog-live-title">{t("blog.catalogTitle", { country })}</h3>
      <dl className="blog-live-facts">
        <div>
          <dt>{t("blog.catalogPlans")}</dt>
          <dd>{facts.planCount}</dd>
        </div>
        <div>
          <dt>{t("blog.catalogPrice")}</dt>
          <dd dir="ltr">
            {formatMoney(facts.fromPriceMinor, facts.currency)}–{formatMoney(facts.toPriceMinor, facts.currency)}
          </dd>
        </div>
        <div>
          <dt>{t("blog.catalogData")}</dt>
          <dd dir="ltr">
            {formatData(facts.minDataMb)}–{formatData(facts.maxDataMb)}
          </dd>
        </div>
        <div>
          <dt>{t("blog.catalogValidity")}</dt>
          <dd>{t("blog.catalogDays", { min: facts.minValidityDays, max: facts.maxValidityDays })}</dd>
        </div>
        {facts.networks.length ? (
          <div className="blog-live-wide">
            <dt>{t("blog.catalogNetworks")}</dt>
            <dd>
              {facts.networks.join(", ")}
              {facts.has5G ? <span className="blog-live-note"> · {t("blog.catalog5g")}</span> : null}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="blog-live-subtitle">{t("blog.catalogPicks")}</p>
      <ul className="blog-live-picks">
        <PickRow label={t("blog.catalogPickCheapest")} pick={facts.cheapest} href={href} />
        <PickRow label={t("blog.catalogPickWeek")} pick={facts.forAWeek} href={href} />
        <PickRow label={t("blog.catalogPickMonth")} pick={facts.forAMonth} href={href} />
        <PickRow label={t("blog.catalogPickValue")} pick={facts.bestValuePerGb} href={href} />
      </ul>
      <Link className="es-button es-button-primary blog-live-cta" href={href(`/destinations/${slug}`)} data-track="blog_destination_clicked">
        {t("blog.catalogCta", { country })}
      </Link>
    </aside>
  );
}

async function CatalogGroup({
  db,
  title,
  match,
  limit = 8,
  t,
  href,
}: {
  db: Database;
  title: string;
  match: string;
  limit?: number;
  t: T;
  href: Href;
}) {
  let pattern: RegExp;
  try {
    pattern = new RegExp(match, "i");
  } catch {
    return null;
  }
  const destinations = (await getDestinations(db))
    .filter((destination) => pattern.test(destination.name) && destination.planCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
  if (destinations.length === 0) return null;
  return (
    <aside className="blog-live" aria-label={title}>
      <p className="blog-live-badge">{t("blog.catalogLive")}</p>
      <h3 className="blog-live-title">{title}</h3>
      <ul className="blog-live-list">
        {destinations.map((destination) => (
          <li key={destination.slug}>
            <Link href={href(`/destinations/${destination.slug}`)} data-track="blog_destination_clicked">
              {destination.name}
            </Link>
            <span className="blog-live-note">
              {t("blog.catalogPlansCount", { count: destination.planCount })}
              {destination.fromPriceMinor !== null
                ? ` · ${t("blog.catalogFrom", { price: formatMoney(destination.fromPriceMinor, "USD") })}`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="blog-live-note">{t("blog.catalogGroupNote")}</p>
    </aside>
  );
}

function Block({ block, db, t, href }: { block: ArticleBlock; db: Database; t: T; href: Href }) {
  const inline = (text: string) => renderArticleInline(text, href);
  if (typeof block === "string") return <p>{inline(block)}</p>;
  if ("h2" in block) return <h2 id={block.id ?? headingId(block.h2)}>{inline(block.h2)}</h2>;
  if ("h3" in block) return <h3>{inline(block.h3)}</h3>;
  if ("ul" in block) {
    return (
      <ul>
        {block.ul.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </ul>
    );
  }
  if ("ol" in block) {
    return (
      <ol>
        {block.ol.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </ol>
    );
  }
  // Article bodies are English (lang="en"), so these labels are English too.
  if ("tip" in block) {
    return (
      <p className="blog-callout blog-callout-tip">
        <strong>Tip: </strong>
        {inline(block.tip)}
      </p>
    );
  }
  if ("note" in block) {
    return (
      <p className="blog-callout blog-callout-note">
        <strong>Good to know: </strong>
        {inline(block.note)}
      </p>
    );
  }
  if ("table" in block) {
    return (
      <div className="blog-table-scroll" tabIndex={0} role="region" aria-label={block.table.caption}>
        <table className="blog-table">
          <caption>{block.table.caption}</caption>
          <thead>
            <tr>
              {block.table.head.map((cell, index) => (
                <th key={index} scope="col">
                  {inline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, index) =>
                  index === 0 ? (
                    <th key={index} scope="row">
                      {inline(cell)}
                    </th>
                  ) : (
                    <td key={index}>{inline(cell)}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if ("catalog" in block) return <CatalogBox db={db} slug={block.catalog} t={t} href={href} />;
  if ("catalogGroup" in block) {
    return <CatalogGroup db={db} {...block.catalogGroup} t={t} href={href} />;
  }
  if ("cta" in block) {
    return (
      <aside className="blog-cta">
        <h2 className="blog-cta-title">{block.cta.title}</h2>
        <p>{block.cta.body}</p>
        <Link className="es-button es-button-primary" href={href(block.cta.href)} data-track="cta_clicked">
          {block.cta.label}
        </Link>
      </aside>
    );
  }
  return null;
}

export function EditorialBody({
  article,
  db,
  t,
  href,
}: {
  article: EditorialArticle;
  db: Database;
  t: T;
  href: Href;
}) {
  return (
    <>
      {article.body.map((block, index) => (
        <Block key={index} block={block} db={db} t={t} href={href} />
      ))}
    </>
  );
}
