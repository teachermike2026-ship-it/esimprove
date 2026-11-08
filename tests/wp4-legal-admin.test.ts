import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import type { DatabaseHandle } from "@/lib/db/client";
import {
  accessibilityReviews,
  assetLicenses,
  auditLogs,
  dataRetentionSettings,
  emailSubscriptions,
  legalDocumentVersions,
  legalReadinessItems,
  legalSettings,
  legalThirdParties,
  privacyRequests,
  sessions,
  users,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { createSession } from "@/lib/auth/session";
import {
  createPrivacyRequest,
  findPrivacyRequestForStatus,
} from "@/lib/privacy-requests";
import {
  createEmailSubscription,
  findSubscriptionByUnsubscribeToken,
  unsubscribeByToken,
} from "@/lib/email-subscriptions";
import { LEGAL_DOCUMENTS } from "@/lib/legal";
import { makeTestDb } from "./helpers/db";

const mockState = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name.endsWith("_session") && mockState.token
        ? { name, value: mockState.token }
        : undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
  headers: async () => new Headers({ "user-agent": "vitest" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

type RedirectError = { digest?: string; message?: string };

async function expectRedirect(action: () => Promise<unknown>, fragment: string) {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeTruthy();
  const value = caught as RedirectError;
  const text = `${value.digest ?? ""} ${value.message ?? ""} ${String(caught)}`;
  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    // Keep the raw text when a redirect message contains a stray percent sign.
  }
  expect(`${text} ${decoded}`.toLowerCase()).toContain(fragment.toLowerCase());
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function auditCount(handle: DatabaseHandle): Promise<number> {
  const rows = await handle.db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs);
  return Number(rows[0]!.count);
}

describe("WP4 legal administration", () => {
  let handle: DatabaseHandle;
  let adminUserId: string;
  let customerUserId: string;
  let deletionUserId: string;
  const deletionEmail = "wp4-deletion@example.test";

  async function signInAsAdmin(): Promise<void> {
    mockState.token = (
      await createSession(handle.db, adminUserId, { ttlMinutes: 60 })
    ).token;
  }

  async function signInAsCustomer(): Promise<void> {
    mockState.token = (
      await createSession(handle.db, customerUserId, { ttlMinutes: 60 })
    ).token;
  }

  beforeAll(async () => {
    handle = await makeTestDb();
    const [admin] = await handle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "admin@demo.local"))
      .limit(1);
    adminUserId = admin!.id;

    customerUserId = newId("user");
    await handle.db.insert(users).values({
      id: customerUserId,
      email: "wp4-customer@example.test",
      name: "WP4 Customer",
      passwordHash: "unused",
      role: "customer",
    });

    deletionUserId = newId("user");
    await handle.db.insert(users).values({
      id: deletionUserId,
      email: deletionEmail,
      name: "Deletion Target",
      passwordHash: "unused",
      role: "customer",
    });

    (
      globalThis as typeof globalThis & {
        __esimproveDbPromise?: Promise<DatabaseHandle>;
      }
    ).__esimproveDbPromise = Promise.resolve(handle);
  });

  afterAll(async () => {
    const globalWithDb = globalThis as typeof globalThis & {
      __esimproveDbPromise?: Promise<DatabaseHandle>;
    };
    globalWithDb.__esimproveDbPromise = undefined;
    await handle.close();
  });

  describe("authorization", () => {
    it("rejects anonymous callers from all ten legal actions without writing data", async () => {
      mockState.token = null;
      const actions = await import("@/app/admin/legal/actions");
      const beforeAudits = await auditCount(handle);
      const beforeSettings = (
        await handle.db
          .select()
          .from(legalSettings)
          .where(eq(legalSettings.id, "legal_global"))
      )[0];

      const attempts: Array<[string, () => Promise<unknown>]> = [
        ["saveBusinessInfoAction", () => actions.saveBusinessInfoAction(form({}))],
        ["saveDocumentSettingsAction", () => actions.saveDocumentSettingsAction(form({}))],
        ["saveCookieConfigAction", () => actions.saveCookieConfigAction(form({}))],
        ["saveThirdPartyAction", () => actions.saveThirdPartyAction(form({}))],
        ["saveRetentionAction", () => actions.saveRetentionAction(form({}))],
        ["reviewPrivacyRequestAction", () => actions.reviewPrivacyRequestAction(form({}))],
        ["adminUnsubscribeAction", () => actions.adminUnsubscribeAction(form({}))],
        ["saveAccessibilityReviewAction", () => actions.saveAccessibilityReviewAction(form({}))],
        ["saveAssetAction", () => actions.saveAssetAction(form({}))],
        ["saveReadinessAction", () => actions.saveReadinessAction(form({}))],
      ];

      for (const [, attempt] of attempts) {
        await expectRedirect(attempt, "/login");
      }

      expect(await auditCount(handle)).toBe(beforeAudits);
      const afterSettings = (
        await handle.db
          .select()
          .from(legalSettings)
          .where(eq(legalSettings.id, "legal_global"))
      )[0];
      expect(afterSettings).toEqual(beforeSettings);
    });

    it("rejects customer accounts from all ten legal actions without writing data", async () => {
      await signInAsCustomer();
      const actions = await import("@/app/admin/legal/actions");
      const beforeAudits = await auditCount(handle);

      const attempts: Array<[string, () => Promise<unknown>]> = [
        ["saveBusinessInfoAction", () => actions.saveBusinessInfoAction(form({}))],
        ["saveDocumentSettingsAction", () => actions.saveDocumentSettingsAction(form({}))],
        ["saveCookieConfigAction", () => actions.saveCookieConfigAction(form({}))],
        ["saveThirdPartyAction", () => actions.saveThirdPartyAction(form({}))],
        ["saveRetentionAction", () => actions.saveRetentionAction(form({}))],
        ["reviewPrivacyRequestAction", () => actions.reviewPrivacyRequestAction(form({}))],
        ["adminUnsubscribeAction", () => actions.adminUnsubscribeAction(form({}))],
        ["saveAccessibilityReviewAction", () => actions.saveAccessibilityReviewAction(form({}))],
        ["saveAssetAction", () => actions.saveAssetAction(form({}))],
        ["saveReadinessAction", () => actions.saveReadinessAction(form({}))],
      ];

      for (const [, attempt] of attempts) {
        await expectRedirect(attempt, "/portal");
      }

      expect(await auditCount(handle)).toBe(beforeAudits);
    });
  });

  describe("legal administration", () => {
    it("saves verified business details and records an audit entry", async () => {
      await signInAsAdmin();
      const { saveBusinessInfoAction } = await import("@/app/admin/legal/actions");

      await expectRedirect(
        () =>
          saveBusinessInfoAction(
            form({
              legalName: "WP4 Legal Ltd",
              tradingName: "WP4 Trading",
              registrationNumber: "REG-12345",
              registeredAddress: "1 Test Street\nLisbon\nPortugal",
              businessCountry: "Portugal",
              contactEmail: "contact@wp4.example",
              supportEmail: "support@wp4.example",
              privacyContact: "privacy@wp4.example",
              phone: "+351 000 000 000",
              legalContact: "Legal Team",
              jurisdiction: "Portugal",
              vatNumber: "PT000000000",
              taxDetails: "Test tax details",
              minimumAge: "18",
              minimumAgeNote: "Adults only",
              confirmVerified: "on",
            }),
          ),
        "saved=",
      );

      const [settings] = await handle.db
        .select()
        .from(legalSettings)
        .where(eq(legalSettings.id, "legal_global"));
      expect(settings!.legalName).toBe("WP4 Legal Ltd");
      expect(settings!.contactEmail).toBe("contact@wp4.example");
      expect(settings!.minimumAge).toBe(18);

      const [readiness] = await handle.db
        .select()
        .from(legalReadinessItems)
        .where(eq(legalReadinessItems.itemKey, "business_identity"));
      expect(readiness!.status).toBe("complete");

      const [audit] = await handle.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "legal.business.updated"));
      expect(audit!.actorType).toBe("admin");
      expect(audit!.actorId).toBe(adminUserId);
      expect(audit!.entityType).toBe("legal_settings");
      expect(audit!.metadata).toMatchObject({ outcome: "success" });
    });

    it("rejects business details without the verification confirmation", async () => {
      await signInAsAdmin();
      const { saveBusinessInfoAction } = await import("@/app/admin/legal/actions");
      const before = (
        await handle.db
          .select()
          .from(legalSettings)
          .where(eq(legalSettings.id, "legal_global"))
      )[0];

      await expectRedirect(
        () =>
          saveBusinessInfoAction(
            form({ legalName: "Should Not Save Ltd" }),
          ),
        "error=",
      );

      const after = (
        await handle.db
          .select()
          .from(legalSettings)
          .where(eq(legalSettings.id, "legal_global"))
      )[0];
      expect(after!.legalName).toBe(before!.legalName);
    });

    it("saves document versions and records version history", async () => {
      await signInAsAdmin();
      const { saveDocumentSettingsAction } = await import("@/app/admin/legal/actions");
      const values: Record<string, string> = {};
      for (const document of LEGAL_DOCUMENTS) {
        values[`${document.key}Version`] = "2026.11.08";
        values[`${document.key}Status`] = "needs_legal_review";
        values[`${document.key}EffectiveDate`] = "2026-11-08";
      }

      await expectRedirect(
        () => saveDocumentSettingsAction(form(values)),
        "saved=",
      );

      const [settings] = await handle.db
        .select()
        .from(legalSettings)
        .where(eq(legalSettings.id, "legal_global"));
      expect(settings!.privacyVersion).toBe("2026.11.08");
      expect(settings!.privacyEffectiveDate).toBe("2026-11-08");

      const [history] = await handle.db
        .select()
        .from(legalDocumentVersions)
        .where(
          and(
            eq(legalDocumentVersions.documentKey, "privacy"),
            eq(legalDocumentVersions.version, "2026.11.08"),
          ),
        );
      expect(history).toBeTruthy();
      expect(history!.updatedBy).toBe(adminUserId);

      const [audit] = await handle.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "legal.documents.updated"));
      expect(audit!.metadata).toMatchObject({ outcome: "success" });
    });

    it("rejects unsupported document review statuses", async () => {
      await signInAsAdmin();
      const { saveDocumentSettingsAction } = await import("@/app/admin/legal/actions");
      const values: Record<string, string> = {};
      for (const document of LEGAL_DOCUMENTS) {
        values[`${document.key}Version`] = "2026.11.09";
        values[`${document.key}Status`] = "definitely_not_a_status";
      }

      await expectRedirect(
        () => saveDocumentSettingsAction(form(values)),
        "unsupported review status",
      );

      const [settings] = await handle.db
        .select()
        .from(legalSettings)
        .where(eq(legalSettings.id, "legal_global"));
      expect(settings!.privacyVersion).toBe("2026.11.08");
    });

    it("saves consent versions and rejects invalid values", async () => {
      await signInAsAdmin();
      const { saveCookieConfigAction } = await import("@/app/admin/legal/actions");

      await expectRedirect(
        () =>
          saveCookieConfigAction(
            form({
              cookieConsentVersion: "2026.11.08-a",
              marketingConsentVersion: "2026.11.08-m",
            }),
          ),
        "saved=",
      );

      const [settings] = await handle.db
        .select()
        .from(legalSettings)
        .where(eq(legalSettings.id, "legal_global"));
      expect(settings!.cookieConsentVersion).toBe("2026.11.08-a");
      expect(settings!.marketingConsentVersion).toBe("2026.11.08-m");

      await expectRedirect(
        () =>
          saveCookieConfigAction(
            form({
              cookieConsentVersion: "not valid!",
              marketingConsentVersion: "2026.11.08-m",
            }),
          ),
        "error=",
      );
    });

    it("updates third-party inventory records", async () => {
      await signInAsAdmin();
      const { saveThirdPartyAction } = await import("@/app/admin/legal/actions");

      await expectRedirect(
        () =>
          saveThirdPartyAction(
            form({
              serviceKey: "google_analytics_4",
              provider: "Google Analytics 4 (reviewed)",
              status: "optional_not_configured",
              purpose: "Optional, consent-gated traffic measurement.",
              dataShared: "Page views and device information.",
              cookies: "_ga only after analytics consent.",
              internationalTransfer: "Confirm transfer mechanism.",
              optional: "on",
              configurationNotes: "Not configured in this build.",
            }),
          ),
        "saved=",
      );

      const [thirdParty] = await handle.db
        .select()
        .from(legalThirdParties)
        .where(eq(legalThirdParties.serviceKey, "google_analytics_4"));
      expect(thirdParty!.provider).toBe("Google Analytics 4 (reviewed)");
      expect(thirdParty!.optional).toBe(true);
      expect(thirdParty!.runsBeforeConsent).toBe(false);

      const [audit] = await handle.db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, "legal.third_party.updated"),
            eq(auditLogs.entityId, "google_analytics_4"),
          ),
        );
      expect(audit!.actorId).toBe(adminUserId);
    });

    it("validates retention periods and only enables implemented automation", async () => {
      await signInAsAdmin();
      const { saveRetentionAction } = await import("@/app/admin/legal/actions");

      await expectRedirect(
        () =>
          saveRetentionAction(
            form({
              dataKey: "analytics_events",
              retentionDays: "400",
              basis: "technical_default",
              automated: "on",
              enabled: "on",
              notes: "Owner-approved analytics window.",
            }),
          ),
        "saved=",
      );

      const [retention] = await handle.db
        .select()
        .from(dataRetentionSettings)
        .where(eq(dataRetentionSettings.dataKey, "analytics_events"));
      expect(retention!.retentionDays).toBe(400);
      expect(retention!.enabled).toBe(true);

      await expectRedirect(
        () =>
          saveRetentionAction(
            form({
              dataKey: "analytics_events",
              retentionDays: "0",
              basis: "technical_default",
            }),
          ),
        "between 1 and 36500",
      );

      await expectRedirect(
        () =>
          saveRetentionAction(
            form({
              dataKey: "accounts",
              retentionDays: "730",
              basis: "proposed_operational_default",
              automated: "on",
              enabled: "on",
            }),
          ),
        "only implemented for raw analytics",
      );

      const [accounts] = await handle.db
        .select()
        .from(dataRetentionSettings)
        .where(eq(dataRetentionSettings.dataKey, "accounts"));
      expect(accounts!.automated).toBe(false);
      expect(accounts!.enabled).toBe(false);
    });

    it("manages accessibility reviews and requires evidence for completion", async () => {
      await signInAsAdmin();
      const { saveAccessibilityReviewAction } = await import(
        "@/app/admin/legal/actions"
      );

      await expectRedirect(
        () =>
          saveAccessibilityReviewAction(
            form({
              area: "public_pages",
              status: "complete",
              checkedBy: "WP4 Reviewer",
              findings: "Keyboard and screen-reader checks completed.",
            }),
          ),
        "saved=",
      );

      const [review] = await handle.db
        .select()
        .from(accessibilityReviews)
        .where(eq(accessibilityReviews.area, "public_pages"));
      expect(review!.status).toBe("complete");
      expect(review!.checkedBy).toBe("WP4 Reviewer");
      expect(review!.checkedAt).toBeTruthy();

      await expectRedirect(
        () =>
          saveAccessibilityReviewAction(
            form({
              area: "forms_and_checkout",
              status: "complete",
              checkedBy: "WP4 Reviewer",
              findings: "",
            }),
          ),
        "needs a reviewer name and findings",
      );
    });

    it("manages asset licensing, including seeded verified statuses", async () => {
      await signInAsAdmin();
      const { saveAssetAction } = await import("@/app/admin/legal/actions");

      await expectRedirect(
        () =>
          saveAssetAction(
            form({
              assetKey: "font_manrope",
              status: "verified",
              licenseName: "SIL Open Font License 1.1",
              licenseUrl: "https://openfontlicense.org/open-font-license-official-text/",
              commercialUse: "allowed",
              redistribution: "allowed_with_license",
              attribution: "Not required by the license.",
              notes: "Verified during WP4.",
            }),
          ),
        "saved=",
      );

      const [asset] = await handle.db
        .select()
        .from(assetLicenses)
        .where(eq(assetLicenses.assetKey, "font_manrope"));
      expect(asset!.status).toBe("verified");
      expect(asset!.licenseName).toContain("SIL Open Font License");

      await expectRedirect(
        () =>
          saveAssetAction(
            form({
              assetKey: "brand_mark",
              status: "complete",
              licenseName: "",
              licenseUrl: "",
              commercialUse: "unknown",
              redistribution: "unknown",
            }),
          ),
        "needs a license reference",
      );

      const [brand] = await handle.db
        .select()
        .from(assetLicenses)
        .where(eq(assetLicenses.assetKey, "brand_mark"));
      expect(brand!.status).not.toBe("complete");
    });

    it("updates readiness items and requires evidence for completion", async () => {
      await signInAsAdmin();
      const { saveReadinessAction } = await import("@/app/admin/legal/actions");

      await expectRedirect(
        () =>
          saveReadinessAction(
            form({
              itemKey: "production_migration",
              status: "complete",
              owner: "Technical",
              notes: "Migration replayed against a disposable database in WP3.",
            }),
          ),
        "saved=",
      );

      const [item] = await handle.db
        .select()
        .from(legalReadinessItems)
        .where(eq(legalReadinessItems.itemKey, "production_migration"));
      expect(item!.status).toBe("complete");
      expect(item!.updatedBy).toBe(adminUserId);

      await expectRedirect(
        () =>
          saveReadinessAction(
            form({
              itemKey: "asset_licensing",
              status: "complete",
              owner: "Owner",
              notes: "",
            }),
          ),
        "needs a note describing the evidence",
      );
    });
  });

  describe("privacy requests", () => {
    it("supports submission and status lookup without leaking other requesters", async () => {
      const created = await createPrivacyRequest(handle.db, {
        requestType: "access",
        email: "wp4-requester@example.test",
        name: "WP4 Requester",
        details: "Please provide a copy of my data.",
      });
      expect(created.request.reference).toMatch(/^PR-/);
      expect(created.request.status).toBe("pending_verification");
      expect(created.verificationToken).toBeTruthy();

      const found = await findPrivacyRequestForStatus(
        handle.db,
        created.request.reference,
        "wp4-requester@example.test",
      );
      expect(found!.id).toBe(created.request.id);

      const wrongEmail = await findPrivacyRequestForStatus(
        handle.db,
        created.request.reference,
        "someone-else@example.test",
      );
      expect(wrongEmail).toBeNull();

      const unknownReference = await findPrivacyRequestForStatus(
        handle.db,
        "PR-000000-UNKNOWN",
        "wp4-requester@example.test",
      );
      expect(unknownReference).toBeNull();
    });

    it("denies unauthorized privacy reviews without changing the request", async () => {
      const created = await createPrivacyRequest(handle.db, {
        requestType: "access",
        email: "wp4-unauthorized@example.test",
      });
      const beforeAudits = await auditCount(handle);
      const { reviewPrivacyRequestAction } = await import(
        "@/app/admin/legal/actions"
      );

      mockState.token = null;
      await expectRedirect(
        () =>
          reviewPrivacyRequestAction(
            form({ requestId: created.request.id, reviewAction: "verify" }),
          ),
        "/login",
      );

      await signInAsCustomer();
      await expectRedirect(
        () =>
          reviewPrivacyRequestAction(
            form({ requestId: created.request.id, reviewAction: "verify" }),
          ),
        "/portal",
      );

      const [row] = await handle.db
        .select()
        .from(privacyRequests)
        .where(eq(privacyRequests.id, created.request.id));
      expect(row!.identityStatus).toBe("unverified");
      expect(row!.status).toBe("pending_verification");
      expect(await auditCount(handle)).toBe(beforeAudits);
    });

    it("verifies identity, completes a request, and blocks duplicate decisions", async () => {
      const created = await createPrivacyRequest(handle.db, {
        requestType: "access",
        email: "wp4-access@example.test",
        name: "Access Requester",
        details: "Send me my data.",
      });
      await signInAsAdmin();
      const { reviewPrivacyRequestAction } = await import(
        "@/app/admin/legal/actions"
      );

      await expectRedirect(
        () =>
          reviewPrivacyRequestAction(
            form({
              requestId: created.request.id,
              reviewAction: "verify",
              adminNotes: "Identity checked out of band.",
            }),
          ),
        "saved=",
      );

      let [row] = await handle.db
        .select()
        .from(privacyRequests)
        .where(eq(privacyRequests.id, created.request.id));
      expect(row!.identityStatus).toBe("verified");
      expect(row!.status).toBe("in_review");
      expect(row!.handledBy).toBe(adminUserId);
      expect(row!.verifiedAt).toBeTruthy();

      const [verifyAudit] = await handle.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "privacy.request.verified"));
      expect(verifyAudit!.entityId).toBe(created.request.id);
      expect(verifyAudit!.metadata).toMatchObject({ outcome: "success" });

      await expectRedirect(
        () =>
          reviewPrivacyRequestAction(
            form({
              requestId: created.request.id,
              reviewAction: "verify",
            }),
          ),
        "already verified",
      );

      await expectRedirect(
        () =>
          reviewPrivacyRequestAction(
            form({
              requestId: created.request.id,
              reviewAction: "complete",
              resolution: "Data export delivered through the secure support channel.",
            }),
          ),
        "saved=",
      );

      [row] = await handle.db
        .select()
        .from(privacyRequests)
        .where(eq(privacyRequests.id, created.request.id));
      expect(row!.status).toBe("completed");
      expect(row!.resolution).toContain("secure support channel");
      expect(row!.completedAt).toBeTruthy();

      const auditsBeforeDuplicate = await auditCount(handle);
      await expectRedirect(
        () =>
          reviewPrivacyRequestAction(
            form({
              requestId: created.request.id,
              reviewAction: "reject",
              rejectionReason: "Should not be applied.",
            }),
          ),
        "already closed",
      );
      expect(await auditCount(handle)).toBe(auditsBeforeDuplicate);

      [row] = await handle.db
        .select()
        .from(privacyRequests)
        .where(eq(privacyRequests.id, created.request.id));
      expect(row!.status).toBe("completed");

      const [completeAudit] = await handle.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "privacy.request.completed"));
      expect(completeAudit!.entityId).toBe(created.request.id);
      expect(completeAudit!.actorId).toBe(adminUserId);
      expect(completeAudit!.metadata).toMatchObject({ outcome: "success" });
    });

    it("requires a rejection reason and keeps free text out of the audit trail", async () => {
      const created = await createPrivacyRequest(handle.db, {
        requestType: "other",
        email: "wp4-reject@example.test",
      });
      await signInAsAdmin();
      const { reviewPrivacyRequestAction } = await import(
        "@/app/admin/legal/actions"
      );

      await expectRedirect(
        () =>
          reviewPrivacyRequestAction(
            form({ requestId: created.request.id, reviewAction: "reject" }),
          ),
        "rejection reason is required",
      );

      const reason = "Request does not identify a valid data subject.";
      await expectRedirect(
        () =>
          reviewPrivacyRequestAction(
            form({
              requestId: created.request.id,
              reviewAction: "reject",
              rejectionReason: reason,
            }),
          ),
        "saved=",
      );

      const [row] = await handle.db
        .select()
        .from(privacyRequests)
        .where(eq(privacyRequests.id, created.request.id));
      expect(row!.status).toBe("rejected");
      expect(row!.rejectionReason).toBe(reason);

      const [audit] = await handle.db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, "privacy.request.rejected"),
            eq(auditLogs.entityId, created.request.id),
          ),
        );
      expect(audit!.metadata).toMatchObject({
        rejectionReasonRecorded: true,
        outcome: "success",
      });
      expect(JSON.stringify(audit!.metadata)).not.toContain(reason);
    });

    it("refuses to complete an unverified request, including deletion", async () => {
      const created = await createPrivacyRequest(handle.db, {
        requestType: "deletion",
        email: "wp4-unverified-delete@example.test",
      });
      await signInAsAdmin();
      const { reviewPrivacyRequestAction } = await import(
        "@/app/admin/legal/actions"
      );

      await expectRedirect(
        () =>
          reviewPrivacyRequestAction(
            form({
              requestId: created.request.id,
              reviewAction: "complete",
              confirmDeletion: "on",
            }),
          ),
        "Identity must be verified",
      );

      const [row] = await handle.db
        .select()
        .from(privacyRequests)
        .where(eq(privacyRequests.id, created.request.id));
      expect(row!.status).toBe("pending_verification");
    });

    it("performs retention-aware deletion only after explicit confirmation", async () => {
      await createSession(handle.db, deletionUserId, { ttlMinutes: 60 });
      const subscription = await createEmailSubscription(handle.db, {
        email: deletionEmail,
        userId: deletionUserId,
        source: "wp4-test",
        consentVersion: "2026.11.08",
      });
      const created = await createPrivacyRequest(handle.db, {
        requestType: "deletion",
        email: deletionEmail,
        userId: deletionUserId,
        authenticatedEmail: deletionEmail,
        details: "Delete my account.",
      });
      expect(created.request.identityStatus).toBe("verified");

      await signInAsAdmin();
      const { reviewPrivacyRequestAction } = await import(
        "@/app/admin/legal/actions"
      );

      await expectRedirect(
        () =>
          reviewPrivacyRequestAction(
            form({
              requestId: created.request.id,
              reviewAction: "complete",
              resolution: "Deletion approved.",
            }),
          ),
        "Confirm the retention-aware deletion",
      );

      let [user] = await handle.db
        .select()
        .from(users)
        .where(eq(users.id, deletionUserId));
      expect(user!.email).toBe(deletionEmail);

      await expectRedirect(
        () =>
          reviewPrivacyRequestAction(
            form({
              requestId: created.request.id,
              reviewAction: "complete",
              confirmDeletion: "on",
              resolution: "Deletion approved after identity verification.",
            }),
          ),
        "saved=",
      );

      [user] = await handle.db
        .select()
        .from(users)
        .where(eq(users.id, deletionUserId));
      expect(user!.email).toBe(`deleted+${deletionUserId}@privacy.invalid`);
      expect(user!.name).toBe("Deleted account");
      expect(user!.passwordHash).not.toBe("unused");

      const remainingSessions = await handle.db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, deletionUserId));
      expect(remainingSessions).toHaveLength(0);

      const [subAfter] = await handle.db
        .select()
        .from(emailSubscriptions)
        .where(eq(emailSubscriptions.id, subscription.subscription.id));
      expect(subAfter!.status).toBe("unsubscribed");

      const [row] = await handle.db
        .select()
        .from(privacyRequests)
        .where(eq(privacyRequests.id, created.request.id));
      expect(row!.status).toBe("completed");

      const [audit] = await handle.db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, "privacy.request.deleted"),
            eq(auditLogs.entityId, created.request.id),
          ),
        );
      expect(audit!.actorId).toBe(adminUserId);
      expect(audit!.metadata).toMatchObject({
        deleted: true,
        retainedFinancialRecords: true,
        outcome: "success",
      });
    });
  });

  describe("unsubscribe", () => {
    it("unsubscribes with a valid token and is idempotent", async () => {
      const created = await createEmailSubscription(handle.db, {
        email: "wp4-token@example.test",
        source: "wp4-test",
        consentVersion: "2026.11.08",
      });

      expect(
        await findSubscriptionByUnsubscribeToken(handle.db, created.unsubscribeToken),
      ).toBeTruthy();
      expect(await findSubscriptionByUnsubscribeToken(handle.db, "short")).toBeNull();
      expect(
        await findSubscriptionByUnsubscribeToken(
          handle.db,
          "this-is-a-valid-length-but-not-a-real-token-000000",
        ),
      ).toBeNull();

      const first = await unsubscribeByToken(handle.db, created.unsubscribeToken);
      expect(first!.status).toBe("unsubscribed");
      expect(first!.unsubscribeReason).toBe("unsubscribe_link");
      const firstTimestamp = first!.unsubscribedAt;

      const second = await unsubscribeByToken(
        handle.db,
        created.unsubscribeToken,
        "second_click",
      );
      expect(second!.status).toBe("unsubscribed");
      expect(second!.unsubscribeReason).toBe("unsubscribe_link");
      expect(second!.unsubscribedAt?.getTime()).toBe(firstTimestamp?.getTime());

      const [row] = await handle.db
        .select()
        .from(emailSubscriptions)
        .where(eq(emailSubscriptions.id, created.subscription.id));
      expect(row!.status).toBe("unsubscribed");
      expect(row!.unsubscribeReason).toBe("unsubscribe_link");
    });

    it("unsubscribes an address through the administrator action", async () => {
      await createEmailSubscription(handle.db, {
        email: "wp4-admin-unsub@example.test",
        source: "wp4-test",
        consentVersion: "2026.11.08",
      });
      await signInAsAdmin();
      const { adminUnsubscribeAction } = await import("@/app/admin/legal/actions");

      await expectRedirect(
        () =>
          adminUnsubscribeAction(
            form({ email: "wp4-admin-unsub@example.test", reason: "owner_request" }),
          ),
        "saved=",
      );

      const [row] = await handle.db
        .select()
        .from(emailSubscriptions)
        .where(eq(emailSubscriptions.email, "wp4-admin-unsub@example.test"));
      expect(row!.status).toBe("unsubscribed");
      expect(row!.unsubscribeReason).toBe("owner_request");
      const timestamp = row!.unsubscribedAt;

      await expectRedirect(
        () =>
          adminUnsubscribeAction(
            form({ email: "wp4-admin-unsub@example.test", reason: "second_action" }),
          ),
        "saved=",
      );

      const [again] = await handle.db
        .select()
        .from(emailSubscriptions)
        .where(eq(emailSubscriptions.email, "wp4-admin-unsub@example.test"));
      expect(again!.unsubscribeReason).toBe("owner_request");
      expect(again!.unsubscribedAt?.getTime()).toBe(timestamp?.getTime());

      const [audit] = await handle.db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "email.admin_unsubscribe"));
      expect(audit!.actorId).toBe(adminUserId);
      expect(audit!.metadata).toMatchObject({ outcome: "success" });

      await expectRedirect(
        () => adminUnsubscribeAction(form({ email: "missing@example.test" })),
        "No email subscription was found",
      );
    });
  });

  describe("consent regression", () => {
    it("still returns 204 when tracking has no server-side consent evidence", async () => {
      const { POST } = await import("@/app/api/track/route");
      const response = await POST(
        new NextRequest("http://localhost:3000/api/track", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          },
          body: JSON.stringify({
            visitorId: "visitor_wp4nocons",
            sessionId: "session_wp4nocons",
            events: [{ type: "page_view", path: "/legal" }],
          }),
        }),
      );
      expect(response.status).toBe(204);
    });
  });
});
