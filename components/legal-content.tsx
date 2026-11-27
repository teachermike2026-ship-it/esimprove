import Link from "next/link";
import type { ReactNode } from "react";
import type { LegalBlock, LegalDoc, LegalProfileText } from "@/lib/legal-content/types";

/** Renders `[label](href)`, `**bold**` and `{email}` inside legal text. */
export function renderInline(text: string, email: string, href: (path: string) => string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\{email\}/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    if (match[1] && match[2]) {
      const target = match[2];
      if (target.startsWith("/")) {
        out.push(
          <Link key={key++} href={href(target)}>
            {match[1]}
          </Link>,
        );
      } else if (target.startsWith("mailto:")) {
        out.push(
          <a key={key++} href={target}>
            {match[1]}
          </a>,
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
    } else {
      out.push(
        <a key={key++} href={`mailto:${email}`} dir="ltr">
          {email}
        </a>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Block({
  block,
  email,
  href,
}: {
  block: LegalBlock;
  email: string;
  href: (path: string) => string;
}) {
  const inline = (text: string) => renderInline(text, email, href);
  if (typeof block === "string") return <p>{inline(block)}</p>;
  if ("h3" in block) return <h3>{inline(block.h3)}</h3>;
  if ("ul" in block) {
    return (
      <ul>
        {block.ul.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>
    );
  }
  if ("ol" in block) {
    return (
      <ol>
        {block.ol.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ol>
    );
  }
  if ("callout" in block) {
    return (
      <div className="callout">
        <p>{inline(block.callout)}</p>
      </div>
    );
  }
  return (
    <div className="table-scroll">
      <table>
        <caption>{inline(block.table.caption)}</caption>
        <thead>
          <tr>
            {block.table.head.map((cell, i) => (
              <th key={i} scope="col">
                {inline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>{inline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalBody({
  doc,
  email,
  href,
  contentsLabel,
}: {
  doc: LegalDoc;
  email: string;
  href: (path: string) => string;
  contentsLabel: string;
}) {
  return (
    <>
      {doc.sections.length > 3 ? (
        <nav className="card legal-toc" aria-label={contentsLabel}>
          <p className="eyebrow">{contentsLabel}</p>
          <ol>
            {doc.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.heading}</a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <article className="card form prose legal-body">
        {doc.sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}>
            <h2 id={`${section.id}-title`}>{section.heading}</h2>
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} email={email} href={href} />
            ))}
          </section>
        ))}
      </article>
    </>
  );
}

export function LegalProfile({
  profile,
  email,
  href,
}: {
  profile: LegalProfileText;
  email: string;
  href: (path: string) => string;
}) {
  return (
    <section className="card form legal-business" aria-labelledby="business-details-title">
      <h2 id="business-details-title">{profile.heading}</h2>
      <dl className="meta-list">
        {profile.rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{renderInline(value, email, href)}</dd>
          </div>
        ))}
      </dl>
      <p className="small muted">{renderInline(profile.note, email, href)}</p>
    </section>
  );
}
