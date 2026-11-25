import { describe, expect, it } from "vitest";
import {
  absoluteLocalizedUrl,
  defaultLocale,
  isLocale,
  languageAlternates,
  localeDescriptors,
  localeDirection,
  localeList,
  localizedHref,
  resolveLocale,
  splitLocalePath,
} from "@/lib/i18n/config";
import { dictionaries, getDictionary } from "@/lib/i18n/dictionaries";
import { en, type TranslationKey } from "@/lib/i18n/dictionaries/en";
import { createTranslator } from "@/lib/i18n/translate";
import { statusLabel } from "@/lib/i18n/status";
import { supportCategoryLabel, supportPriorityLabel } from "@/lib/i18n/labels";

const localeCodes = ["en", "es", "ar", "fr"] as const;

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe("locale registry", () => {
  it("registers English, Spanish, Arabic, and French with native names", () => {
    expect(localeList.map((descriptor) => descriptor.code)).toEqual(["en", "es", "ar", "fr"]);
    expect(localeDescriptors.es.nativeName).toBe("Español");
    expect(localeDescriptors.ar.nativeName).toBe("العربية");
    expect(localeDescriptors.fr.nativeName).toBe("Français");
    expect(defaultLocale).toBe("en");
  });

  it("marks only Arabic as right-to-left", () => {
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("en")).toBe("ltr");
    expect(localeDirection("es")).toBe("ltr");
    expect(localeDirection("fr")).toBe("ltr");
  });

  it("rejects unknown locales without failing", () => {
    expect(isLocale("de")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(resolveLocale("de")).toBe("en");
    expect(resolveLocale("ar")).toBe("ar");
  });

  it("exposes an hreflang descriptor for every locale", () => {
    expect(languageAlternates.map((descriptor) => descriptor.htmlLang)).toEqual([
      "en",
      "es",
      "ar",
      "fr",
    ]);
  });
});

describe("localized URLs", () => {
  it("keeps English unprefixed and prefixes other locales", () => {
    expect(localizedHref("/", "en")).toBe("/");
    expect(localizedHref("/plans", "en")).toBe("/plans");
    expect(localizedHref("/", "es")).toBe("/es");
    expect(localizedHref("/plans", "ar")).toBe("/ar/plans");
    expect(localizedHref("/plans?page=2", "fr")).toBe("/fr/plans?page=2");
    expect(localizedHref("/plans#top", "es")).toBe("/es/plans#top");
  });

  it("builds absolute canonical URLs", () => {
    expect(absoluteLocalizedUrl("/", "en", "https://esimprove.test/")).toBe(
      "https://esimprove.test",
    );
    expect(absoluteLocalizedUrl("/plans", "es", "https://esimprove.test")).toBe(
      "https://esimprove.test/es/plans",
    );
  });

  it("splits supported prefixes and leaves lookalike paths alone", () => {
    expect(splitLocalePath("/es")).toEqual({ locale: "es", pathname: "/" });
    expect(splitLocalePath("/ar/plans")).toEqual({ locale: "ar", pathname: "/plans" });
    expect(splitLocalePath("/en/plans")).toEqual({ locale: "en", pathname: "/plans" });
    expect(splitLocalePath("/escape")).toEqual({ locale: null, pathname: "/escape" });
    expect(splitLocalePath("/de/plans")).toEqual({ locale: null, pathname: "/de/plans" });
  });
});

describe("dictionaries", () => {
  const englishKeys = Object.keys(en) as TranslationKey[];

  it("has identical key sets in every locale", () => {
    for (const code of localeCodes) {
      expect(Object.keys(dictionaries[code]).sort(), code).toEqual([...englishKeys].sort());
    }
  });

  it("has no empty or whitespace-only translations", () => {
    for (const code of localeCodes) {
      for (const key of englishKeys) {
        const value = getDictionary(code)[key];
        expect(typeof value, `${code}:${key}`).toBe("string");
        expect(value.trim().length, `${code}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps interpolation placeholders aligned with English", () => {
    for (const code of localeCodes.filter((value) => value !== "en")) {
      for (const key of englishKeys) {
        const source = en[key];
        const translated = getDictionary(code)[key];
        expect(placeholders(translated), `${code}:${key}`).toEqual(placeholders(source));
      }
    }
  });

  it("contains real translations rather than copied English copy", () => {
    expect(getDictionary("es")["nav.home"]).not.toBe(en["nav.home"]);
    expect(getDictionary("ar")["nav.home"]).not.toBe(en["nav.home"]);
    expect(getDictionary("fr")["nav.home"]).not.toBe(en["nav.home"]);
  });

  it("falls back to English for an unknown locale", () => {
    expect(getDictionary("de" as never)).toBe(en);
  });

  it("interpolates values and leaves unknown placeholders visible", () => {
    const t = createTranslator(getDictionary("es"));
    expect(t("blog.pageOf", { page: 2, pageCount: 5 })).toContain("2");
    expect(t("missing.key")).toBe("missing.key");
    expect(t("blog.pageOf")).toContain("{page}");
  });
});

describe("localized operational labels", () => {
  it("translates known statuses and humanizes unknown ones", () => {
    const t = createTranslator(getDictionary("es"));
    expect(statusLabel(t, "paid")).toBe(getDictionary("es")["status.paid"]);
    expect(statusLabel(t, "future_status")).toBe("future status");
  });

  it("translates support categories and priorities with English fallback", () => {
    const t = createTranslator(getDictionary("fr"));
    expect(supportCategoryLabel(t, "general")).toBe(getDictionary("fr")["support.cat.general"]);
    expect(supportPriorityLabel(t, "normal")).toBe(getDictionary("fr")["support.priority.normal"]);
    expect(supportCategoryLabel(t, "unknown_category")).toBe("unknown_category");
    expect(supportPriorityLabel(t, "unknown_priority")).toBe("unknown_priority");
  });
});
