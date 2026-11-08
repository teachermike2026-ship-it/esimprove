/**
 * Content Security Policy helpers for the application.
 *
 * Directives are kept explicit and minimal:
 * - `default-src 'self'` limits all sources the browser may load for anything
 *   not matched by a more specific directive.
 * - `script-src` permits self, inline bootstrap scripts, and the consent-gated
 *   Google Tag Manager / GA4 script origin. Inline sources are required because
 *   the Next.js App Router emits inline bootstrap scripts; a nonce/hash rollout
 *   is tracked as a later hardening step.
 * - `connect-src` permits first-party traffic plus GA4 collection endpoints.
 * - `img-src`, `style-src`, and `font-src` allow only first-party and
 *   data/blob-safe sources; `style-src` needs `'unsafe-inline'` for framework
 *   inline styles.
 */

export interface ContentSecurityPolicyOptions {
  development?: boolean;
  upgradeInsecureRequests?: boolean;
}

export const GA4_SCRIPT_SRC = "https://www.googletagmanager.com";
export const GA4_COLLECT_SRC = [
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  GA4_SCRIPT_SRC,
];

export function buildContentSecurityPolicy(
  options: ContentSecurityPolicyOptions = {},
): string {
  const development = options.development === true;
  const scriptSources = ["'self'", "'unsafe-inline'", GA4_SCRIPT_SRC];
  if (development) scriptSources.push("'unsafe-eval'");
  const connectSources = ["'self'", ...GA4_COLLECT_SRC];
  if (development) connectSources.push("ws:", "wss:");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src ${connectSources.join(" ")}`,
    "media-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
  ];
  if (options.upgradeInsecureRequests === true) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}
