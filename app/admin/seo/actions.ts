"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { saveSeoSettings } from "@/lib/seo";

export type SeoActionState = {
  ok?: boolean;
  error?: string;
};

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function str(formData: FormData, key: string, max = 500): string {
  const value = String(formData.get(key) ?? "").trim();
  return value.slice(0, max);
}

export async function saveSeoSettingsAction(
  _prev: SeoActionState,
  formData: FormData,
): Promise<SeoActionState> {
  // Server-side authorization: never trust the client.
  await requireAdmin("/admin/seo");

  const siteName = str(formData, "siteName", 100);
  const homepageTitle = str(formData, "homepageTitle", 200);
  const homepageDescription = str(formData, "homepageDescription", 300);
  const titleTemplate = str(formData, "titleTemplate", 200);
  const canonicalBase = str(formData, "canonicalBase", 500);
  const defaultOgImage = str(formData, "defaultOgImage", 500);
  const defaultOgTitle = str(formData, "defaultOgTitle", 200);
  const defaultOgDescription = str(formData, "defaultOgDescription", 300);
  const logoUrl = str(formData, "logoUrl", 500);
  const faviconUrl = str(formData, "faviconUrl", 500);
  const organizationName = str(formData, "organizationName", 200);
  const organizationUrl = str(formData, "organizationUrl", 500);
  const robotsDefault = str(formData, "robotsDefault", 50) || "index, follow";
  const indexDefault = formData.get("indexDefault") === "on";
  const gscVerificationToken = str(formData, "gscVerificationToken", 100) || null;
  const gscProperty = str(formData, "gscProperty", 500);
  const ga4MeasurementId = str(formData, "ga4MeasurementId", 30);

  if (!siteName) return { error: "Site name is required." };
  if (siteName.length > 100) return { error: "Site name must be 100 characters or fewer." };
  if (!homepageTitle || homepageTitle.length > 200) {
    return { error: "Homepage title is required and must be 200 characters or fewer." };
  }
  if (!homepageDescription || homepageDescription.length > 300) {
    return { error: "Homepage description is required and must be 300 characters or fewer." };
  }
  if (!titleTemplate) return { error: "Title template is required." };
  if (!canonicalBase || !isValidUrl(canonicalBase)) {
    return { error: "Canonical base URL must be a valid absolute URL." };
  }
  if (defaultOgImage && !isValidUrl(defaultOgImage)) {
    return { error: "Default Open Graph image must be a valid URL." };
  }
  if (logoUrl && !isValidUrl(logoUrl)) return { error: "Logo URL must be a valid URL." };
  if (faviconUrl && !isValidUrl(faviconUrl)) return { error: "Favicon URL must be a valid URL." };
  if (organizationUrl && !isValidUrl(organizationUrl)) {
    return { error: "Organization URL must be a valid URL." };
  }
  if (!/^(index|noindex),\s*(follow|nofollow)$/i.test(robotsDefault)) {
    return { error: "Robots directive must be like 'index, follow' or 'noindex, nofollow'." };
  }
  if (ga4MeasurementId && !/^G-[A-Z0-9]{6,}$/i.test(ga4MeasurementId)) {
    return { error: "GA4 measurement ID must look like G-XXXXXXXXXX." };
  }

  const sameAsRaw = String(formData.get("organizationSameAs") ?? "");
  const sameAs = sameAsRaw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter(isValidUrl)
    .slice(0, 10);

  const db = await getDb();
  await saveSeoSettings(db, {
    siteName,
    homepageTitle,
    homepageDescription,
    titleTemplate,
    canonicalBase: canonicalBase.replace(/\/+$/, ""),
    defaultOgImage,
    defaultOgTitle,
    defaultOgDescription,
    logoUrl,
    faviconUrl,
    organizationName,
    organizationUrl,
    organizationSameAs: sameAs,
    robotsDefault,
    indexDefault,
    gscVerificationToken,
    gscProperty,
    ga4MeasurementId,
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/seo");
  return { ok: true };
}
