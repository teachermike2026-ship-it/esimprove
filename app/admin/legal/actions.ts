"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import {
  accessibilityReviews,
  assetLicenses,
  dataRetentionSettings,
  legalDocumentVersions,
  legalSettings,
  legalReadinessItems,
  legalThirdParties,
} from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { newId } from "@/lib/ids";
import {
  LEGAL_DOCUMENTS,
  businessProfileMissing,
  getOrCreateLegalSettings,
  isLegalReviewStatus,
  type LegalDocumentKey,
} from "@/lib/legal";
import {
  getPrivacyRequest,
  reviewPrivacyRequest,
} from "@/lib/privacy-requests";
import { unsubscribeEmailAsAdmin } from "@/lib/email-subscriptions";
import { emailSchema, normalizeEmail } from "@/lib/validation";

type Update = Partial<typeof legalSettings.$inferInsert>;

const AUTOMATED_RETENTION_KEYS = new Set(["analytics_events", "analytics_aggregates"]);

function str(formData: FormData, key: string, max = 500): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function fail(message: string): never {
  redirect(`/admin/legal?error=${encodeURIComponent(message)}`);
}

function saved(message: string): never {
  redirect(`/admin/legal?saved=${encodeURIComponent(message)}`);
}

function revalidateLegal(): void {
  revalidatePath("/", "layout");
  revalidatePath("/legal", "layout");
  revalidatePath("/admin/legal");
}

function validDate(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function optionalEmail(value: string, label: string): string {
  if (!value) return "";
  const parsed = emailSchema.safeParse(value);
  if (!parsed.success) fail(`${label} must be a valid email address.`);
  return parsed.data;
}

async function setReadinessStatus(
  db: Awaited<ReturnType<typeof getDb>>,
  itemKey: string,
  status: string,
  notes: string,
  actorId: string,
): Promise<void> {
  await db
    .update(legalReadinessItems)
    .set({ status, notes, updatedBy: actorId, updatedAt: new Date() })
    .where(eq(legalReadinessItems.itemKey, itemKey));
}

export async function saveBusinessInfoAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/legal");
  if (!checked(formData, "confirmVerified")) {
    fail("Confirm that the business details are accurate and owner-provided before saving.");
  }

  const legalName = str(formData, "legalName", 200);
  const tradingName = str(formData, "tradingName", 200);
  const registrationNumber = str(formData, "registrationNumber", 100);
  const registeredAddress = str(formData, "registeredAddress", 1000);
  const businessCountry = str(formData, "businessCountry", 100);
  const contactEmail = optionalEmail(str(formData, "contactEmail", 254).toLowerCase(), "Contact email");
  const supportEmail = optionalEmail(str(formData, "supportEmail", 254).toLowerCase(), "Support email");
  const phone = str(formData, "phone", 80);
  const legalContact = str(formData, "legalContact", 300);
  const privacyContact = optionalEmail(
    str(formData, "privacyContact", 254).toLowerCase(),
    "Privacy contact",
  );
  const jurisdiction = str(formData, "jurisdiction", 200);
  const vatNumber = str(formData, "vatNumber", 100);
  const taxDetails = str(formData, "taxDetails", 1000);
  const minimumAgeRaw = str(formData, "minimumAge", 4);
  const minimumAgeNote = str(formData, "minimumAgeNote", 1000);

  let minimumAge: number | null = null;
  if (minimumAgeRaw) {
    const value = Number(minimumAgeRaw);
    if (!Number.isInteger(value) || value < 1 || value > 120) {
      fail("Minimum age must be a whole number between 1 and 120, or blank.");
    }
    minimumAge = value;
  }

  const db = await getDb();
  await getOrCreateLegalSettings(db);
  const now = new Date();
  await db
    .update(legalSettings)
    .set({
      legalName,
      tradingName,
      registrationNumber,
      registeredAddress,
      businessCountry,
      contactEmail,
      supportEmail,
      phone,
      legalContact,
      privacyContact,
      jurisdiction,
      vatNumber,
      taxDetails,
      minimumAge,
      minimumAgeNote,
      updatedAt: now,
    })
    .where(eq(legalSettings.id, "legal_global"));

  const settings = await getOrCreateLegalSettings(db);
  const missing = businessProfileMissing(settings);
  await setReadinessStatus(
    db,
    "business_identity",
    missing.length === 0 ? "complete" : "needs_owner_information",
    missing.length === 0
      ? "Verified business details supplied by the owner. Legal review is still required for the governing law and consumer terms."
      : `Missing required owner information: ${missing.map((entry) => entry.label).join(", ")}.`,
    admin.id,
  );

  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "legal.business.updated",
    entityType: "legal_settings",
    entityId: "legal_global",
    metadata: {
      legalNameConfigured: Boolean(legalName),
      addressConfigured: Boolean(registeredAddress),
      contactConfigured: Boolean(contactEmail),
      supportConfigured: Boolean(supportEmail),
      privacyContactConfigured: Boolean(privacyContact),
      jurisdictionConfigured: Boolean(jurisdiction),
      minimumAgeConfigured: minimumAge !== null,
      missingRequiredFields: missing.length,
    },
  });

  revalidateLegal();
  saved(
    missing.length === 0
      ? "Business information saved. Legal documents still require review and effective dates."
      : `Business information saved. ${missing.length} required field(s) remain blank.`,
  );
}

