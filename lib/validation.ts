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
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const checkoutSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(2, "Enter the name for the order").max(80),
  country: z.string().trim().min(2, "Choose a country").max(80),
  terms: z.literal("on", { message: "Accept the demo terms to continue" }),
  idempotencyKey: z.string().min(10).max(120),
});

export const cartItemSchema = z.object({
  planId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(5),
});

export const adminPlanSchema = z.object({
  planId: z.string().min(1),
  markupBps: z.coerce.number().int().min(0).max(100_000),
  status: z.enum(["published", "draft", "archived"]),
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
