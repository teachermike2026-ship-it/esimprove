/**
 * Content Security Policy helpers for the application.
 *
 * The policy is emitted per request by `proxy.ts` so that `script-src` can carry
 * a fresh nonce. Next.js reads the nonce from the CSP request header and applies
 * it to its own bootstrap/hydration scripts; manually authored inline scripts
 * (JSON-LD blocks and the consent-gated GA4 loader) receive it through the
 * `x-nonce` request header.
 *
 * Directives are kept explicit and minimal:
 * - `default-src 'self'` limits all sources the browser may load for anything
 *   not matched by a more specific directive.
 * - `script-src` permits first-party scripts, the per-request nonce, and the
 *   consent-gated Google Tag Manager / GA4 script origin. `'unsafe-inline'` is
 *   intentionally absent.
 * - `script-src-attr 'none'` blocks inline event-handler attributes.
 * - `connect-src` permits first-party traffic plus GA4 collection endpoints;
 *   development additionally needs WebSocket origins for hot reload.
 * - `img-src` permits first-party/data/blob images plus any owner-configured
 *   HTTPS origin in `CSP_IMAGE_HOSTS`. No wildcard HTTPS origin is allowed, so
 *   markup injection cannot use images to exfiltrate data to an arbitrary host.
 * - `media-src` follows the same rule with `CSP_MEDIA_HOSTS`.
 * - `style-src` needs `'unsafe-inline'` for framework inline style attributes.
 */

export interface ContentSecurityPolicyOptions {
  /** Fresh per-request nonce. A policy without a nonce blocks inline scripts. */
  nonce?: string;
  development?: boolean;
  upgradeInsecureRequests?: boolean;
  /** Additional exact HTTPS origins allowed for images. */
  imageHosts?: string[];
  /** Additional exact HTTPS origins allowed for audio/video. */
  mediaHosts?: string[];
}

export const GA4_SCRIPT_SRC = "https://www.googletagmanager.com";
export const GA4_COLLECT_SRC = [
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  GA4_SCRIPT_SRC,
];

const HTTPS_ORIGIN_PATTERN =
  /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?::\d{1,5})?$/i;

/**
 * Parses a comma-separated host allowlist into exact HTTPS origins. Invalid or
 * non-HTTPS entries are dropped instead of being copied into the header, which
 * also prevents header injection via whitespace or semicolons.
 */
export function parseCspHosts(raw: string | undefined): string[] {
  if (!raw) return [];
  const hosts = new Set<string>();
  for (const candidate of raw.split(",")) {
    const value = candidate.trim().replace(/\/+$/, "");
    if (HTTPS_ORIGIN_PATTERN.test(value)) hosts.add(value.toLowerCase());
  }
  return [...hosts];
}

export function configuredCspHosts(envName: "CSP_IMAGE_HOSTS" | "CSP_MEDIA_HOSTS"): string[] {
  return parseCspHosts(process.env[envName]);
}

/**
 * Generates a 128-bit nonce using the platform CSPRNG. Base64 output is a valid
 * CSP nonce source and is safe inside a quoted header value.
 */
export function createSecurityNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function buildContentSecurityPolicy(
  options: ContentSecurityPolicyOptions = {},
): string {
  const development = options.development === true;
  const nonce = options.nonce?.trim();

  const scriptSources = ["'self'"];
  if (nonce) scriptSources.push(`'nonce-${nonce}'`);
  scriptSources.push(GA4_SCRIPT_SRC);
  if (development) scriptSources.push("'unsafe-eval'");

  const connectSources = ["'self'", ...GA4_COLLECT_SRC];
  if (development) connectSources.push("ws:", "wss:");

  const imageSources = ["'self'", "data:", "blob:"];
  imageSources.push(...(options.imageHosts ?? configuredCspHosts("CSP_IMAGE_HOSTS")));

  const mediaSources = ["'self'"];
  mediaSources.push(...(options.mediaHosts ?? configuredCspHosts("CSP_MEDIA_HOSTS")));

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imageSources.join(" ")}`,
    "font-src 'self'",
    `connect-src ${connectSources.join(" ")}`,
    `media-src ${mediaSources.join(" ")}`,
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
