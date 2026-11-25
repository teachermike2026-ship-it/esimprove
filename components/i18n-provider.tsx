"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  localizedHref,
  type Locale,
  type TextDirection,
} from "@/lib/i18n/config";
import type { TranslationKey } from "@/lib/i18n/dictionaries/en";
import { createTranslator, type Translator } from "@/lib/i18n/translate";

interface ClientI18n {
  locale: Locale;
  dir: TextDirection;
  t: Translator;
  dictionary: Record<TranslationKey, string>;
  href: (path: string) => string;
}

const I18nContext = createContext<ClientI18n | null>(null);

/**
 * Makes the active locale available to interactive ("use client") components.
 * Server components should use `getI18n()` from `lib/i18n/server` instead, so
 * they can read request headers and cookies without shipping the dictionary to
 * every client bundle that does not need it.
 */
export function I18nProvider({
  locale,
  dir,
  dictionary,
  children,
}: {
  locale: Locale;
  dir: TextDirection;
  dictionary: Record<TranslationKey, string>;
  children: ReactNode;
}) {
  const value = useMemo<ClientI18n>(() => {
    const t = createTranslator(dictionary);
    return {
      locale,
      dir,
      t,
      dictionary,
      href: (path: string) => localizedHref(path, locale),
    };
  }, [dictionary, dir, locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): ClientI18n {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return value;
}
