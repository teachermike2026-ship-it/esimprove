"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getCurrentUser, requestMeta } from "@/lib/auth/session";
import { users } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordConsentEvent } from "@/lib/consent";
import { hashToken } from "@/lib/crypto";
import { LEGAL_DOCUMENT_VERSION } from "@/lib/legal-profile";
import { createSupportTicket } from "@/lib/support";
import {
  contactFormSchema,
  formString,
  normalizeEmail,
  zodMessage,
} from "@/lib/validation";

export type ContactFormState = {
  ok?: boolean;
  error?: string;
  ticketId?: string;
  message?: string;
};

export async function submitContactAction(
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  if (formString(formData, "website").trim()) {
    return { ok: true, message: "Message received." };
  }

  const parsed = contactFormSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    subject: formString(formData, "subject"),
    message: formString(formData, "message"),
    privacyNotice: formString(formData, "privacyNotice"),
    website: formString(formData, "website"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const db = await getDb();
  const meta = await requestMeta();
  const rate = await checkRateLimit(db, `contact:${meta.ipHash}`, 5, 60 * 60);
  if (!rate.allowed) {
    return {
      error:
        "Too many messages from this connection. Wait an hour before sending another message.",
    };
  }

  const email = normalizeEmail(parsed.data.email);
  const sessionUser = await getCurrentUser();
  let userId: string | null = null;
  if (sessionUser && normalizeEmail(sessionUser.email) === email) {
    userId = sessionUser.id;
  } else {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    userId = rows[0]?.id ?? null;
  }

  const trimmedName = (parsed.data.name ?? "").trim();
  const messageBody = [
    trimmedName ? `Contact name: ${trimmedName}` : null,
    `Reply email: ${email}`,
    "",
    parsed.data.message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    const ticket = await createSupportTicket(db, {
      userId,
      requesterEmail: email,
      subject: parsed.data.subject,
      priority: "normal",
      message: messageBody,
    });

    await recordConsentEvent(db, {
      subjectType: userId ? "user" : "anonymous",
      subjectId: userId ?? `contact:${hashToken(email)}`,
      purpose: "contact_privacy_notice",
      version: LEGAL_DOCUMENT_VERSION,
      granted: true,
      surface: "contact_form",
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    });

    return {
      ok: true,
      ticketId: ticket.id,
      message:
        "Your message has been received and will be reviewed. No specific response time is promised.",
    };
  } catch (error) {
    console.error("Contact submission failed", error instanceof Error ? error.name : "unknown");
    return {
      error:
        "The message could not be recorded. Try again later or use another route on this page.",
    };
  }
}
