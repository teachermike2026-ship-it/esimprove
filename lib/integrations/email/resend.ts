import { createHash } from "node:crypto";
import type { EmailMessage, EmailResult, EmailTransport } from "@/lib/integrations/email/types";

/**
 * Optional Resend transport (https://resend.com/docs/api-reference/emails/send-email).
 *
 * Designed for Resend's FREE plan: plain REST over `fetch` (no paid SDK
 * feature), one email per request, and an `Idempotency-Key` so a retried
 * request inside Resend's 24-hour window never sends a second copy. The free
 * plan allows 100 emails/day and 3,000/month; over that Resend answers 429
 * (`daily_quota_exceeded` / `monthly_quota_exceeded`). Callers treat every
 * failure as non-fatal: eSIM delivery happens on the website, and email is
 * only a notification and backup channel.
 *
 * It is used only when EMAIL_LIVE_ENABLED=true, EMAIL_PROVIDER=resend,
 * RESEND_API_KEY and EMAIL_FROM are all set. The API key is never logged.
 */
export const RESEND_API_URL = "https://api.resend.com/emails";

export class ResendEmailError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ResendEmailError";
  }
}

export interface ResendConfig {
  apiKey: string;
  from: string;
  replyTo?: string | null;
  /** Optional: send every email to this address instead (test inbox). */
  testRecipient?: string | null;
}

export function resendConfigFromEnv(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !apiKey.startsWith("re_") || !from) return null;
  return {
    apiKey,
    from,
    replyTo: process.env.EMAIL_REPLY_TO?.trim() || null,
    testRecipient: process.env.EMAIL_TEST_RECIPIENT?.trim() || null,
  };
}

/** Stable per-message key (template + order + recipient + subject), at most 256 chars. */
export function resendIdempotencyKey(message: EmailMessage): string {
  const digest = createHash("sha256")
    .update([message.template, message.orderId ?? "", message.to.toLowerCase(), message.subject].join("|"))
    .digest("hex")
    .slice(0, 32);
  return `${message.template}/${digest}`.slice(0, 256);
}

export class ResendEmailTransport implements EmailTransport {
  readonly key = "resend";
  readonly mode = "live" as const;
  readonly isMock = false;

  constructor(
    private readonly config: ResendConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await this.fetchImpl(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": resendIdempotencyKey(message),
        },
        body: JSON.stringify({
          from: this.config.from,
          to: [this.config.testRecipient || message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(message.attachments?.length
            ? {
                attachments: message.attachments.map((file) => ({
                  filename: file.filename,
                  content: file.contentBase64,
                  content_type: file.contentType,
                  ...(file.contentId ? { content_id: file.contentId } : {}),
                })),
              }
            : {}),
          ...(this.config.replyTo ? { reply_to: this.config.replyTo } : {}),
          tags: [{ name: "template", value: message.template.replace(/[^A-Za-z0-9_-]/g, "_") }],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new ResendEmailError(
        `Resend request failed (${error instanceof Error ? error.name : "network error"})`,
        0,
        "network_error",
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let code = `http_${response.status}`;
      try {
        const body = (await response.json()) as { name?: unknown; type?: unknown };
        const name = typeof body.name === "string" ? body.name : typeof body.type === "string" ? body.type : "";
        if (name) code = name.slice(0, 60);
      } catch {
        // Non-JSON error body: keep the HTTP status code.
      }
      throw new ResendEmailError(`Resend rejected the email (${response.status} ${code})`, response.status, code);
    }

    const body = (await response.json().catch(() => ({}))) as { id?: unknown };
    if (typeof body.id !== "string" || !body.id) {
      throw new ResendEmailError("Resend accepted the request but returned no email id", response.status, "no_id");
    }
    return { id: body.id, mode: "live" };
  }
}
