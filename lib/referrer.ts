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
