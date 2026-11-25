import { cookies, headers } from "next/headers";
import {
  LOCALE_COOKIE,
  LOCALE_HEADER,
  defaultLocale,
  isAdminPath,
  localeDescriptors,
  localeDirection,
  localizedHref,
  resolveLocale,
  type Locale,
  type TextDirection,
} from "./config";
import { getDictionary, type TranslationKey } from "./dictionaries";
import { createTranslator, type Translator } from "./translate";

export interface I18n {
  locale: Locale;
  dir: TextDirection;
  htmlLang: string;
  t: Translator;
  dictionary: Record<TranslationKey, string>;
  pathname: string;
  href: (path: string) => string;
}

function localeFromPathname(pathname: string): Locale | null {
  const match = /^\/([a-z]{2})(?=\/|$)/.exec(pathname);
  if (!match) return null;
  const candidate = match[1];
  return candidate === "es" || candidate === "ar" || candidate === "fr" || candidate === "en"
    ? (candidate as Locale)
    : null;
}

/**
 * Locale precedence:
 * 1. proxy-emitted header (URL prefix wins and is always authoritative),
 * 2. saved cookie (persists across navigation, refresh, and sign-in),
 * 3. English.
 * Administrative routes are operational and always render in English.
 */
export async function getLocale(): Promise<Locale> {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  if (isAdminPath(pathname)) return defaultLocale;

  const headerLocale = headerList.get(LOCALE_HEADER);
  if (headerLocale) return resolveLocale(headerLocale);

  const fromPath = localeFromPathname(pathname);
  if (fromPath) return fromPath;

  const cookieList = await cookies();
  return resolveLocale(cookieList.get(LOCALE_COOKIE)?.value);
}

export async function getI18n(): Promise<I18n> {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "/";
  const locale = await getLocale();
  const dictionary = getDictionary(locale);
  const descriptor = localeDescriptors[locale];

  return {
    locale,
    dir: localeDirection(locale),
    htmlLang: descriptor.htmlLang,
    t: createTranslator(dictionary),
    dictionary,
    pathname,
    href: (path: string) => localizedHref(path, locale),
  };
}

export async function getTranslator(): Promise<Translator> {
  const { t } = await getI18n();
  return t;
}
