import { siteUrl } from "@/lib/config";
import { formatMoney } from "@/lib/money";

export interface EmailTemplate {
  subject: string;
  text: string;
}

export const EMAIL_TEMPLATE_KEYS = [
  "auth.password_reset",
  "auth.email_verification",
  "auth.password_changed",
  "order.confirmation",
  "order.fulfilled",
  "refund.requested",
  "refund.approved",
  "refund.rejected",
  "support.ticket_created",
  "support.reply",
  "support.status",
  "account.notice",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

function closing(): string {
  return [
    "",
    "This message was sent by Esimprove. Never reply with",
    "passwords, one-time codes, or full payment card numbers.",
  ].join("\n");
}

export function passwordResetEmail(resetUrl: string): EmailTemplate {
  return {
    subject: "Reset your Esimprove password",
    text: [
      "You requested a password reset for your Esimprove account.",
      "",
      resetUrl,
      "",
      "This link expires in 30 minutes and can only be used once.",
      "If you did not request a reset, ignore this message.",
      closing(),
    ].join("\n"),
  };
}

export function emailVerificationEmail(verifyUrl: string): EmailTemplate {
  return {
    subject: "Verify your Esimprove email address",
    text: [
      "Confirm the email address attached to your Esimprove account.",
      "",
      verifyUrl,
      "",
      "This link expires in 24 hours and can only be used once.",
      "Email verification helps secure account recovery.",
      closing(),
    ].join("\n"),
  };
}

export function passwordChangedEmail(): EmailTemplate {
  return {
    subject: "Your Esimprove password changed",
    text: [
      "The password for your Esimprove account was changed.",
      "All existing sessions were signed out.",
      "",
      `If this was not you, open ${siteUrl}/contact and contact support.`,
      closing(),
    ].join("\n"),
  };
}

export function orderConfirmationEmail(input: {
  orderNumber: string;
  totalMinor: number;
  currency: string;
}): EmailTemplate {
  return {
    subject: `Order recorded — ${input.orderNumber}`,
    text: [
      `Your order ${input.orderNumber} was recorded.`,
      `Total: ${formatMoney(input.totalMinor, input.currency)}`,
      "",
      `Open ${siteUrl}/portal to view your order.`,
      closing(),
    ].join("\n"),
  };
}

export function refundRequestedEmail(input: {
  orderNumber: string;
  amountMinor: number;
  currency: string;
}): EmailTemplate {
  return {
    subject: `Refund request recorded — ${input.orderNumber}`,
    text: [
      `A refund request for ${formatMoney(input.amountMinor, input.currency)} was recorded for order ${input.orderNumber}.`,
      "It is awaiting review by our team.",
      "",
      `Review the status at ${siteUrl}/portal/orders/${input.orderNumber}.`,
      closing(),
    ].join("\n"),
  };
}

export function refundApprovedEmail(input: {
  orderNumber: string;
  amountMinor: number;
  currency: string;
}): EmailTemplate {
  return {
    subject: `Refund approved — ${input.orderNumber}`,
    text: [
      `Your refund of ${formatMoney(input.amountMinor, input.currency)} for order ${input.orderNumber} was approved.`,
      "",
      `Review the order at ${siteUrl}/portal/orders/${input.orderNumber}.`,
      closing(),
    ].join("\n"),
  };
}

export function refundRejectedEmail(input: {
  orderNumber: string;
  amountMinor: number;
  currency: string;
  note: string;
}): EmailTemplate {
  return {
    subject: `Refund request declined — ${input.orderNumber}`,
    text: [
      `Your refund request for ${formatMoney(input.amountMinor, input.currency)} on order ${input.orderNumber} was declined.`,
      `Reason: ${input.note}`,
      "",
      `Review the order at ${siteUrl}/portal/orders/${input.orderNumber}.`,
      closing(),
    ].join("\n"),
  };
}

export function supportTicketCreatedEmail(input: {
  ticketId: string;
  subject: string;
}): EmailTemplate {
  return {
    subject: `Support ticket recorded — ${input.ticketId}`,
    text: [
      `Your support ticket ${input.ticketId} was recorded: ${input.subject}`,
      "Our support team will review it and reply.",
      "",
      `Open ${siteUrl}/portal/support/${input.ticketId} after signing in to view the conversation.`,
      closing(),
    ].join("\n"),
  };
}

export function supportReplyEmail(input: {
  ticketId: string;
  subject: string;
}): EmailTemplate {
  return {
    subject: `Support replied — ${input.ticketId}`,
    text: [
      `A support reply was added to ticket ${input.ticketId}: ${input.subject}`,
      "",
      `Open ${siteUrl}/portal/support/${input.ticketId} after signing in to read it.`,
      closing(),
    ].join("\n"),
  };
}

export function supportStatusEmail(input: {
  ticketId: string;
  subject: string;
  status: string;
}): EmailTemplate {
  return {
    subject: `Support ticket status updated — ${input.ticketId}`,
    text: [
      `Ticket ${input.ticketId} (${input.subject}) is now ${input.status.replaceAll("_", " ")}.`,
      "",
      `Open ${siteUrl}/portal/support/${input.ticketId} after signing in to review it.`,
      closing(),
    ].join("\n"),
  };
}
