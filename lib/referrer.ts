/**
 * Referrer minimisation shared by the browser tracker and the server collector.
 *
 * Analytics must store only the source host, never a full referrer URL with a
 * path, query string, fragment, credentials, or other page-specific data.
 */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  const value = referrer.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase() || null;
  } catch {
    // Already-normalised host-only values are accepted; arbitrary strings are
    // not treated as hosts.
    const candidate = value.replace(/:\d{1,5}$/, "").toLowerCase();
    return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(candidate)
      ? candidate
      : null;
  }
}

/** Returns a compact host-only value suitable for storage. */
export function minimizedReferrer(referrer: string | null | undefined): string | null {
  return referrerHost(referrer);
}

/**
 * AI assistants and answer engines that send visitors to the site. Matched on
 * the referrer host, or on `utm_source` when the assistant strips the
 * referrer (ChatGPT adds utm_source=chatgpt.com to links it cites).
 */
export const AI_ASSISTANT_HOST =
  /(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com|claude\.ai|perplexity\.ai|gemini\.google\.com|bard\.google\.com|copilot\.microsoft\.com|copilot\.cloud\.microsoft|you\.com|phind\.com|poe\.com|meta\.ai|chat\.deepseek\.com|grok\.com|chat\.mistral\.ai|kagi\.com)$/;

export function isAiAssistantHost(host: string | null | undefined): boolean {
  return Boolean(host && AI_ASSISTANT_HOST.test(host.toLowerCase()));
}

/**
 * Referrer to record for a page view: the browser referrer, or, when it is
 * empty, an AI assistant named in utm_source (host-only, nothing else kept).
 */
export function attributionReferrer(documentReferrer: string, search: string): string | null {
  const fromReferrer = referrerHost(documentReferrer);
  if (fromReferrer) return fromReferrer;
  const utm = new URLSearchParams(search).get("utm_source");
  const host = referrerHost(utm);
  return host && isAiAssistantHost(host) ? host : null;
}
