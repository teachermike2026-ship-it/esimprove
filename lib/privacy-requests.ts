import { and, desc, eq, ne, notInArray } from "drizzle-orm";
import type { Database, DatabaseExecutor } from "@/lib/db/client";
import {
  emailSubscriptions,
  notifications,
  passwordResets,
  privacyRequests,
  sessions,
  userConsents,
  userPreferences,
  users,
  type PrivacyRequestRow,
} from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { hashToken, randomToken } from "@/lib/crypto";
import { newId } from "@/lib/ids";
import { normalizeEmail } from "@/lib/validation";

export const PRIVACY_REQUEST_TYPES = [
  "access",
  "correction",
  "deletion",
  "restriction",
  "portability",
  "objection",
  "other",
] as const;

export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

export const PRIVACY_REQUEST_STATUSES = [
  "pending_verification",
  "in_review",
  "completed",
  "rejected",
  "cancelled",
] as const;

export type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number];

const TYPE_LABELS: Record<PrivacyRequestType, string> = {
  access: "Access to my data",
  correction: "Correction of my data",
  deletion: "Deletion of my account or data",
  restriction: "Restriction of processing",
  portability: "Data portability",
  objection: "Objection to processing",
  other: "Other privacy request",
};

export function privacyRequestTypeLabel(type: string): string {
  return TYPE_LABELS[type as PrivacyRequestType] ?? "Privacy request";
}

