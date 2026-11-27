import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/lib/db/client";
import { makeTestDb } from "./helpers/db";
import { FLAG_CODES, flagScope, flagSrc, hasFlag, isCountryCode, isGlobalCode, normalizeCoverage } from "@/lib/flags";
import { CountryFlag, DestinationFlag } from "@/components/country-flag";
import { getDestinations, getPlans } from "@/lib/catalog";

const ROOT = join(__dirname, "..");
const FLAGS_DIR = join(ROOT, "public", "flags");

describe("country flag mapping", () => {
  it("classifies destinations from their catalog code only", () => {
    expect(flagScope("JP")).toEqual({ kind: "country", code: "JP" });
    expect(flagScope(" fr ")).toEqual({ kind: "country", code: "FR" });
    expect(flagScope("GL-139", ["FR", "JP"])).toEqual({ kind: "global", count: 2 });
    expect(flagScope("EU-42", ["FR", "DE"])).toEqual({ kind: "region", codes: ["FR", "DE"] });
    // A single-country code ignores any coverage list: the destination code wins.
    expect(flagScope("ES", ["FR"])).toEqual({ kind: "country", code: "ES" });
    expect(isCountryCode("USCA-2")).toBe(false);
    expect(isGlobalCode("GL-120")).toBe(true);
    expect(isGlobalCode("EU-42")).toBe(false);
  });

  it("normalises supplier country lists to unique ISO alpha-2 codes", () => {
    expect(normalizeCoverage(["fr", "FR", " de", "EU-1", 7, null, "GBR", "xk"])).toEqual(["FR", "DE", "XK"]);
    expect(normalizeCoverage(undefined)).toEqual([]);
    expect(normalizeCoverage("FR")).toEqual([]);
  });

  it("keeps FLAG_CODES in sync with the SVG files, which contain no scripts", () => {
    const files = readdirSync(FLAGS_DIR).filter((name) => name.endsWith(".svg"));
    expect(files.length).toBe(FLAG_CODES.size);
    for (const file of files) {
      const code = file.replace(/\.svg$/, "").toUpperCase();
      expect(FLAG_CODES.has(code), file).toBe(true);
      const svg = readFileSync(join(FLAGS_DIR, file), "utf8");
      expect(svg, file).not.toMatch(/<script|javascript:|\son[a-z]+=/i);
    }
    expect(existsSync(join(FLAGS_DIR, "LICENSE-flag-icons.txt"))).toBe(true);
    for (const code of ["FR", "ES", "IT", "JP", "TH", "VN", "US", "GB", "BR", "KE", "AU", "ZA"]) {
      expect(hasFlag(code), code).toBe(true);
      expect(existsSync(join(ROOT, "public", flagSrc(code))), code).toBe(true);
    }
  });
});

describe("flag components", () => {
  const html = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(element);

  it("renders the national flag image for a single country", () => {
    const markup = html(createElement(CountryFlag, { code: "jp", label: "Japan" }));
    expect(markup).toContain('src="/flags/jp.svg"');
    expect(markup).toContain('alt=""');
    expect(markup).toContain('aria-hidden="true"');
  });

  it("falls back to a neutral code chip when no flag art exists", () => {
    const markup = html(createElement(CountryFlag, { code: "AN", label: "AN" }));
    expect(markup).not.toContain("<img");
    expect(markup).toContain("es-flag-fallback");
  });

  it("shows covered countries for regional packages and a globe for global ones", () => {
    const region = html(createElement(DestinationFlag, { countryCode: "EU-42", name: "Europe", coverage: ["FR", "DE", "IT", "ES", "PT"], max: 3 }));
    expect(region.match(/<img/g)?.length).toBe(3);
    expect(region).toContain("/flags/fr.svg");
    expect(region).toContain("+2");
    const global = html(createElement(DestinationFlag, { countryCode: "GL-139", name: "Global", coverage: ["FR", "JP"] }));
    expect(global).not.toContain("<img");
    expect(global).toContain("es-flag-globe");
    const single = html(createElement(DestinationFlag, { countryCode: "TH", name: "Thailand" }));
    expect(single).toContain("/flags/th.svg");
  });
});

describe("catalog coverage data", () => {
  let handle: DatabaseHandle;
  beforeAll(async () => {
    handle = await makeTestDb();
  });
  afterAll(async () => handle.close());

  it("adds coverage lists without changing single-country destinations", async () => {
    const destinations = await getDestinations(handle.db);
    for (const destination of destinations) {
      expect(Array.isArray(destination.coverage)).toBe(true);
      if (isCountryCode(destination.countryCode)) expect(destination.coverage).toEqual([]);
    }
    const plans = await getPlans(handle.db, { limit: 20 });
    for (const plan of plans) expect(Array.isArray(plan.coverage)).toBe(true);
  });
});

describe("hero phone carousels", () => {
  const source = readFileSync(join(ROOT, "components/home/phone-showcase.tsx"), "utf8");
  const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");

  it("runs two independent carousels that pause when hidden, hovered or focused", () => {
    expect(source).toContain("FRONT_INTERVAL_MS = 3600");
    expect(source).toContain("BACK_INTERVAL_MS = 4000");
    expect(source.match(/useAutoAdvance\(/g)?.length).toBe(3); // definition + two carousels
    expect(source).toContain('"visibilitychange"');
    expect(source).toContain("(prefers-reduced-motion: reduce)");
    expect(source).toContain("onMouseEnter");
    expect(source).toContain("inert={!active}");
    expect(source).toContain("home.phone.pauseAnimation");
  });

  it("stacks slides inside the fixed screen so frames never move or overflow", () => {
    expect(css).toMatch(/\.es-carousel \{\s*position: relative;\s*flex: 1;\s*min-height: 0;\s*overflow: hidden;/);
    expect(css).toMatch(/\.es-slide \{\s*position: absolute;\s*inset: 0;/);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