export async function saveDocumentSettingsAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/legal");
  const db = await getDb();
  await getOrCreateLegalSettings(db);
  const updates: Update = { updatedAt: new Date() };
  const versions: Array<{ key: LegalDocumentKey; version: string; status: string; effective: string | null }> = [];

  for (const document of LEGAL_DOCUMENTS) {
    const version = str(formData, `${document.key}Version`, 80);
    const status = str(formData, `${document.key}Status`, 40);
    const effective = str(formData, `${document.key}EffectiveDate`, 10) || null;
    if (!version) fail(`${document.title} needs a version.`);
    if (!isLegalReviewStatus(status)) fail(`${document.title} has an unsupported review status.`);
    if (!validDate(effective ?? "")) fail(`${document.title} has an invalid effective date.`);
    versions.push({ key: document.key, version, status, effective });

    switch (document.key) {
      case "privacy":
        updates.privacyVersion = version;
        updates.privacyReviewStatus = status;
        updates.privacyEffectiveDate = effective;
        break;
      case "terms":
        updates.termsVersion = version;
        updates.termsReviewStatus = status;
        updates.termsEffectiveDate = effective;
        break;
      case "refunds":
        updates.refundsVersion = version;
        updates.refundsReviewStatus = status;
        updates.refundsEffectiveDate = effective;
        break;
      case "cookies":
        updates.cookiesVersion = version;
        updates.cookiesReviewStatus = status;
        updates.cookiesEffectiveDate = effective;
        break;
      case "accessibility":
        updates.accessibilityVersion = version;
        updates.accessibilityReviewStatus = status;
        updates.accessibilityEffectiveDate = effective;
        break;
    }
  }

  await db.update(legalSettings).set(updates).where(eq(legalSettings.id, "legal_global"));

  for (const entry of versions) {
    await db
      .insert(legalDocumentVersions)
      .values({
        id: newId("legalver"),
        documentKey: entry.key,
        version: entry.version,
        effectiveDate: entry.effective,
        status: entry.status,
        summary: "Version metadata recorded by an administrator.",
        updatedBy: admin.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [legalDocumentVersions.documentKey, legalDocumentVersions.version],
      });
  }

  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "legal.documents.updated",
    entityType: "legal_settings",
    entityId: "legal_global",
    metadata: {
      versions: versions.map((entry) => `${entry.key}:${entry.version}:${entry.status}`).join(","),
    },
  });

  revalidateLegal();
  saved("Document versions and review statuses saved.");
}

export async function saveCookieConfigAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/legal");
  const cookieConsentVersion = str(formData, "cookieConsentVersion", 40);
  const marketingConsentVersion = str(formData, "marketingConsentVersion", 40);
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(cookieConsentVersion)) {
    fail("Cookie consent version must use letters, numbers, dots, underscores, or hyphens.");
  }
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(marketingConsentVersion)) {
    fail("Marketing consent version must use letters, numbers, dots, underscores, or hyphens.");
  }

  const db = await getDb();
  await getOrCreateLegalSettings(db);
  await db
    .update(legalSettings)
    .set({ cookieConsentVersion, marketingConsentVersion, updatedAt: new Date() })
    .where(eq(legalSettings.id, "legal_global"));

  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "legal.consent_config.updated",
    entityType: "legal_settings",
    entityId: "legal_global",
    metadata: { cookieConsentVersion, marketingConsentVersion },
  });

  revalidateLegal();
  saved(
    "Consent versions saved. Visitors with an older version will be asked for a fresh choice before analytics resumes.",
  );
}

