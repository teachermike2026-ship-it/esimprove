import { describe, expect, it } from "vitest";
import { WHOP_VARIANT_TITLE_MAX, whopVariantTitle } from "@/lib/integrations/payment/whop";

describe("Whop variant title (live API maximum 30 characters)", () => {
  it("keeps short names unchanged", () => {
    expect(whopVariantTitle("Japan 1GB 7Days")).toBe("Japan 1GB 7Days");
    expect(whopVariantTitle("ESIMPROVE eSIM order")).toBe("ESIMPROVE eSIM order");
  });

  it("shortens long plan names to at most 30 characters on a word boundary", () => {
    const title = whopVariantTitle("United Arab Emirates 100MB 7Days");
    expect(title.length).toBeLessThanOrEqual(WHOP_VARIANT_TITLE_MAX);
    expect(title).toBe("United Arab Emirates 100MB…");
  });

  it("never exceeds the limit for any real catalogue-style name", () => {
    for (const name of [
      "Democratic Republic of the Congo 2GB/Day FUP1Mbps",
      "China mainland & Japan & South Korea 3GB 15Days",
      "Europe (30+ areas) 20GB 30Days",
      "Supercalifragilisticexpialidocious-no-spaces-at-all-here",
      "   ",
    ]) {
      const title = whopVariantTitle(name);
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThanOrEqual(WHOP_VARIANT_TITLE_MAX);
    }
  });
});
