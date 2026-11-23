import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** A 256-bit bearer credential. Never log, persist, or place it in a URL. */
export function generateOwnerToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Returns a SHA-256 digest suitable for storage, or null for malformed tokens. */
export function hashOwnerToken(token: string): string | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== token) return null;
  return createHash("sha256").update(bytes).digest("hex");
}

/** Compares a token to a stored digest without comparing secret bytes as strings. */
export function matchesOwnerToken(token: string, storedHash: string): boolean {
  const digest = hashOwnerToken(token);
  if (!digest || !/^[0-9a-f]{64}$/.test(storedHash)) return false;
  return timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(storedHash, "hex"));
}
