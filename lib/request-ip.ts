import { isIP } from "node:net";
import { isDeployed } from "@/lib/config";
import { hashIdentifier } from "@/lib/crypto";

/**
 * The only client-address inputs this application trusts.
 *
 * Netlify terminates the public connection and overwrites
 * `x-nf-client-connection-ip` with the address it observed. That header is the
 * authoritative source in a deployed context; arbitrary `x-forwarded-for`
 * values are client-controlled and must not be used to choose a rate-limit
 * bucket there.
 *
 * Local development and tests do not run behind Netlify, so a forwarded address
 * is accepted only when `isDeployed` is false. The value is validated with
 * `node:net.isIP` before hashing.
 */
export interface ClientAddressOptions {
  /** Test seam: override the deployment check. */
  deployed?: boolean;
}

const UNIDENTIFIED_CLIENT = "unidentified-client";

function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim().replace(/^"|"$/g, "");
  if (!candidate) return null;

  // [2001:db8::1]:443 -> 2001:db8::1
  const bracketed = candidate.match(/^\[([^\]]+)\](?::\d{1,5})?$/);
  if (bracketed) candidate = bracketed[1]!;

  // 203.0.113.10:443 -> 203.0.113.10
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d{1,5}$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  }

  // IPv6 zone identifiers are not meaningful for a public request address.
  candidate = candidate.split("%")[0]!;

  return isIP(candidate) ? candidate : null;
}

function firstForwardedHop(value: string | null | undefined): string | null {
  if (!value) return null;
  // In local/test traffic, use the first hop as the browser-supplied client.
  // Do not use this branch in a deployed context (see resolveClientAddress).
  return normalizeAddress(value.split(",")[0]);
}

/** Returns a validated client address, or null when no trusted value exists. */
export function resolveClientAddress(
  headers: Headers,
  options: ClientAddressOptions = {},
): string | null {
  const deployed = options.deployed ?? isDeployed;

  // Prefer the platform-observed address in every context. A client cannot
  // normally set this header on Netlify, and preferring it removes ambiguity
  // when a proxy also appends x-forwarded-for.
  const netlifyAddress = normalizeAddress(headers.get("x-nf-client-connection-ip"));
  if (netlifyAddress) return netlifyAddress;

  // Deployed: never fall back to client-controlled forwarding headers.
  if (deployed) return null;

  return (
    firstForwardedHop(headers.get("x-forwarded-for")) ??
    normalizeAddress(headers.get("x-real-ip"))
  );
}

/**
 * Pseudonymous rate-limit identity. A missing or malformed address maps to one
 * shared, limited bucket rather than an unlimited bypass. The raw address is
 * never stored; `hashIdentifier` uses RATE_LIMIT_HASH_SECRET.
 */
export function clientIpHash(headers: Headers, options: ClientAddressOptions = {}): string {
  return hashIdentifier(resolveClientAddress(headers, options) ?? UNIDENTIFIED_CLIENT);
}

export { UNIDENTIFIED_CLIENT };