export async function saveThirdPartyAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/legal");
  const serviceKey = str(formData, "serviceKey", 80);
  if (!serviceKey) fail("The third-party service key is missing.");
  const provider = str(formData, "provider", 200);
  const purpose = str(formData, "purpose", 1000);
  const status = str(formData, "status", 60);
  const internationalTransfer = str(formData, "internationalTransfer", 1000);
  if (!provider || !purpose) fail("Third-party provider and purpose are required.");
  if (!status) fail("Third-party status is required.");

  const db = await getDb();
  const existing = await db
    .select({ id: legalThirdParties.id })
    .from(legalThirdParties)
    .where(eq(legalThirdParties.serviceKey, serviceKey))
    .limit(1);
  if (!existing[0]) fail("Third-party service not found.");

  await db
    .update(legalThirdParties)
    .set({
      provider,
      purpose,
      dataShared: str(formData, "dataShared", 2000),
      cookies: str(formData, "cookies", 1000),
      runsBeforeConsent: checked(formData, "runsBeforeConsent"),
      necessary: checked(formData, "necessary"),
      optional: checked(formData, "optional"),
      internationalTransfer,
      configurationNotes: str(formData, "configurationNotes", 4000),
      status,
      updatedAt: new Date(),
    })
    .where(eq(legalThirdParties.serviceKey, serviceKey));

  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "legal.third_party.updated",
    entityType: "legal_third_party",
    entityId: serviceKey,
    metadata: { status, runsBeforeConsent: checked(formData, "runsBeforeConsent") },
  });

  revalidateLegal();
  saved(`Third-party inventory updated for ${serviceKey}.`);
}

export async function saveRetentionAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/legal");
  const dataKey = str(formData, "dataKey", 80);
  if (!dataKey) fail("The retention data key is missing.");
  const retentionRaw = str(formData, "retentionDays", 6);
  let retentionDays: number | null = null;
  if (retentionRaw) {
    const value = Number(retentionRaw);
    if (!Number.isInteger(value) || value < 0 || value > 36500) {
      fail("Retention days must be a whole number between 0 and 36500, or blank.");
    }
    retentionDays = value;
  }
  const basis = str(formData, "basis", 120);
  if (!basis) fail("A retention basis is required.");

  const supportsAutomation = AUTOMATED_RETENTION_KEYS.has(dataKey);
  const automated = supportsAutomation && checked(formData, "automated");
  const enabled = supportsAutomation && checked(formData, "enabled");
  if (!supportsAutomation && (checked(formData, "automated") || checked(formData, "enabled"))) {
    fail(
      "Automated cleanup is only implemented for raw analytics events and aggregated analytics. Keep other categories disabled until a job exists.",
    );
  }
  if (enabled && retentionDays === null) {
    fail("An enabled automated retention rule needs a retention period in days.");
  }

  const db = await getDb();
  const existing = await db
    .select({ id: dataRetentionSettings.id })
    .from(dataRetentionSettings)
    .where(eq(dataRetentionSettings.dataKey, dataKey))
    .limit(1);
  if (!existing[0]) fail("Retention category not found.");

  await db
    .update(dataRetentionSettings)
    .set({
      retentionDays,
      basis,
      automated,
      enabled,
      notes: str(formData, "notes", 4000),
      updatedAt: new Date(),
    })
    .where(eq(dataRetentionSettings.dataKey, dataKey));

  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "legal.retention.updated",
    entityType: "data_retention_setting",
    entityId: dataKey,
    metadata: { retentionDays, automated, enabled, basis },
  });

  revalidateLegal();
  saved(`Retention settings updated for ${dataKey}.`);
}

export async function reviewPrivacyRequestAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/legal");
  const requestId = str(formData, "requestId", 80);
  const action = str(formData, "reviewAction", 20);
  if (!requestId) fail("The privacy request ID is missing.");
  if (!["verify", "reject", "complete", "cancel"].includes(action)) {
    fail("Unsupported privacy request action.");
  }

  const db = await getDb();
  const request = await getPrivacyRequest(db, requestId);
  if (!request) fail("Privacy request not found.");

  if (
    action === "complete" &&
    request.requestType === "deletion" &&
    !checked(formData, "confirmDeletion")
  ) {
    fail("Confirm the retention-aware deletion before completing a deletion request.");
  }

  try {
    const result = await reviewPrivacyRequest(db, {
      requestId,
      adminId: admin.id,
      action: action as "verify" | "reject" | "complete" | "cancel",
      notes: str(formData, "adminNotes", 4000),
      resolution: str(formData, "resolution", 4000),
      rejectionReason: str(formData, "rejectionReason", 1000),
    });
    revalidateLegal();
    saved(
      result.deleted
        ? `Privacy request ${request.reference} completed. The account profile was anonymised and financial records were retained.`
        : `Privacy request ${request.reference} updated: ${action}.`,
    );
  } catch (error) {
    fail(
      error instanceof Error
        ? error.message
        : "The privacy request could not be updated.",
    );
  }
}

