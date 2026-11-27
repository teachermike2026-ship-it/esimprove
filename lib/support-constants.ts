/**
 * Support constants with no server dependencies, safe to import from client
 * components. `lib/support.ts` (database code) re-exports them.
 */

export const SUPPORT_CATEGORIES = [
  "general",
  "payment",
  "installation",
  "activation",
  "compatibility",
  "coverage",
  "data_usage",
  "top_up",
  "refund",
  "delivery",
  "technical",
] as const;

export const SUPPORT_STATUSES = [
  "open",
  "pending_staff",
  "pending_customer",
  "resolved",
  "closed",
] as const;

export const SUPPORT_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  general: "General",
  payment: "Payment",
  installation: "Installation",
  activation: "Activation",
  compatibility: "Compatibility",
  coverage: "Coverage",
  data_usage: "Data usage",
  top_up: "Top-up",
  refund: "Refund",
  delivery: "Delivery",
  technical: "Technical issue",
};

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  open: "Open",
  pending_staff: "Awaiting staff",
  pending_customer: "Awaiting customer",
  resolved: "Resolved",
  closed: "Closed",
};

export const SUPPORT_PRIORITY_LABELS: Record<SupportPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};
