import { CheckIcon, ChevronDownIcon, GlobeIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import {
  defaultLocale,
  localeDescriptors,
  localeList,
  localizedHref,
} from "@/lib/i18n/config";

/**
 * Language selector.
 *
 * Rendering plain anchors keeps the selector usable without JavaScript and
 * forces a full document navigation when the locale changes. A client-side
 * navigation would keep the root layout mounted and leave `<html lang dir>`
 * pointing at the previous language until a manual refresh.
 *
 * The proxy sets the locale cookie from the URL prefix, so the choice also
 * survives refreshes, sign-in, and later navigation.
 *
 * English is linked through `/en/...` on purpose: the proxy redirects that
 * prefix to the canonical unprefixed English path and clears any saved
 * non-English locale. That keeps unprefixed URLs canonical for English.
 */
export async function LanguageSwitcher({ variant = "header" }: { variant?: "header" | "mobile" }) {
  const { locale, pathname, t } = await getI18n();
  const current = localeDescriptors[locale];
  const currentPath = pathname || "/";

  function linkFor(code: (typeof localeList)[number]["code"]): string {
    if (code === defaultLocale) {
      return currentPath === "/" ? "/en" : `/en${currentPath}`;
    }
    return localizedHref(currentPath, code);
  }

  return (
    <details className={variant === "mobile" ? "es-lang es-lang-mobile" : "es-lang"}>
      <summary aria-label={t("languageSwitcher.label", { language: current.nativeName })}>
        <GlobeIcon />
        <span>{current.shortLabel}</span>
        <ChevronDownIcon className="es-chevron" />
      </summary>
      <div
        className="es-lang-menu"
        role="group"
        aria-label={t("languageSwitcher.available")}
      >
        <span className="es-lang-current">
          <CheckIcon /> {current.nativeName}
        </span>
        {localeList.map((descriptor) => (
          <a
            key={descriptor.code}
            href={linkFor(descriptor.code)}
            hrefLang={descriptor.code}
            lang={descriptor.code}
            aria-current={descriptor.code === locale ? "true" : undefined}
            className={descriptor.code === locale ? "es-lang-selected" : undefined}
          >
            {descriptor.nativeName}
          </a>
        ))}
        <span className="es-lang-note">{t("languageSwitcher.note")}</span>
      </div>
    </details>
  );
}
