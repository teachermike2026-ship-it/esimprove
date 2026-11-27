import type { Metadata } from "next";
import { noIndex, siteName, siteUrl } from "@/lib/config";
import { getI18n } from "@/lib/i18n/server";

/**
 * Blog articles are written in English only. Localised copies of blog URLs
 * (/fr/blog/…) keep translated navigation for visitors, but they are not
 * separate translations, so they are `noindex, follow` and canonicalise to
 * the English URL, and no hreflang alternates are advertised for them.
 * When a reviewed translation exists, give it its own entry here.
 */
export function blogUrl(path: string): string {
  return `${siteUrl.replace(/\/+$/, "")}${path === "/" ? "" : path}`;
}

export async function blogMetadata(input: {
  path: string;
  title: string;
  description: string;
  noindex?: boolean;
  absoluteTitle?: boolean;
  openGraph?: Metadata["openGraph"];
  twitter?: Metadata["twitter"];
}): Promise<Metadata> {
  const { locale } = await getI18n();
  const canonical = blogUrl(input.path);
  const index = !input.noindex && locale === "en";
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: {
      canonical,
      languages: { en: canonical, "x-default": canonical },
    },
    // Demo, preview and staging deployments are never indexable (lib/config).
    robots: noIndex ? { index: false, follow: false, nocache: true } : { index, follow: true },
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      siteName,
      locale: "en_US",
      type: "website",
      ...input.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      ...input.twitter,
    },
  };
}
