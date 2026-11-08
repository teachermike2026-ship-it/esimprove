import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { URL } from "node:url";

export type ConnectionTestResult = {
  safe: boolean;
  url?: string;
  error?: string;
};

const MAX_URL_LENGTH = 2048;
const ALLOWED_PORTS = new Set(["", "80", "443", "8443"]);
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "kubernetes.default.svc",
]);

function normalizeHostname(hostname: string): string {
  return hostname
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

function parseIpv4(value: string): number[] | null {
  if (isIP(value) !== 4) return null;
  const parts = value.split(".").map((part) => Number.parseInt(part, 10));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  return parts;
}

function isBlockedIpv4(value: string): boolean {
  const parts = parseIpv4(value);
  if (!parts) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  // Multicast, reserved, and broadcast space.
  if (a >= 224) return true;
  return false;
}

function ipv4FromGroups(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

function ipv6Groups(value: string): number[] | null {
  let host = value;
  const zoneIndex = host.indexOf("%");
  if (zoneIndex >= 0) host = host.slice(0, zoneIndex);

  // Convert an embedded dotted-quad suffix to two hexadecimal groups.
  if (host.includes(".")) {
    const lastColon = host.lastIndexOf(":");
    if (lastColon < 0) return null;
    const ipv4 = parseIpv4(host.slice(lastColon + 1));
    if (!ipv4) return null;
    host =
      host.slice(0, lastColon + 1) +
      (((ipv4[0] << 8) | ipv4[1]).toString(16) +
        ":" +
        ((ipv4[2] << 8) | ipv4[3]).toString(16));
  }

  const halves = host.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  if (halves.length === 1 && missing !== 0) return null;
  if (halves.length === 2 && missing < 1) return null;

  const pieces = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  const groups = pieces.map((piece) => (/^[0-9a-f]{1,4}$/i.test(piece) ? Number.parseInt(piece, 16) : NaN));
  if (groups.length !== 8 || groups.some((group) => !Number.isInteger(group))) return null;
  return groups;
}

function isBlockedIpv6(value: string): boolean {
  if (isIP(value) !== 6) return false;
  const groups = ipv6Groups(value);
  if (!groups) return false;
  const [first, second, third, fourth, fifth, sixth, seventh, eighth] = groups;

  const allZero = groups.every((group) => group === 0);
  if (allZero) return true;
  if (groups.slice(0, 7).every((group) => group === 0) && eighth === 1) return true;

  // Link-local, unique-local, and multicast.
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xff00) === 0xff00) return true;

  // Documentation, Teredo, 6to4, and NAT64 ranges.
  if (first === 0x2001 && second === 0x0db8) return true;
  if (first === 0x2001 && second === 0x0000) return true;
  if (first === 0x2002) return true;
  if (first === 0x0064 && second === 0xff9b) return true;

  // IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96) addresses.
  const mappedV4 =
    groups.slice(0, 5).every((group) => group === 0) && sixth === 0xffff;
  const compatibleV4 =
    groups.slice(0, 6).every((group) => group === 0) && (seventh !== 0 || eighth > 1);
  if (mappedV4 || compatibleV4) {
    return isBlockedIpv4(ipv4FromGroups(seventh, eighth));
  }

  // Unspecified/loopback style ranges with other low-order encodings.
  if (first === 0 && second === 0 && third === 0 && fourth === 0 && fifth === 0) return true;
  return false;
}

function blockedAddressReason(address: string): string | null {
  const family = isIP(address);
  if (family === 4 && isBlockedIpv4(address)) {
    return "Private/internal network URLs blocked (SSRF protection)";
  }
  if (family === 6 && isBlockedIpv6(address)) {
    return "Private/internal network URLs blocked (SSRF protection)";
  }
  return null;
}

function validateHostname(hostname: string): string | null {
  const host = normalizeHostname(hostname);
  if (!host) return "Base URL is required";
  if (host.length > 253) return "Hostname is too long";
  if (BLOCKED_HOSTNAMES.has(host)) return "Localhost URLs are not allowed";
  if (
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    return "Localhost URLs are not allowed";
  }
  if (host.includes("%")) return "IPv6 zone identifiers are not allowed";
  const family = isIP(host);
  if (family === 4 || family === 6) {
    return blockedAddressReason(host);
  }
  return null;
}

export function validateConnectionUrl(urlStr: string): ConnectionTestResult {
  if (!urlStr || urlStr.trim().length === 0) {
    return { safe: false, error: "Base URL is required" };
  }
  const trimmed = urlStr.trim();
  if (trimmed.length > MAX_URL_LENGTH) {
    return { safe: false, error: "Base URL is too long" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, error: "Invalid URL" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { safe: false, error: "Only http/https URLs permitted" };
  }
  if (parsed.username || parsed.password) {
    return { safe: false, error: "URL must not include embedded credentials" };
  }
  if (!ALLOWED_PORTS.has(parsed.port)) {
    return { safe: false, error: "URL port is not allowed" };
  }

  const hostnameError = validateHostname(parsed.hostname);
  if (hostnameError) return { safe: false, error: hostnameError };

  return { safe: true, url: parsed.toString() };
}

/**
 * Resolves a hostname and rejects the URL if any resolved address is private,
 * loopback, link-local, metadata, or otherwise reserved. Callers should use
 * this immediately before an outbound request (there is currently no live
 * supplier request path in this demo).
 */
export async function validateConnectionUrlWithDns(
  urlStr: string,
  options?: {
    resolver?: (hostname: string) => Promise<string[]>;
  },
): Promise<ConnectionTestResult> {
  const base = validateConnectionUrl(urlStr);
  if (!base.safe || !base.url) return base;

  const parsed = new URL(base.url);
  const host = normalizeHostname(parsed.hostname);
  if (isIP(host)) return base;

  const resolver =
    options?.resolver ??
    (async (hostname: string) => {
      const records = await lookup(hostname, { all: true, verbatim: true });
      return records.map((record) => record.address);
    });

  let addresses: string[];
  try {
    addresses = await resolver(host);
  } catch {
    return { safe: false, error: "Hostname could not be resolved" };
  }
  if (addresses.length === 0) {
    return { safe: false, error: "Hostname did not resolve to an address" };
  }
  for (const address of addresses) {
    if (isIP(address) === 0) {
      return { safe: false, error: "Hostname resolved to an invalid address" };
    }
    const reason = blockedAddressReason(address);
    if (reason) return { safe: false, error: reason };
  }
  return base;
}
