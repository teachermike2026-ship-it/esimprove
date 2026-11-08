import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { legalSettings, type LegalSettingsRow } from "@/lib/db/schema";

export type { LegalSettingsRow };

/**
 * Central legal/configuration source.
 *
 * Every business-identity field defaults to an empty string. The application
 * must never render a fabricated legal name, registration number, address,
 * telephone number, VAT number, or jurisdiction.
 */

export const LEGAL_SETTINGS_ID = "legal_global";

export const LEGAL_DOCUMENT_KEYS = [
  "privacy",
  "terms",
  "refunds",
  "cookies",
  "accessibility",
] as const;

export type LegalDocumentKey = (typeof LEGAL_DOCUMENT_KEYS)[number];

export interface LegalDocumentDefinition {
  key: LegalDocumentKey;
  title: string;
  shortTitle: string;
  path: string;
  description: string;
  versionField:
    | "privacyVersion"
    | "termsVersion"
    | "refundsVersion"
    | "cookiesVersion"
    | "accessibilityVersion";
  effectiveField:
    | "privacyEffectiveDate"
    | "termsEffectiveDate"
    | "refundsEffectiveDate"
    | "cookiesEffectiveDate"
    | "accessibilityEffectiveDate";
  statusField:
    | "privacyReviewStatus"
    | "termsReviewStatus"
    | "refundsReviewStatus"
    | "cookiesReviewStatus"
    | "accessibilityReviewStatus";
}

export const LEGAL_DOCUMENTS: LegalDocumentDefinition[] = [
  {
    key: "privacy",
    title: "Privacy policy",
    shortTitle: "Privacy",
    path: "/legal/privacy",
    description: "How personal information is collected, used, retained, and shared.",
    versionField: "privacyVersion",
    effectiveField: "privacyEffectiveDate",
    statusField: "privacyReviewStatus",
  },
  {
    key: "terms",
    title: "Terms of service",
    shortTitle: "Terms",
    path: "/legal/terms",
    description: "Contractual rules for accounts, orders, eSIM use, and liability.",
    versionField: "termsVersion",
    effectiveField: "termsEffectiveDate",
    statusField: "termsReviewStatus",
  },
  {
    key: "refunds",
    title: "Refund policy",
    shortTitle: "Refunds",
    path: "/legal/refunds",
    description: "Refund eligibility, review process, and digital-product limitations.",
    versionField: "refundsVersion",
    effectiveField: "refundsEffectiveDate",
    statusField: "refundsReviewStatus",
  },
  {
    key: "cookies",
    title: "Cookie policy",
    shortTitle: "Cookies",
    path: "/legal/cookies",
    description: "Storage, consent categories, optional analytics, and withdrawal.",
    versionField: "cookiesVersion",
    effectiveField: "cookiesEffectiveDate",
    statusField: "cookiesReviewStatus",
  },
  {
    key: "accessibility",
    title: "Accessibility statement",
    shortTitle: "Accessibility",
    path: "/legal/accessibility",
    description: "Accessibility measures, known limitations, and feedback route.",
    versionField: "accessibilityVersion",
    effectiveField: "accessibilityEffectiveDate",
    statusField: "accessibilityReviewStatus",
  },
];

export const LEGAL_REVIEW_STATUSES = [
  "complete",
  "needs_owner_information",
  "needs_legal_review",
  "needs_technical_implementation",
  "not_applicable",
  "not_verified",
  "external_configuration_required",
] as const;

export type LegalReviewStatus = (typeof LEGAL_REVIEW_STATUSES)[number];

/**
 * Asset rows use two additional legacy statuses that predate the legal review
 * status list. They are valid only for the asset register, not for documents,
 * accessibility reviews, or readiness items.
 */
export const ASSET_REVIEW_STATUSES = [
  ...LEGAL_REVIEW_STATUSES,
  "verified",
  "needs_verification",
] as const;

export function isLegalReviewStatus(value: string): value is LegalReviewStatus {
  return (LEGAL_REVIEW_STATUSES as readonly string[]).includes(value);
}

export function isAssetReviewStatus(value: string): boolean {
  return (ASSET_REVIEW_STATUSES as readonly string[]).includes(value);
}

export const BUSINESS_FIELDS = [
  { key: "legalName", label: "Legal business name", required: true },
  { key: "tradingName", label: "Trading name", required: false },
  { key: "registrationNumber", label: "Business registration number", required: false },
  { key: "registeredAddress", label: "Registered business address", required: true },
  { key: "businessCountry", label: "Business country", required: true },
  { key: "contactEmail", label: "Contact email", required: true },
  { key: "supportEmail", label: "Customer support email", required: true },
  { key: "phone", label: "Telephone number", required: false },
  { key: "legalContact", label: "Legal contact", required: false },
  { key: "privacyContact", label: "Privacy contact", required: true },
  { key: "jurisdiction", label: "Applicable jurisdiction", required: true },
  { key: "vatNumber", label: "VAT or tax registration number", required: false },
  { key: "taxDetails", label: "Tax details", required: false },
] as const;

export type BusinessFieldKey = (typeof BUSINESS_FIELDS)[number]["key"];

export interface BusinessProfileStatus {
  field: BusinessFieldKey;
  label: string;
  required: boolean;
  configured: boolean;
}

export function businessProfileStatus(
  settings: LegalSettingsRow,
): BusinessProfileStatus[] {
  return BUSINESS_FIELDS.map((field) => ({
    field: field.key,
    label: field.label,
    required: field.required,
    configured: Boolean(String(settings[field.key] ?? "").trim()),
  }));
}

