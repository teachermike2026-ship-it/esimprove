import { describe, expect, it } from "vitest";
import {
  DEMO_PLAN_SLUG,
  demoPlan,
  demoPlanMatchesFilters,
  demoProductEnabled,
  isDemoProductSlug,
  isLocalDemoPlan,
} from "@/lib/demo-plan";

describe("local demo eSIM product", () => {
  it("defines one clearly labelled, non-purchasable demo plan", () => {
    expect(demoPlan.slug).toBe(DEMO_PLAN_SLUG);
    expect(demoPlan.name).toBe("Demo eSIM — Europe");
    expect(demoPlan.regionName).toBe("Europe");
    expect(demoPlan.dataMb).toBe(1000);
    expect(demoPlan.validityDays).toBe(7);
    expect(demoPlan.priceMinor).toBe(100);
    expect(demoPlan.currency).toBe("USD");
    expect(demoPlan.status).toBe("demo");
    expect(demoPlan.isDemo).toBe(true);
    expect(demoPlan.supplierKey).toBe("demo-local");
    expect(demoProductEnabled()).toBe(true);
  });

  it("recognizes only the code-level demo product", () => {
    expect(isDemoProductSlug(DEMO_PLAN_SLUG)).toBe(true);
    expect(isDemoProductSlug("argentina-1000mb-7d")).toBe(false);
    expect(isLocalDemoPlan(demoPlan)).toBe(true);
    expect(
      isLocalDemoPlan({ slug: "argentina-1000mb-7d", supplierKey: "demo" }),
    ).toBe(false);
  });

  it("applies the public catalogue filters without hiding the default entry", () => {
    expect(demoPlanMatchesFilters({})).toBe(true);
    expect(demoPlanMatchesFilters({ q: "demo" })).toBe(true);
    expect(demoPlanMatchesFilters({ q: "europe" })).toBe(true);
    expect(demoPlanMatchesFilters({ q: "japan" })).toBe(false);
    expect(demoPlanMatchesFilters({ region: "europe" })).toBe(true);
    expect(demoPlanMatchesFilters({ region: "asia" })).toBe(false);
    expect(demoPlanMatchesFilters({ destination: "france" })).toBe(false);
    expect(demoPlanMatchesFilters({ maxPrice: 1 })).toBe(true);
    expect(demoPlanMatchesFilters({ maxPrice: 0.5 })).toBe(false);
    expect(demoPlanMatchesFilters({ minDataMb: 1000 })).toBe(true);
    expect(demoPlanMatchesFilters({ minDataMb: 5000 })).toBe(false);
    expect(demoPlanMatchesFilters({ minValidityDays: 7 })).toBe(true);
    expect(demoPlanMatchesFilters({ minValidityDays: 8 })).toBe(false);
  });
});
