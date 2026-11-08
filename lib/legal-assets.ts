import { asc, desc } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  accessibilityReviews,
  assetLicenses,
  dataRetentionSettings,
  legalDocumentVersions,
  legalReadinessItems,
  legalThirdParties,
  type AccessibilityReviewRow,
  type AssetLicenseRow,
  type DataRetentionSettingRow,
  type LegalDocumentVersionRow,
  type LegalReadinessItemRow,
  type LegalThirdPartyRow,
} from "@/lib/db/schema";

export async function listLegalDocumentVersions(
  db: Database,
): Promise<LegalDocumentVersionRow[]> {
  return db
    .select()
    .from(legalDocumentVersions)
    .orderBy(desc(legalDocumentVersions.updatedAt));
}

export async function listLegalThirdParties(db: Database): Promise<LegalThirdPartyRow[]> {
  return db.select().from(legalThirdParties).orderBy(asc(legalThirdParties.provider));
}

export async function listAssetLicenses(db: Database): Promise<AssetLicenseRow[]> {
  return db.select().from(assetLicenses).orderBy(asc(assetLicenses.name));
}

export async function listRetentionSettings(
  db: Database,
): Promise<DataRetentionSettingRow[]> {
  return db
    .select()
    .from(dataRetentionSettings)
    .orderBy(asc(dataRetentionSettings.label));
}

export async function listAccessibilityReviews(
  db: Database,
): Promise<AccessibilityReviewRow[]> {
  return db
    .select()
    .from(accessibilityReviews)
    .orderBy(asc(accessibilityReviews.area));
}

export async function listLegalReadinessItems(
  db: Database,
): Promise<LegalReadinessItemRow[]> {
  return db
    .select()
    .from(legalReadinessItems)
    .orderBy(asc(legalReadinessItems.category), asc(legalReadinessItems.label));
}

export const LEGAL_STATUS_LABELS: Record<string, string> = {
  complete: "Complete",
  needs_owner_information: "Needs owner information",
  needs_legal_review: "Needs legal review",
  needs_technical_implementation: "Needs technical implementation",
  needs_verification: "Needs verification",
  not_verified: "Not verified",
  not_applicable: "Not applicable",
  external_configuration_required: "External configuration required",
  optional_not_configured: "Optional — not configured",
  not_configured: "Not configured",
  verified: "Verified",
  verified_upstream: "Verified upstream",
  project_asset: "Project asset — ownership to confirm",
};

export function legalStatusLabel(status: string): string {
  return LEGAL_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

export function legalStatusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "complete" || status === "verified" || status === "verified_upstream") {
    return "success";
  }
  if (status === "rejected" || status === "not_verified") return "danger";
  if (status === "not_applicable") return "neutral";
  return "warning";
}

export function formatLegalDate(value: string | null | undefined): string {
  if (!value) return "Not yet set";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