export function businessProfileMissing(settings: LegalSettingsRow): BusinessProfileStatus[] {
  return businessProfileStatus(settings).filter((entry) => entry.required && !entry.configured);
}

export function isBusinessProfileComplete(settings: LegalSettingsRow): boolean {
  return businessProfileMissing(settings).length === 0;
}

export function configuredBusinessName(settings: LegalSettingsRow): string {
  return settings.legalName.trim() || settings.tradingName.trim();
}

export function configuredSupportEmail(settings: LegalSettingsRow): string {
  return settings.supportEmail.trim() || settings.contactEmail.trim();
}

export function configuredPrivacyEmail(settings: LegalSettingsRow): string {
  return settings.privacyContact.trim() || settings.contactEmail.trim();
}

export function formatBusinessAddress(settings: LegalSettingsRow): string {
  return settings.registeredAddress
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");
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

export function documentMeta(
  settings: LegalSettingsRow,
  key: LegalDocumentKey,
): { version: string; effectiveDate: string | null; status: string } {
  const definition = LEGAL_DOCUMENTS.find((entry) => entry.key === key);
  if (!definition) throw new Error(`Unknown legal document: ${key}`);
  return {
    version: settings[definition.versionField],
    effectiveDate: settings[definition.effectiveField],
    status: settings[definition.statusField],
  };
}

export function documentIsPublishable(
  settings: LegalSettingsRow,
  key: LegalDocumentKey,
): boolean {
  const meta = documentMeta(settings, key);
  return meta.status === "complete" && Boolean(meta.effectiveDate) && isBusinessProfileComplete(settings);
}

/** Fallback settings used when the legal tables have not been migrated yet. */
export function defaultLegalSettings(now = new Date()): LegalSettingsRow {
  return {
    id: LEGAL_SETTINGS_ID,
    legalName: "",
    tradingName: "",
    registrationNumber: "",
    registeredAddress: "",
    businessCountry: "",
    contactEmail: "",
    supportEmail: "",
    phone: "",
    legalContact: "",
    privacyContact: "",
    jurisdiction: "",
    vatNumber: "",
    taxDetails: "",
    minimumAge: null,
    minimumAgeNote: "",
    termsVersion: "draft-2026-11-07",
    privacyVersion: "draft-2026-11-07",
    refundsVersion: "draft-2026-11-07",
    cookiesVersion: "draft-2026-11-07",
    accessibilityVersion: "draft-2026-11-07",
    termsEffectiveDate: null,
    privacyEffectiveDate: null,
    refundsEffectiveDate: null,
    cookiesEffectiveDate: null,
    accessibilityEffectiveDate: null,
    termsReviewStatus: "needs_legal_review",
    privacyReviewStatus: "needs_legal_review",
    refundsReviewStatus: "needs_legal_review",
    cookiesReviewStatus: "needs_legal_review",
    accessibilityReviewStatus: "needs_legal_review",
    cookieConsentVersion: "2026-11-07",
    marketingConsentVersion: "2026-11-07",
    refundReviewNotes: "",
    updatedAt: now,
  };
}

/**
 * Safe loader for public pages. If the table is missing (for example before a
 * migration has run), the page falls back to blank owner fields rather than
 * crashing or inventing details.
 */
export async function loadLegalSettings(db: Database): Promise<LegalSettingsRow> {
  try {
    const rows = await db
      .select()
      .from(legalSettings)
      .where(eq(legalSettings.id, LEGAL_SETTINGS_ID))
      .limit(1);
    return rows[0] ?? defaultLegalSettings();
  } catch {
    return defaultLegalSettings();
  }
}

export async function getOrCreateLegalSettings(db: Database): Promise<LegalSettingsRow> {
  const rows = await db
    .select()
    .from(legalSettings)
    .where(eq(legalSettings.id, LEGAL_SETTINGS_ID))
    .limit(1);
  if (rows[0]) return rows[0];
  const created = defaultLegalSettings();
  await db.insert(legalSettings).values(created).onConflictDoNothing();
  return created;
}

export const COOKIE_CONSENT_STORAGE_KEY = "es_consent_v1";
export const LEGACY_CONSENT_STORAGE_KEY = "es_analytics_consent";
export const CONSENT_CHANGE_EVENT = "esimprove-consent-change";
export const CONSENT_OPEN_EVENT = "esimprove-open-consent";
export const CONSENT_RECORD_ENDPOINT = "/api/consent";
/**
 * Maximum age of a server-side cookie-consent record before it must be renewed.
 * This is consent validity, not analytics retention; the two policies are
 * deliberately separate.
 */
export const CONSENT_VALIDITY_DAYS = 180;

export type ConsentAction = "accept_all" | "reject_non_essential" | "custom" | "withdraw";

export interface ConsentCategories {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
}

export interface StoredConsent {
  version: string;
  timestamp: string;
  action: ConsentAction;
  categories: ConsentCategories;
}

export function consentIsAnalyticsGranted(
  consent: StoredConsent | null,
  currentVersion: string,
): boolean {
  return Boolean(
    consent &&
      consent.version === currentVersion &&
      consent.categories.analytics === true &&
      consent.categories.necessary === true,
  );
}

export const LEGAL_DISCLAIMER =
  "This document is a project draft based on the functionality implemented in this build. It is not a substitute for advice from a qualified lawyer in the relevant jurisdiction.";
