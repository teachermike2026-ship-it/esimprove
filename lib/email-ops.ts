/**
 * Email Center: Resend diagnostics, delivery logs, template previews and
 * admin test sends.
 *
 * - The API key is never returned, logged or rendered. Diagnostics report
 *   only presence, format and the result of a read-only Resend API call.
 * - Test emails go only to an administrator-controlled recipient (the signed-in
 *   admin's own account email, or EMAIL_TEST_RECIPIENT) and need explicit
 *   confirmation. They use clearly labelled sample data, never customer data.
 */
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { emailEvents } from "@/lib/db/schema";
import { flags, liveEmailProblems } from "@/lib/config";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import {
  orderConfirmationEmail,
  refundApprovedEmail,
  refundRejectedEmail,
  supportReplyEmail,
  supportTicketCreatedEmail,
  type EmailTemplate,
} from "@/lib/email-templates";
import { ResendEmailError, ResendEmailTransport, resendConfigFromEnv } from "@/lib/integrations/email/resend";
import { redactSensitiveEmailText } from "@/lib/integrations/email/redact";

/** "traveler@example.com" -> "tr***@ex***.com" */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return email ? "***" : "";
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local.slice(0, 2)}***@${host.slice(0, 2)}***${tld}`;
}

// ---------------------------------------------------------------------------
// Diagnostics

export interface ResendCheck {
  status: "ok" | "unauthorized" | "error" | "not-configured";
  message: string;
  domains: Array<{ name: string; status: string }>;
  senderDomain: string | null;
  senderDomainVerified: boolean | null;
  checkedAt: Date;
}

let cachedCheck: ResendCheck | null = null;
const CHECK_CACHE_MS = 60_000;

function senderDomain(from: string | undefined): string | null {
  const match = /@([^>\s]+)/.exec(from ?? "");
  return match ? match[1]!.toLowerCase() : null;
}

/** Read-only Resend call (GET /domains). Never sends an email. */
export async function checkResend(
  options: { fetchImpl?: typeof fetch; force?: boolean } = {},
): Promise<ResendCheck> {
  if (!options.force && !options.fetchImpl && cachedCheck && Date.now() - cachedCheck.checkedAt.getTime() < CHECK_CACHE_MS) {
    return cachedCheck;
  }
  const key = process.env.RESEND_API_KEY?.trim();
  const sender = senderDomain(process.env.EMAIL_FROM);
  if (!key) {
    return {
      status: "not-configured",
      message: "RESEND_API_KEY is not set.",
      domains: [],
      senderDomain: sender,
      senderDomainVerified: null,
      checkedAt: new Date(),
    };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  let result: ResendCheck;
  try {
    const response = await fetchImpl("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 401 || response.status === 403) {
      result = { status: "unauthorized", message: `Resend rejected the API key (HTTP ${response.status}).`, domains: [], senderDomain: sender, senderDomainVerified: null, checkedAt: new Date() };
    } else if (!response.ok) {
      result = { status: "error", message: `Resend returned HTTP ${response.status}.`, domains: [], senderDomain: sender, senderDomainVerified: null, checkedAt: new Date() };
    } else {
      const json = (await response.json()) as { data?: Array<{ name?: unknown; status?: unknown }> };
      const domains = (json.data ?? []).map((d) => ({ name: String(d.name ?? ""), status: String(d.status ?? "unknown") }));
      const match = sender ? domains.find((d) => d.name.toLowerCase() === sender) : undefined;
      result = {
        status: "ok",
        message: "Authenticated with Resend (read-only domain list).",
        domains,
        senderDomain: sender,
        senderDomainVerified: match ? match.status === "verified" : false,
        checkedAt: new Date(),
      };
    }
  } catch (error) {
    result = {
      status: "error",
      message: `Resend could not be reached (${error instanceof Error ? error.name : "error"}).`,
      domains: [],
      senderDomain: sender,
      senderDomainVerified: null,
      checkedAt: new Date(),
    };
  }
  if (!options.fetchImpl) cachedCheck = result;
  return result;
}

export async function emailDiagnostics(db: Database, options: { fetchImpl?: typeof fetch; force?: boolean } = {}) {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [lastSent, recentFailures, counts, resend] = await Promise.all([
    db.select().from(emailEvents).where(eq(emailEvents.status, "sent")).orderBy(desc(emailEvents.sentAt)).limit(1),
    db
      .select()
      .from(emailEvents)
      .where(and(eq(emailEvents.status, "failed"), gte(emailEvents.createdAt, weekAgo)))
      .orderBy(desc(emailEvents.createdAt))
      .limit(10),
    db
      .select({ status: emailEvents.status, n: sql<number>`count(*)::int` })
      .from(emailEvents)
      .where(gte(emailEvents.createdAt, weekAgo))
      .groupBy(emailEvents.status),
    checkResend(options),
  ]);
  return {
    apiKeyPresent: key.length > 0,
    apiKeyFormatValid: /^re_[A-Za-z0-9_]+$/.test(key),
    emailFrom: process.env.EMAIL_FROM?.trim() || null,
    emailProvider: process.env.EMAIL_PROVIDER?.trim() || "(not set)",
    emailLiveEnabled: flags.emailLive,
    liveProblems: liveEmailProblems(),
    testRecipientConfigured: Boolean(process.env.EMAIL_TEST_RECIPIENT?.trim()),
    resend,
    lastSuccessfulSend: lastSent[0] ?? null,
    recentFailures,
    last7Days: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) as Record<string, number>,
  };
}

export async function listEmailLog(db: Database, limit = 100) {
  const rows = await db.select().from(emailEvents).orderBy(desc(emailEvents.createdAt)).limit(limit);
  return rows.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    template: row.template,
    recipientMasked: maskEmail(row.recipient),
    subject: row.subject,
    status: row.status,
    providerMessageId: row.providerMessageId,
    providerResponse: row.providerResponse,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
  }));
}

// ---------------------------------------------------------------------------
// Template previews (sample data, clearly labelled)

export const TEST_TEMPLATES = {
  "order.confirmation": {
    label: "Order confirmation",
    build: (): EmailTemplate => orderConfirmationEmail({ orderNumber: "ES-TEST-000000", totalMinor: 428, currency: "USD" }),
  },
  "refund.approved": {
    label: "Refund notification (approved)",
    build: (): EmailTemplate => refundApprovedEmail({ orderNumber: "ES-TEST-000000", amountMinor: 428, currency: "USD" }),
  },
  "refund.rejected": {
    label: "Refund notification (declined)",
    build: (): EmailTemplate =>
      refundRejectedEmail({ orderNumber: "ES-TEST-000000", amountMinor: 428, currency: "USD", note: "Sample note for a test email." }),
  },
  "support.ticket_created": {
    label: "Support notification (ticket created)",
    build: (): EmailTemplate => supportTicketCreatedEmail({ ticketId: "ticket_test_sample", subject: "Sample support request" }),
  },
  "support.reply": {
    label: "Support notification (reply)",
    build: (): EmailTemplate => supportReplyEmail({ ticketId: "ticket_test_sample", subject: "Sample support request" }),
  },
} as const;

export type TestTemplateKey = keyof typeof TEST_TEMPLATES;

export function isTestTemplateKey(value: string): value is TestTemplateKey {
  return Object.prototype.hasOwnProperty.call(TEST_TEMPLATES, value);
}

export function renderTestTemplate(key: TestTemplateKey): EmailTemplate {
  const template = TEST_TEMPLATES[key].build();
  return {
    subject: `[TEST] ${template.subject}`,
    text: `THIS IS A TEST EMAIL FROM THE ESIMPROVE ADMIN EMAIL CENTER. It uses sample data, not a real order.\n\n${template.text}`,
  };
}

// ---------------------------------------------------------------------------
// Test send

export function allowedTestRecipients(adminEmail: string): string[] {
  const list = [adminEmail, process.env.EMAIL_TEST_RECIPIENT ?? ""]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value));
  return [...new Set(list)];
}

export type TestSendResult =
  | { ok: true; providerMessageId: string; emailEventId: string }
  | { ok: false; error: string; emailEventId?: string };

export async function sendTestEmail(
  db: Database,
  input: { adminId: string; adminEmail: string; recipient: string; template: string; confirmed: boolean },
  options: { fetchImpl?: typeof fetch } = {},
): Promise<TestSendResult> {
  if (!input.confirmed) return { ok: false, error: "Tick the confirmation box to send a real test email." };
  if (!isTestTemplateKey(input.template)) return { ok: false, error: "Choose one of the listed templates." };
  const recipient = input.recipient.trim().toLowerCase();
  if (!allowedTestRecipients(input.adminEmail).includes(recipient)) {
    return {
      ok: false,
      error: "Test emails can only go to your own admin email address or to EMAIL_TEST_RECIPIENT.",
    };
  }
  const config = resendConfigFromEnv();
  if (!config) return { ok: false, error: "Resend is not configured (RESEND_API_KEY and EMAIL_FROM are required)." };

  const template = renderTestTemplate(input.template);
  const emailEventId = newId("email");
  await db.insert(emailEvents).values({
    id: emailEventId,
    orderId: null,
    template: `admin.test.${input.template}`,
    recipient,
    subject: template.subject,
    bodyText: redactSensitiveEmailText(template.text),
    status: "queued",
  });
  try {
    // The test recipient override is deliberately not applied: the recipient
    // has already been restricted to an administrator-controlled address.
    const transport = new ResendEmailTransport({ ...config, testRecipient: null }, options.fetchImpl);
    const result = await transport.send({
      to: recipient,
      subject: template.subject,
      text: template.text,
      template: `admin.test.${input.template}`,
    });
    await db
      .update(emailEvents)
      .set({ status: "sent", sentAt: new Date(), providerMessageId: result.id })
      .where(eq(emailEvents.id, emailEventId));
    await recordAudit(db, {
      actorType: "admin",
      actorId: input.adminId,
      action: "email.test_sent",
      entityType: "email",
      entityId: emailEventId,
      metadata: { template: input.template, recipient: maskEmail(recipient), providerMessageId: result.id },
    });
    return { ok: true, providerMessageId: result.id, emailEventId };
  } catch (error) {
    const message = redactSensitiveEmailText(
      error instanceof ResendEmailError ? `${error.message}${error.code ? ` (${error.code})` : ""}` : error instanceof Error ? error.message : String(error),
    ).slice(0, 500);
    await db
      .update(emailEvents)
      .set({ status: "failed", providerResponse: message })
      .where(eq(emailEvents.id, emailEventId));
    await recordAudit(db, {
      actorType: "admin",
      actorId: input.adminId,
      action: "email.test_failed",
      entityType: "email",
      entityId: emailEventId,
      metadata: { template: input.template, recipient: maskEmail(recipient), error: message },
    });
    return { ok: false, error: message, emailEventId };
  }
}
