import { describe, expect, it } from "vitest";
import { isVerifiedOwner, OWNER_EMAIL } from "@/lib/auth/owner-identity";

describe("owner identity", () => {
  const verified = new Date("2025-01-01T00:00:00Z");
  it("requires the designated verified address and dedicated role", () => {
    expect(isVerifiedOwner({ email: OWNER_EMAIL, role: "owner", emailVerifiedAt: verified })).toBe(true);
    for (const role of ["admin", "super_admin", "support", "customer"]) {
      expect(isVerifiedOwner({ email: OWNER_EMAIL, role, emailVerifiedAt: verified })).toBe(false);
    }
    expect(isVerifiedOwner({ email: "other@example.test", role: "owner", emailVerifiedAt: verified })).toBe(false);
    expect(isVerifiedOwner({ email: OWNER_EMAIL, role: "owner", emailVerifiedAt: null })).toBe(false);
  });
});
