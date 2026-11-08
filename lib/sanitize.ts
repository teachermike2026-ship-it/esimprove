/**
 * Conservative HTML sanitizer for stored blog content.
 *
 * This is intentionally dependency-free and allowlist-based. It is not a
 * substitute for a dedicated sanitizer library, but it removes the classic
 * stored-XSS vectors: script/style blocks, event handler attributes,
 * javascript: URLs, and dangerous embedded documents.
 */

const BLOCK_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "meta",
  "link",
  "base",
];

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "strike", "del", "ins",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "a", "img", "figure", "figcaption", "table", "thead", "tbody",
  "tr", "th", "td", "span", "div", "small", "sup", "sub",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height", "loading"]),
  "*": new Set(["class"]),
};

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:|\/|#)/i.test(trimmed)) return trimmed;
  return null;
}

/**
 * Remove every tag not on the allowlist while keeping its text content, and
 * strip unsafe attributes from allowed tags.
 */
export function sanitizeBlogHtml(input: string): string {
  if (!input) return "";

  // Remove dangerous blocks with their content.
  let html = input;
  for (const tag of BLOCK_TAGS) {
    html = html.replace(
      new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"),
      "",
    );
    html = html.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }

  // Remove HTML comments.
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Walk tags and rebuild output.
  return html.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    const isClosing = match.startsWith("</");
    if (isClosing) return `</${tag}>`;

    const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
    const common = ALLOWED_ATTRS["*"];
    const attrRegex = /([a-zA-Z0-9-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    const kept: string[] = [];
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const name = attrMatch[1].toLowerCase();
      const value = attrMatch[3] ?? attrMatch[4] ?? attrMatch[5] ?? "";
      if (!allowed.has(name) && !common?.has(name)) continue;
      if (name.startsWith("on")) continue;
      if (name === "href" || name === "src") {
        const url = safeUrl(value);
        if (!url) continue;
        kept.push(`${name}="${escapeText(url).replace(/"/g, "&quot;")}"`);
        continue;
      }
      kept.push(`${name}="${escapeText(value).replace(/"/g, "&quot;")}"`);
    }

    if (tag === "a") {
      // External links should be safe by default.
      const relIndex = kept.findIndex((value) => value.startsWith("rel="));
      if (relIndex === -1) kept.push('rel="noopener noreferrer"');
    }
    return `<${tag}${kept.length ? ` ${kept.join(" ")}` : ""}>`;
  });
}

/** Convert sanitized HTML to plain text for excerpts and search. */
export function htmlToText(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Validate and normalize a URL slug. */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$|^[a-z0-9]$/.test(slug);
}
