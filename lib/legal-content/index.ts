import type { Locale } from "@/lib/i18n/config";
import { ar } from "./ar";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import type { LegalContext, LegalDoc, LegalDocKey, LegalLanguagePack, LegalProfileText } from "./types";

export * from "./types";

const packs: Record<Locale, LegalLanguagePack> = { en, fr, es, ar };

export function legalPack(locale: Locale): LegalLanguagePack {
  return packs[locale] ?? en;
}

export function legalDoc(locale: Locale, key: LegalDocKey, ctx: LegalContext): LegalDoc {
  return legalPack(locale).docs[key](ctx);
}

export function legalProfile(locale: Locale, ctx: LegalContext): LegalProfileText {
  return legalPack(locale).profile(ctx);
}
