import type { Translator } from "./translate";

/**
 * Localizes an operational status code such as `pending_payment` using the
 * `status.*` dictionary keys. Unknown codes fall back to a humanized version of
 * the code so new database values remain readable instead of blank.
 */
export function statusLabel(t: Translator, status: string): string {
  const key = `status.${status}`;
  const translated = t(key);
  return translated === key ? status.replaceAll("_", " ") : translated;
}
