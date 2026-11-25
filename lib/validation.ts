import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200, "Password is too long");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().optional(),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(80),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    terms: z.literal("on", {
      message: "Accept the Terms of Service to create an account",
    }),
    privacy: z.literal("on", {
      message: "Acknowledge the Privacy Policy to create an account",
    }),
    age: z.literal("on", {
      message: "Confirm the age and capacity statement to create an account",
    }),
    marketing: z.string().optional(),
    termsVersion: z.string().min(1).max(80),
    privacyVersion: z.string().min(1).max(80),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const contactFormSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: emailSchema,
  subject: z.string().trim().min(3, "Enter a subject").max(160),
  message: z.string().trim().min(10, "Enter a message").max(4000),
  privacyNotice: z.literal("on", {
    message: "Acknowledge the privacy notice to send a message",
  }),
  website: z.string().max(200).optional(),
});

export const privacyRequestSchema = z.object({
  requestType: z.enum([
    "access",
    "correction",
    "deletion",
    "restriction",
    "portability",
    "objection",
    "other",
  ]),
  email: emailSchema,
  name: z.string().trim().max(120).optional(),
  details: z.string().trim().max(4000).optional(),
  privacyNotice: z.literal("on", {
    message: "Confirm that you understand how this request is handled",
  }),
  website: z.string().max(200).optional(),
});

export const privacyLookupSchema = z.object({
  reference: z.string().trim().min(6, "Enter the request reference").max(40),
  email: emailSchema,
});

export const checkoutSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(2, "Enter the name for the order").max(80),
  country: z.string().trim().min(2, "Choose a country").max(80),
  terms: z.literal("on", { message: "Accept the terms to continue" }),
  termsVersion: z.string().min(1).max(80),
  idempotencyKey: z.string().min(10).max(120),
});

export const cartItemSchema = z.object({
  planId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(5),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, "Enter the reset code from your email").max(200),
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(200),
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const ownerFirstLoginPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const refundRequestSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,9}(?:\.\d{1,3})?$/, "Enter a refund amount such as 12.50")
    .max(20),
  reason: z
    .string()
    .trim()
    .min(10, "Describe why you are requesting a refund")
    .max(1000, "Keep the reason under 1000 characters"),
  confirm: z.literal("on", {
    message: "Confirm that you understand the refund policy",
  }),
});

export const adminRefundRejectSchema = z.object({
  refundId: z.string().min(1),
  note: z
    .string()
    .trim()
    .min(5, "Explain why the refund is being rejected")
    .max(1000),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  locale: z.enum(["en", "pt", "es", "ar", "fr"]),
  marketing: z.string().optional(),
  productUpdates: z.string().optional(),
  orderUpdates: z.string().optional(),
});

export const customerSupportTicketSchema = z.object({
  orderNumber: z.string().trim().max(40).optional(),
  category: z.enum([
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
  ]),
  subject: z.string().trim().min(3, "Enter a subject").max(160),
  message: z.string().trim().min(10, "Describe your question").max(4000),
});

export const customerSupportReplySchema = z.object({
  ticketId: z.string().min(1),
  message: z.string().trim().min(1, "Enter a message").max(4000),
});

export const adminSupportUpdateSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(["open", "pending_customer", "pending_staff", "resolved", "closed"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  category: z.enum([
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
  ]),
  assignedTo: z.string().trim().max(80).optional(),
});

export const adminSupportReplySchema = z.object({
  ticketId: z.string().min(1),
  message: z.string().trim().min(1, "Enter a reply").max(4000),
});

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Enter a slug")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");

export const catalogueRegionSchema = z.object({
  name: z.string().trim().min(2, "Enter a region name").max(80),
  slug: slugSchema,
  description: z.string().trim().min(10, "Describe the region").max(600),
  accent: z.string().trim().min(1).max(30),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
});

export const catalogueDestinationSchema = z.object({
  regionId: z.string().min(1, "Choose a region"),
  name: z.string().trim().min(2, "Enter a destination name").max(80),
  slug: slugSchema,
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,3}$/, "Use a two or three letter country code"),
  summary: z.string().trim().min(5, "Enter a short summary").max(300),
  description: z.string().trim().min(10, "Describe the destination").max(2000),
  popular: z.string().optional(),
});

export const cataloguePlanSchema = z.object({
  destinationId: z.string().min(1, "Choose a destination"),
  name: z.string().trim().min(2, "Enter a plan name").max(100),
  slug: slugSchema,
  supplierKey: z.string().trim().min(1, "Enter a supplier key").max(60),
  supplierProductId: z.string().trim().min(1, "Enter a supplier product ID").max(120),
  dataMb: z.coerce.number().int().min(1).max(10_000_000),
  validityDays: z.coerce.number().int().min(1).max(3650),
  cost: z
    .string()
    .trim()
    .regex(/^\d{1,9}(?:\.\d{1,3})?$/, "Enter a cost such as 4.50")
    .max(20),
  markupBps: z.coerce.number().int().min(0).max(100_000),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a three letter currency code"),
  taxBps: z.coerce.number().int().min(0).max(100_000),
  coverageSummary: z.string().trim().min(3, "Enter coverage").max(300),
  networkSummary: z.string().trim().min(3, "Enter networks").max(300),
  description: z.string().trim().min(10, "Describe the plan").max(4000),
  features: z.string().trim().max(2000).optional(),
  status: z.enum(["published", "draft", "archived"]),
  isDemo: z.string().optional(),
});

export const supplierConnectionSchema = z.object({
  displayName: z.string().trim().min(2, "Enter a display name").max(80),
  adapterType: z
    .string()
    .trim()
    .min(2, "Enter an adapter type")
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*$/i, "Adapter type may contain letters, numbers, and hyphens"),
  environment: z.enum(["sandbox", "production"]),
  baseUrl: z.string().trim().min(1, "Enter a base URL").max(2048),
  authMethod: z.enum(["api_key", "bearer_token"]),
  credentialSecret: z
    .string()
    .min(1, "Enter the supplier credential")
    .max(4096, "Supplier credential is too long"),
});

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  // Only same-origin absolute paths are allowed. Reject protocol-relative,
  // backslash-normalised, and control-character variants that browsers may
  // interpret as an external redirect.
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}

export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function zodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}
