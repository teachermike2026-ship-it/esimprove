import { describe, expect, it } from "vitest";
import { generateOwnerToken, hashOwnerToken, matchesOwnerToken } from "@/lib/auth/owner-token";

describe("owner token cryptographic primitives", () => {
  it("generates distinct canonical 256-bit tokens and stores only digests", () => {
    const first = generateOwnerToken();
    const second = generateOwnerToken();
    expect(first).not.toBe(second);
    expect(Buffer.from(first, "base64url")).toHaveLength(32);
    const hash = hashOwnerToken(first);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(first);
    expect(matchesOwnerToken(first, hash!)).toBe(true);
    expect(matchesOwnerToken(second, hash!)).toBe(false);
  });

  it("rejects malformed and non-canonical tokens and malformed hashes", () => {
    const token = generateOwnerToken();
    const hash = hashOwnerToken(token)!;
    expect(hashOwnerToken(token + "=")).toBeNull();
    expect(hashOwnerToken("x".repeat(10000))).toBeNull();
    expect(hashOwnerToken("A".repeat(42) + "B")).toBeNull();
    expect(matchesOwnerToken(token, "invalid")).toBe(false);
    expect(matchesOwnerToken("invalid", hash)).toBe(false);
  });
});
