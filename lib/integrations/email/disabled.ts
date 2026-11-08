import { IntegrationDisabledError } from "@/lib/integrations/supplier/types";
import type { EmailMessage, EmailResult, EmailTransport } from "@/lib/integrations/email/types";

export class DisabledLiveEmailTransport implements EmailTransport {
  readonly key = "resend";
  readonly mode = "live" as const;
  readonly isMock = false;

  async send(message: EmailMessage): Promise<EmailResult> {
    void message;
    throw new IntegrationDisabledError(
      "Resend email",
      "sending is blocked until a domain is verified, DNS is configured, and the owner approves real email.",
    );
  }
}

/**
 * Production deployment without a verified email provider. Sends fail closed so
 * the application never records a mock message as a delivered email.
 */
export class DisabledUnconfiguredEmailTransport implements EmailTransport {
  readonly key = "unconfigured";
  readonly mode = "live" as const;
  readonly isMock = false;

  async send(message: EmailMessage): Promise<EmailResult> {
    void message;
    throw new IntegrationDisabledError(
      "Transactional email",
      "sending is blocked. No live email provider and verified sending domain are configured for this deployment.",
    );
  }
}
