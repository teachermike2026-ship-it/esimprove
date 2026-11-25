export const LOCALE_COOKIE = "esimprove_locale";
export const LOCALE_HEADER = "x-esimprove-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const locales = ["en", "es", "ar", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export type TextDirection = "ltr" | "rtl";

export interface LocaleDescriptor {
  code: Locale;
  nativeName: string;
  englishName: string;
  shortLabel: string;
  dir: TextDirection;
  htmlLang: string;
  intlLocale: string;
  ogLocale: string;
}

export const localeDescriptors: Record<Locale, LocaleDescriptor> = {
  en: {
    code: "en",
    nativeName: "English",
    englishName: "English",
    shortLabel: "EN",
    dir: "ltr",
    htmlLang: "en",
    intlLocale: "en-US",
    ogLocale: "en_US",
  },
  es: {
    code: "es",
    nativeName: "Español",
    englishName: "Spanish",
    shortLabel: "ES",
    dir: "ltr",
    htmlLang: "es",
    intlLocale: "es-ES",
    ogLocale: "es_ES",
  },
  ar: {
    code: "ar",
    nativeName: "العربية",
    englishName: "Arabic",
    shortLabel: "AR",
    dir: "rtl",
    htmlLang: "ar",
    intlLocale: "ar",
    ogLocale: "ar_AR",
  },
  fr: {
    code: "fr",
    nativeName: "Français",
    englishName: "French",
    shortLabel: "FR",
    dir: "ltr",
    htmlLang: "fr",
    intlLocale: "fr-FR",
    ogLocale: "fr_FR",
  },
};

export const localeList: LocaleDescriptor[] = locales.map((code) => localeDescriptors[code]);

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value) && locales.includes(value as Locale);
}

export function resolveLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : defaultLocale;
}

export function localeDirection(locale: Locale): TextDirection {
  return localeDescriptors[locale].dir;
}

export function localeIntl(locale: Locale): string {
  return localeDescriptors[locale].intlLocale;
}

export function localeOg(locale: Locale): string {
  return localeDescriptors[locale].ogLocale;
}

export function localeName(locale: Locale): string {
  return localeDescriptors[locale].nativeName;
}

export function localeCookieOptions() {
  return {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: false,
  };
}

/** Routes that are operational rather than localized. */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * Locale-prefixed URLs are used for non-default locales, while the existing
 * unprefixed URLs remain the canonical English routes. `/es/plans` is proxied
 * to `/plans` with a locale header, so no route file moves are required.
 */
export function splitLocalePath(pathname: string): {
  locale: Locale | null;
  pathname: string;
} {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const match = /^\/([a-z]{2})(?=\/|$)/.exec(normalized);
  if (!match) return { locale: null, pathname: normalized };
  const candidate = match[1];
  if (!isLocale(candidate)) return { locale: null, pathname: normalized };
  const rest = normalized.slice(match[0].length);
  return { locale: candidate, pathname: rest === "" ? "/" : rest };
}

export function localizedHref(pathname: string, locale: Locale): string {
  const [beforeHash, hash] = pathname.split("#", 2);
  const [rawPath, query] = beforeHash.split("?", 2);
  const normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const pathPart =
    locale === defaultLocale
      ? normalized
      : `/${locale}${normalized === "/" ? "" : normalized}`;
  return `${pathPart}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

/** Alias kept for readability at call sites that build navigation. */
export const localePath = localizedHref;

export function absoluteLocalizedUrl(pathname: string, locale: Locale, base: string): string {
  const origin = base.replace(/\/+$/, "");
  const localized = localizedHref(pathname, locale);
  return `${origin}${localized === "/" ? "" : localized}`;
}

export const languageAlternates = locales.map((code) => localeDescriptors[code]);
