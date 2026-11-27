import { flags, mockCommerceAllowed } from "@/lib/config";
import { MockEmailTransport } from "@/lib/integrations/email/mock";
import {
  DisabledLiveEmailTransport,
  DisabledUnconfiguredEmailTransport,
} from "@/lib/integrations/email/disabled";
import type { EmailTransport } from "@/lib/integrations/email/types";
import { ResendEmailTransport, resendConfigFromEnv } from "@/lib/integrations/email/resend";

let transport: EmailTransport | undefined;

/** Tests only: replace the email transport (null restores normal selection). */
export function setEmailTransportOverride(next: EmailTransport | null): void {
  transport = next ?? undefined;
}

export function getEmailTransport(): EmailTransport {
  if (!transport) {
    if (flags.emailLive) {
      // Real email only with an explicit EMAIL_PROVIDER=resend and a complete
      // configuration; otherwise sending stays blocked (and never blocks eSIM
      // delivery, which happens on the website).
      const resend = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase() === "resend" ? resendConfigFromEnv() : null;
      transport = resend ? new ResendEmailTransport(resend) : new DisabledLiveEmailTransport();
    } else if (!mockCommerceAllowed) {
      transport = new DisabledUnconfiguredEmailTransport();
    } else {
      transport = new MockEmailTransport();
    }
  }
  return transport;
}
