/**
 * Legal documents: the four languages must stay aligned, links must work,
 * and checkout must require the immediate-supply acknowledgement.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "@/lib/i18n/config";
import {
  LEGAL_DOC_KEYS,
  LEGAL_DOC_PATHS,
  legalDoc,
  legalProfile,
  type LegalBlock,
  type LegalContext,
} from "@/lib/legal-content";
import { checkoutSchema } from "@/lib/validation";
import { SITEMAP_STATIC_PATHS } from "@/lib/sitemap";

const contexts: LegalContext[] = [
  { email: "contact@esimprove.com", ga4Configured: false },
  { email: "contact@esimprove.com", ga4Configured: true },
];

function blockText(block: LegalBlock): string[] {
  if (typeof block === "string") return [block];
  if ("h3" in block) return [block.h3];
  if ("ul" in block) return block.ul;
  if ("ol" in block) return block.ol;
  if ("callout" in block) return [block.callout];
  return [block.table.caption, ...block.table.head, ...block.table.rows.flat()];
}

function shape(block: LegalBlock): string {
  if (typeof block === "string") return "p";
  if ("h3" in block) return "h3";
  if ("ul" in block) return `ul${block.ul.length}`;
  if ("ol" in block) return `ol${block.ol.length}`;
  if ("callout" in block) return "callout";
  return `table${block.table.head.length}x${block.table.rows.length}`;
}

function routeExists(href: string): boolean {
  const pathname = href.split("#")[0]!.replace(/\/$/, "") || "/";
  const dir = path.join(process.cwd(), "app", ...pathname.split("/").filter(Boolean));
  return existsSync(path.join(dir, "page.tsx"));
}

describe("legal documents", () => {
  it("have the same sections and structure in English, French, Spanish and Arabic", () => {
    for (const ctx of contexts) {
      for (const key of LEGAL_DOC_KEYS) {
        const reference = legalDoc("en", key, ctx);
        for (const locale of locales) {
          const doc = legalDoc(locale, key, ctx);
          expect(doc.sections.map((s) => s.id), `${locale}/${key}`).toEqual(reference.sections.map((s) => s.id));
          expect(
            doc.sections.map((s) => s.blocks.map(shape).join(",")),
            `${locale}/${key} block structure`,
          ).toEqual(reference.sections.map((s) => s.blocks.map(shape).join(",")));
        }
      }
    }
  });

  it("link only to pages that exist, with the same targets in every language", () => {
    for (const key of LEGAL_DOC_KEYS) {
      const linksByLocale = locales.map((locale) => {
        const doc = legalDoc(locale, key, contexts[1]!);
        const texts = [doc.intro, ...doc.sections.flatMap((s) => s.blocks.flatMap(blockText))];
        return texts.flatMap((text) => [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]!)).sort();
      });
      for (const links of linksByLocale) expect(links).toEqual(linksByLocale[0]);
      for (const href of linksByLocale[0]!) {
        if (href.startsWith("#")) continue;
        expect(routeExists(href), `${key} links to ${href}`).toBe(true);
      }
    }
  });

  it("are routed, listed in the sitemap and free of template placeholders", () => {
    for (const key of LEGAL_DOC_KEYS) {
      expect(routeExists(LEGAL_DOC_PATHS[key]), LEGAL_DOC_PATHS[key]).toBe(true);
      expect(SITEMAP_STATIC_PATHS).toContain(LEGAL_DOC_PATHS[key]);
      for (const locale of locales) {
        const doc = legalDoc(locale, key, contexts[0]!);
        const all = [doc.title, doc.description, doc.intro, ...doc.sections.flatMap((s) => [s.heading, ...s.blocks.flatMap(blockText)])].join("\n");
        // Case-sensitive: Spanish "todo" (all) is legitimate text.
        expect(all).not.toMatch(/TODO|XXX|Lorem|lorem ipsum|\[insert|\{(?!email\})[a-z]+\}/);
      }
    }
  });

  it("never invent business identifiers", () => {
    for (const locale of locales) {
      const rows = legalProfile(locale, contexts[0]!).rows.map(([, value]) => value).join("\n");
      // No registration/VAT numbers, phone numbers or street addresses are claimed.
      expect(rows).not.toMatch(/\+\d{6,}|\b\d{9,}\b|VAT\s*(no|number)?\s*[:#]\s*\w/i);
    }
  });

  it("disclose the USDT unique amount below one cent and the 15 confirmations consistently", () => {
    for (const locale of locales) {
      const text = JSON.stringify(legalDoc(locale, "payments", contexts[0]!));
      expect(text).toMatch(/0[.,]0099 USDT/);
      expect(text).toContain("15");
      expect(text).toContain("0x55d398326f99059fF775485246999027B3197955");
    }
  });
});

describe("checkout consent", () => {
  const base = {
    email: "buyer@example.com",
    name: "Test Buyer",
    country: "FR",
    terms: "on",
    termsVersion: "2.0",
    idempotencyKey: "checkout_1234567890",
  };

  it("requires the unticked immediate-supply acknowledgement", () => {
    expect(checkoutSchema.safeParse(base).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, immediateSupply: "" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, immediateSupply: "yes" }).success).toBe(true);
  });
});
