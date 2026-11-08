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

export const adminPlanSchema = z.object({
  planId: z.string().min(1),
  markupBps: z.coerce.number().int().min(0).max(100_000),
  status: z.enum(["published", "draft", "archived"]),
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