export function privacyRequestStatusLabel(status: string): string {
  switch (status) {
    case "pending_verification":
      return "Pending identity verification";
    case "in_review":
      return "In review";
    case "completed":
      return "Completed";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function requestReference(now = new Date()): string {
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const suffix = randomToken(9).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
  return `PR-${stamp}-${suffix}`;
}

export interface CreatePrivacyRequestInput {
  requestType: PrivacyRequestType;
  email: string;
  name?: string;
  details?: string;
  userId?: string | null;
  authenticatedEmail?: string | null;
}

export interface CreatedPrivacyRequest {
  request: PrivacyRequestRow;
  /** Only returned for local email plumbing; never log or render this value publicly. */
  verificationToken: string | null;
}

export async function createPrivacyRequest(
  db: Database,
  input: CreatePrivacyRequestInput,
): Promise<CreatedPrivacyRequest> {
  if (!PRIVACY_REQUEST_TYPES.includes(input.requestType)) {
    throw new Error("Unsupported privacy request type");
  }
  const email = normalizeEmail(input.email);
  if (!email) throw new Error("An email address is required");

  let userId: string | null = null;
  let identityStatus = "unverified";
  let status: PrivacyRequestStatus = "pending_verification";
  let verifiedAt: Date | null = null;

  if (input.userId) {
    const rows = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    const user = rows[0];
    if (user && normalizeEmail(user.email) === email) {
      userId = user.id;
      identityStatus = "verified";
      status = "in_review";
      verifiedAt = new Date();
    }
  }

  const verificationToken = identityStatus === "verified" ? null : randomToken(32);
  const now = new Date();
  const id = newId("privacy");
  const request = {
    id,
    reference: requestReference(now),
    requestType: input.requestType,
    email,
    name: (input.name ?? "").trim().slice(0, 120),
    userId,
    details: (input.details ?? "").trim().slice(0, 4000),
    status,
    identityStatus,
    verificationTokenHash: verificationToken ? hashToken(verificationToken) : null,
    verifiedAt,
    resolution: "",
    rejectionReason: "",
    adminNotes: "",
    handledBy: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  await db.insert(privacyRequests).values(request);

  await recordAudit(db, {
    actorType: userId ? "user" : "anonymous",
    actorId: userId,
    action: "privacy.request.created",
    entityType: "privacy_request",
    entityId: id,
    metadata: { requestType: input.requestType, identityStatus, outcome: "success" },
  });

  return { request, verificationToken };
}

export async function listPrivacyRequests(
  db: Database,
  limit = 100,
): Promise<PrivacyRequestRow[]> {
  return db
    .select()
    .from(privacyRequests)
    .orderBy(desc(privacyRequests.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function getPrivacyRequest(
  db: DatabaseExecutor,
  id: string,
): Promise<PrivacyRequestRow | null> {
  const rows = await db
    .select()
    .from(privacyRequests)
    .where(eq(privacyRequests.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function findPrivacyRequestForStatus(
  db: Database,
  reference: string,
  email: string,
): Promise<PrivacyRequestRow | null> {
  const rows = await db
    .select()
    .from(privacyRequests)
    .where(
      and(
        eq(privacyRequests.reference, reference.trim().toUpperCase()),
        eq(privacyRequests.email, normalizeEmail(email)),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export interface PrivacyRequestReviewInput {
  requestId: string;
  adminId: string;
  action: "verify" | "reject" | "complete" | "cancel";
  notes?: string;
  resolution?: string;
  rejectionReason?: string;
  actorLabel?: string;
}

const CLOSED_PRIVACY_STATUSES = ["completed", "rejected", "cancelled"] as const;

export async function reviewPrivacyRequest(
  db: Database,
  input: PrivacyRequestReviewInput,
): Promise<{ request: PrivacyRequestRow; deleted: boolean }> {
  const now = new Date();
  const notes = (input.notes ?? "").trim().slice(0, 4000);

  return db.transaction(async (tx) => {
    const request = await getPrivacyRequest(tx, input.requestId);
    if (!request) throw new Error("Privacy request not found");
    if ((CLOSED_PRIVACY_STATUSES as readonly string[]).includes(request.status)) {
      throw new Error("This privacy request is already closed");
    }
    const closedGuard = notInArray(privacyRequests.status, [
      ...CLOSED_PRIVACY_STATUSES,
    ]);

    if (input.action === "verify") {
      if (request.identityStatus === "verified") {
        throw new Error("Identity is already verified");
      }
      const [updated] = await tx
        .update(privacyRequests)
        .set({
          identityStatus: "verified",
          status: "in_review",
          verifiedAt: now,
          adminNotes: notes || request.adminNotes,
          handledBy: input.adminId,
          updatedAt: now,
        })
        .where(
          and(
            eq(privacyRequests.id, request.id),
            ne(privacyRequests.identityStatus, "verified"),
            closedGuard,
          ),
        )
        .returning();
      if (!updated) {
        throw new Error(
          "This privacy request changed while it was being reviewed. Reload and try again.",
        );
      }
      await recordAudit(tx, {
        actorType: "admin",
        actorId: input.adminId,
        action: "privacy.request.verified",
        entityType: "privacy_request",
        entityId: request.id,
        metadata: { reference: request.reference, outcome: "success" },
      });
      return { request: updated, deleted: false };
    }

    if (input.action === "reject") {
      const reason = (input.rejectionReason ?? "").trim().slice(0, 1000);
      if (!reason) throw new Error("A rejection reason is required");
      const [updated] = await tx
        .update(privacyRequests)
        .set({
          status: "rejected",
          rejectionReason: reason,
          adminNotes: notes || request.adminNotes,
          handledBy: input.adminId,
          updatedAt: now,
          completedAt: now,
        })
        .where(and(eq(privacyRequests.id, request.id), closedGuard))
        .returning();
      if (!updated) {
        throw new Error("This privacy request is already closed");
      }
      await recordAudit(tx, {
        actorType: "admin",
        actorId: input.adminId,
        action: "privacy.request.rejected",
        entityType: "privacy_request",
        entityId: request.id,
        // The full reason remains on the request row. Do not duplicate free-text
        // personal data in the audit trail.
        metadata: {
          reference: request.reference,
          rejectionReasonRecorded: true,
          outcome: "success",
        },
      });
      return { request: updated, deleted: false };
    }

    if (input.action === "cancel") {
      const [updated] = await tx
        .update(privacyRequests)
        .set({
          status: "cancelled",
          adminNotes: notes || request.adminNotes,
          handledBy: input.adminId,
          updatedAt: now,
          completedAt: now,
        })
        .where(and(eq(privacyRequests.id, request.id), closedGuard))
        .returning();
      if (!updated) {
        throw new Error("This privacy request is already closed");
      }
      await recordAudit(tx, {
        actorType: "admin",
        actorId: input.adminId,
        action: "privacy.request.cancelled",
        entityType: "privacy_request",
        entityId: request.id,
        metadata: { reference: request.reference, outcome: "success" },
      });
      return { request: updated, deleted: false };
    }

    // Completion requires verified identity. This prevents an unauthenticated
    // visitor from deleting an account merely by submitting an email address.
    if (request.identityStatus !== "verified") {
      throw new Error("Identity must be verified before completing a privacy request");
    }

    const resolution =
      (input.resolution ?? "").trim().slice(0, 4000) ||
      (request.requestType === "deletion"
        ? "Account profile anonymised. Financial, transaction, and audit records retained where required for legal recordkeeping."
        : "Request reviewed and completed.");

    // Claim the request first inside the transaction, then perform any deletion.
    // If deletion fails, the whole transaction rolls back and the request stays
    // open rather than being marked complete without the required action.
    const [updated] = await tx
      .update(privacyRequests)
      .set({
        status: "completed",
        resolution,
        adminNotes: notes || request.adminNotes,
        handledBy: input.adminId,
        updatedAt: now,
        completedAt: now,
      })
      .where(and(eq(privacyRequests.id, request.id), closedGuard))
      .returning();
    if (!updated) {
      throw new Error("This privacy request is already closed");
    }

    let deleted = false;
    if (request.requestType === "deletion") {
      deleted = await performRetentionAwareDeletion(tx, request, input.adminId);
    }

    await recordAudit(tx, {
      actorType: "admin",
      actorId: input.adminId,
      action:
        request.requestType === "deletion"
          ? "privacy.request.deleted"
          : "privacy.request.completed",
      entityType: "privacy_request",
      entityId: request.id,
      metadata: {
        reference: request.reference,
        requestType: request.requestType,
        deleted,
        retainedFinancialRecords: request.requestType === "deletion",
        outcome: "success",
      },
    });

    return { request: updated, deleted };
  });
}

/**
 * Retention-aware deletion of a customer account profile.
 *
 * Orders, payments, invoices, refunds, and audit records are deliberately kept
 * because they are financial/accountability records. The user row is retained
 * with a non-deliverable anonymous email so foreign keys remain valid, but the
 * password, TOTP secret, sessions, and marketing preferences are removed.
 */
export async function performRetentionAwareDeletion(
  db: DatabaseExecutor,
  request: PrivacyRequestRow,
  adminId: string,
): Promise<boolean> {
  if (!request.userId) {
    await recordAudit(db, {
      actorType: "admin",
      actorId: adminId,
      action: "privacy.deletion.no_account",
      entityType: "privacy_request",
      entityId: request.id,
      metadata: { reference: request.reference, outcome: "no_account" },
    });
    return false;
  }

  const rows = await db.select().from(users).where(eq(users.id, request.userId)).limit(1);
  const user = rows[0];
  if (!user) return false;

  const now = new Date();
  await db
    .update(users)
    .set({
      email: `deleted+${user.id}@privacy.invalid`,
      name: "Deleted account",
      passwordHash: `deleted:${randomToken(32)}`,
      emailVerifiedAt: null,
      totpEnabled: false,
      totpSecretEncrypted: null,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));
  await db.delete(notifications).where(eq(notifications.userId, user.id));
  await db.delete(userConsents).where(eq(userConsents.userId, user.id));
  await db
    .update(userPreferences)
    .set({
      marketingOptIn: false,
      productUpdatesOptIn: false,
      orderUpdatesOptIn: false,
      updatedAt: now,
    })
    .where(eq(userPreferences.userId, user.id));
  await db
    .update(emailSubscriptions)
    .set({
      status: "unsubscribed",
      unsubscribedAt: now,
      unsubscribeReason: "privacy deletion request",
      updatedAt: now,
    })
    .where(eq(emailSubscriptions.userId, user.id));

  return true;
}