export async function adminUnsubscribeAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/legal");
  const email = normalizeEmail(str(formData, "email", 254));
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) fail("Enter a valid email address to unsubscribe.");
  const reason = str(formData, "reason", 200) || "admin_action";

  const db = await getDb();
  const subscription = await unsubscribeEmailAsAdmin(db, parsed.data, reason);
  if (!subscription) fail("No email subscription was found for that address.");

  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "email.admin_unsubscribe",
    entityType: "email_subscription",
    entityId: subscription.id,
    metadata: { reason },
  });

  revalidateLegal();
  saved(`Subscription for ${parsed.data} is now unsubscribed.`);
}

export async function saveAccessibilityReviewAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/legal");
  const area = str(formData, "area", 80);
  const status = str(formData, "status", 60);
  const checkedBy = str(formData, "checkedBy", 120);
  const findings = str(formData, "findings", 4000);
  if (!area) fail("The accessibility review area is missing.");
  if (!isLegalReviewStatus(status)) fail("Unsupported accessibility review status.");
  if (status === "complete" && (!checkedBy || !findings)) {
    fail("A completed accessibility review needs a reviewer name and findings.");
  }

  const db = await getDb();
  const existing = await db
    .select({ id: accessibilityReviews.id })
    .from(accessibilityReviews)
    .where(eq(accessibilityReviews.area, area))
    .limit(1);
  if (!existing[0]) fail("Accessibility review area not found.");

  await db
    .update(accessibilityReviews)
    .set({
      status,
      findings,
      checkedBy: checkedBy || null,
      checkedAt: status === "complete" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(accessibilityReviews.area, area));

  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "legal.accessibility.updated",
    entityType: "accessibility_review",
    entityId: area,
    metadata: { status, checkedByConfigured: Boolean(checkedBy) },
  });

  revalidateLegal();
  saved(`Accessibility review updated for ${area}.`);
}

export async function saveAssetAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/legal");
  const assetKey = str(formData, "assetKey", 80);
  const status = str(formData, "status", 60);
  const licenseName = str(formData, "licenseName", 200);
  const licenseUrl = str(formData, "licenseUrl", 500);
  if (!assetKey) fail("The asset key is missing.");
  const normalizedStatus = status as "complete" | "needs_owner_information" | "needs_legal_review" | "needs_technical_implementation" | "not_applicable" | "not_verified" | "external_configuration_required";
  if (!isLegalReviewStatus(status)) fail("Unsupported asset status.");
  if (normalizedStatus === "complete" && !licenseName && !licenseUrl) {
    fail("A completed asset review needs a license reference.");
  }

  const db = await getDb();
  const existing = await db
    .select({ id: assetLicenses.id })
    .from(assetLicenses)
    .where(eq(assetLicenses.assetKey, assetKey))
    .limit(1);
  if (!existing[0]) fail("Asset not found.");

  await db
    .update(assetLicenses)
    .set({
      sourceUrl: str(formData, "sourceUrl", 500),
      licenseName,
      licenseUrl,
      attribution: str(formData, "attribution", 1000),
      commercialUse: str(formData, "commercialUse", 60) || "unknown",
      redistribution: str(formData, "redistribution", 60) || "unknown",
      status,
      notes: str(formData, "notes", 4000),
      updatedAt: new Date(),
    })
    .where(eq(assetLicenses.assetKey, assetKey));

  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "legal.asset.updated",
    entityType: "asset_license",
    entityId: assetKey,
    metadata: { status, licenseName },
  });

  revalidateLegal();
  saved(`Asset register updated for ${assetKey}.`);
}

export async function saveReadinessAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/legal");
  const itemKey = str(formData, "itemKey", 80);
  const status = str(formData, "status", 60);
  const owner = str(formData, "owner", 120);
  const notes = str(formData, "notes", 4000);
  if (!itemKey) fail("The readiness item key is missing.");
  if (!isLegalReviewStatus(status)) fail("Unsupported readiness status.");
  if (status === "complete" && !notes) {
    fail("A completed readiness item needs a note describing the evidence.");
  }

  const db = await getDb();
  const existing = await db
    .select({ id: legalReadinessItems.id })
    .from(legalReadinessItems)
    .where(eq(legalReadinessItems.itemKey, itemKey))
    .limit(1);
  if (!existing[0]) fail("Readiness item not found.");

  await db
    .update(legalReadinessItems)
    .set({ status, owner, notes, updatedBy: admin.id, updatedAt: new Date() })
    .where(eq(legalReadinessItems.itemKey, itemKey));

  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "legal.readiness.updated",
    entityType: "legal_readiness_item",
    entityId: itemKey,
    metadata: { status, owner },
  });

  revalidateLegal();
  saved(`Readiness item updated for ${itemKey}.`);
}
