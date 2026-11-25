import type { Locale } from "../config";
import { en, type TranslationKey } from "./en";
import { es } from "./es";
import { ar } from "./ar";
import { fr } from "./fr";

export type { TranslationKey };

export const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  en,
  es,
  ar,
  fr,
};

export function getDictionary(locale: Locale): Record<TranslationKey, string> {
  return dictionaries[locale] ?? en;
}
