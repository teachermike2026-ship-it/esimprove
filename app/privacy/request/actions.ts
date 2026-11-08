"use server";

import { getDb } from "@/lib/db/client";
import { getCurrentUser, requestMeta } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/crypto";
import { recordConsentEvent } from "@/lib/consent";
import { loadLegalSettings } from "@/lib/legal";
import {
  createPrivacyRequest,
  findPrivacyRequestForStatus,
  privacyRequestStatusLabel,
  privacyRequestTypeLabel,
  type PrivacyRequestType,
} from "@/lib/privacy-requests";
import {
  formString,
  normalizeEmail,
  privacyLookupSchema,
  privacyRequestSchema,
  zodMessage,
} from "@/lib/validation";

export type PrivacyRequestFormState = {
  ok?: boolean;
  error?: string;
  reference?: string;
  status?: string;
  message?: string;
};

export type PrivacyLookupState = {
  ok?: boolean;
  error?: string;
  reference?: string;
  requestType?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  resolution?: string;
  rejectionReason?: string;
  verified?: boolean;
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

export async function submitPrivacyRequestAction(
  _previous: PrivacyRequestFormState,
  formData: FormData,
): Promise<PrivacyRequestFormState> {
  if (formString(formData, "website").trim()) {
    // Honeypot: do not create a request or reveal that the field was detected.
    return { ok: true, message: "Request received." };
  }

  const parsed = privacyRequestSchema.safeParse({
    requestType: formString(formData, "requestType"),
    email: formString(formData, "email"),
    name: formString(formData, "name"),
    details: formString(formData, "details"),
    privacyNotice: formString(formData, "privacyNotice"),
    website: formString(formData, "website"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const db = await getDb();
  const meta = await requestMeta();
  const rate = await checkRateLimit(db, `privacy-request:${meta.ipHash}`, 5, 60 * 60);
  if (!rate.allowed) {
    return {
      error:
        "Too many privacy requests from this connection. Wait an hour or use the published privacy contact.",
    };
  }

  const legal = await loadLegalSettings(db);
  const user = await getCurrentUser();
  const email = normalizeEmail(parsed.data.email);
  const matchingUser = user && normalizeEmail(user.email) === email ? user : null;

  try {
    const created = await createPrivacyRequest(db, {
      requestType: parsed.data.requestType as PrivacyRequestType,
      email,
      name: parsed.data.name,
      details: parsed.data.details,
      userId: matchingUser?.id ?? null,
      authenticatedEmail: matchingUser?.email ?? null,
    });

    await recordConsentEvent(db, {
      subjectType: matchingUser ? "user" : "anonymous",
      subjectId:
        matchingUser?.id ?? `privacy-request:${hashToken(email)}`,
      purpose: "privacy_request_notice",
      version: legal.privacyVersion,
      granted: true,
      surface: "privacy_request",
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    });

    const verified = created.request.identityStatus === "verified";
    return {
      ok: true,
      reference: created.request.reference,
      status: privacyRequestStatusLabel(created.request.status),
      message: verified
        ? "Your signed-in email matched this account, so the request is verified and queued for administrator review."
        : "The request is recorded. Identity must be verified by an administrator before any account data is disclosed or deleted. Email delivery is disabled in this build, so no verification email has been sent.",
    };
  } catch (error) {
    console.error(
      "Privacy request creation failed",
      error instanceof Error ? error.name : "unknown",
    );
    return {
      error:
        "The privacy request could not be recorded. Try again later or use the published privacy contact.",
    };
  }
}

export async function lookupPrivacyRequestAction(
  _previous: PrivacyLookupState,
  formData: FormData,
): Promise<PrivacyLookupState> {
  const parsed = privacyLookupSchema.safeParse({
    reference: formString(formData, "reference"),
    email: formString(formData, "email"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const db = await getDb();
  const meta = await requestMeta();
  const rate = await checkRateLimit(db, `privacy-lookup:${meta.ipHash}`, 15, 15 * 60);
  if (!rate.allowed) {
    return { error: "Too many status lookups. Wait 15 minutes and try again." };
  }

  const request = await findPrivacyRequestForStatus(
    db,
    parsed.data.reference,
    parsed.data.email,
  );
  if (!request) {
    return {
      error:
        "No request matches that reference and email. Check both values, or contact the privacy address if the request was created with a different email.",
    };
  }

  return {
    ok: true,
    reference: request.reference,
    requestType: privacyRequestTypeLabel(request.requestType),
    status: privacyRequestStatusLabel(request.status),
    createdAt: formatDate(request.createdAt),
    updatedAt: formatDate(request.updatedAt),
    resolution: request.resolution || undefined,
    rejectionReason: request.rejectionReason || undefined,
    verified: request.identityStatus === "verified",
  };
}
