import type { Metadata } from "next";
import { siteUrl } from "@/lib/config";
import { absoluteLocalizedUrl, languageAlternates } from "./config";
import { getI18n } from "./server";

interface LocalizedMetadataInput {
  path: string;
  title?: string;
  description?: string;
  absoluteTitle?: boolean;
  robots?: Metadata["robots"];
  openGraph?: Metadata["openGraph"];
}

/**
 * Builds page metadata for the active locale. Canonical URLs always point at
 * the locale-prefixed version, while English keeps the unprefixed URL.
 */
export async function localizedMetadata({
  path,
  title,
  description,
  absoluteTitle = false,
  robots,
  openGraph,
}: LocalizedMetadataInput): Promise<Metadata> {
  const { locale } = await getI18n();
  const resolvedTitle =
    title === undefined
      ? undefined
      : absoluteTitle
        ? ({ absolute: title } satisfies Metadata["title"])
        : title;

  const languages: Record<string, string> = Object.fromEntries(
    languageAlternates.map((descriptor) => [
      descriptor.htmlLang,
      absoluteLocalizedUrl(path, descriptor.code, siteUrl),
    ]),
  );
  languages["x-default"] = absoluteLocalizedUrl(path, "en", siteUrl);

  return {
    ...(resolvedTitle !== undefined ? { title: resolvedTitle } : {}),
    ...(description ? { description } : {}),
    alternates: {
      canonical: absoluteLocalizedUrl(path, locale, siteUrl),
      languages,
    },
    ...(robots ? { robots } : {}),
    ...(openGraph ? { openGraph } : {}),
  };
}
