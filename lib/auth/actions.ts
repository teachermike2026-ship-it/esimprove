"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { passwordResets, sessions, users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { decryptSecret } from "@/lib/crypto";
import { hashToken, randomToken } from "@/lib/crypto";
import { verifyTotp } from "@/lib/auth/totp";
import { getEmailTransport } from "@/lib/integrations/email";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  getCurrentSession,
  promotePendingSession,
  requestMeta,
  setSessionCookie,
} from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  formString,
  loginSchema,
  normalizeEmail,
  registerSchema,
  resetPasswordSchema,
  changePasswordSchema,
  safeNextPath,
  zodMessage,
  emailSchema,
} from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { isAdminRole } from "@/lib/auth/roles";
import { flags, sessionCookieName, siteUrl } from "@/lib/config";
import { recordConsent } from "@/lib/consents";
import { loadLegalSettings } from "@/lib/legal";
import { createEmailSubscription } from "@/lib/email-subscriptions";
import { getOrCreateUserPreferences, updateUserPreferences } from "@/lib/user-preferences";

type AuthState = { error?: string };

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    next: formString(formData, "next"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const db = await getDb();
  const meta = await requestMeta();
  const email = normalizeEmail(parsed.data.email);
  const rate = await checkRateLimit(db, `login:${email}:${meta.ipHash}`, 10, 15 * 60);
  if (!rate.allowed) {
    return { error: "Too many sign-in attempts. Wait 15 minutes and try again." };
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid) {
    return { error: "Email or password is incorrect." };
  }

  const adminAccount = isAdminRole(user.role);
  const nextPath = safeNextPath(parsed.data.next, adminAccount ? "/admin" : "/portal");

  if (adminAccount && flags.admin2faRequired && !user.totpEnabled) {
    return {
      error:
        "This admin account has no TOTP secret. Admin sign-in is blocked until 2FA is configured.",
    };
  }

  if (adminAccount && user.totpEnabled) {
    const pending = await createSession(db, user.id, {
      pendingTwoFactor: true,
      ttlMinutes: 10,
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    });
    await setSessionCookie(pending.token, pending.expiresAt);
    redirect(`/login/2fa?next=${encodeURIComponent(nextPath)}`);
  }

  const session = await createSession(db, user.id, {
    ttlMinutes: Number(process.env.SESSION_TTL_DAYS || "30") * 24 * 60,
    ipHash: meta.ipHash,
    userAgent: meta.userAgent,
  });
  await setSessionCookie(session.token, session.expiresAt);
  await recordAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    metadata: { role: user.role },
  });
  redirect(nextPath);
}

export async function loginTwoFactorAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const session = await getCurrentSession();
  if (!session || !session.pendingTwoFactor) {
    redirect("/login");
  }

  const db = await getDb();
  const rate = await checkRateLimit(db, `2fa:${session.user.id}`, 8, 10 * 60);
  if (!rate.allowed) {
    return { error: "Too many verification attempts. Wait 10 minutes and try again." };
  }

  const code = formString(formData, "code").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from your authenticator." };

  if (!session.user.totpSecretEncrypted) {
    return { error: "TOTP is not configured for this account." };
  }

  let valid = false;
  try {
    const secret = decryptSecret(session.user.totpSecretEncrypted);
    valid = verifyTotp(secret, code);
  } catch {
    return { error: "TOTP verification is unavailable. Check the server encryption key." };
  }
  if (!valid) return { error: "That code is invalid or has expired." };

  const ttlMinutes = Number(process.env.ADMIN_SESSION_TTL_MINUTES || "60");
  const expiresAt = await promotePendingSession(db, session.id, ttlMinutes);
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (token) {
    await setSessionCookie(token, expiresAt);
  }
  await recordAudit(db, {
    actorType: "user",
    actorId: session.user.id,
    action: "auth.login.2fa",
    entityType: "user",
    entityId: session.user.id,
    metadata: { role: session.user.role },
  });
  const nextPath = safeNextPath(formString(formData, "next"), "/admin");
  redirect(nextPath);
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
    terms: formString(formData, "terms"),
    privacy: formString(formData, "privacy"),
    age: formString(formData, "age"),
    marketing: formString(formData, "marketing"),
    termsVersion: formString(formData, "termsVersion"),
    privacyVersion: formString(formData, "privacyVersion"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const db = await getDb();
  const meta = await requestMeta();
  const legal = await loadLegalSettings(db);
  if (
    parsed.data.termsVersion !== legal.termsVersion ||
    parsed.data.privacyVersion !== legal.privacyVersion
  ) {
    return {
      error:
        "The legal documents changed while this form was open. Reload the page and review the current versions.",
    };
  }
  const marketingOptIn = parsed.data.marketing === "on";
  const email = normalizeEmail(parsed.data.email);
  const rate = await checkRateLimit(db, `register:${meta.ipHash}`, 5, 60 * 60);
  if (!rate.allowed) return { error: "Too many accounts created from this connection. Try later." };

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    return { error: "An account with that email already exists. Sign in instead." };
  }

  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    email,
    name: parsed.data.name,
    passwordHash: await hashPassword(parsed.data.password),
    role: "customer",
    // Email verification is not implemented in this demo. Do not claim the
    // address is verified just because an account was created.
    emailVerifiedAt: null,
  });

  const consentContext = {
    ipHash: meta.ipHash,
    userAgent: meta.userAgent,
    surface: "registration",
  };
  await recordConsent(db, {
    userId,
    purpose: "terms",
    version: legal.termsVersion,
    accepted: true,
    ...consentContext,
  });
  await recordConsent(db, {
    userId,
    purpose: "privacy",
    version: legal.privacyVersion,
    accepted: true,
    ...consentContext,
  });
  await recordConsent(db, {
    userId,
    purpose: "age",
    version: legal.termsVersion,
    accepted: true,
    ...consentContext,
  });
  await recordConsent(db, {
    userId,
    purpose: "marketing",
    version: legal.marketingConsentVersion,
    accepted: marketingOptIn,
    ...consentContext,
  });
  await getOrCreateUserPreferences(db, userId);
  await updateUserPreferences(db, userId, {
    marketingOptIn,
    productUpdatesOptIn: false,
    orderUpdatesOptIn: true,
  });

  if (marketingOptIn) {
    // The raw unsubscribe token must be attached to a real email by an email
    // provider. It is deliberately not logged or rendered in this build.
    await createEmailSubscription(db, {
      email,
      userId,
      source: "registration",
      consentVersion: legal.marketingConsentVersion,
    });
  }

  const session = await createSession(db, userId, {
    ttlMinutes: Number(process.env.SESSION_TTL_DAYS || "30") * 24 * 60,
    ipHash: meta.ipHash,
    userAgent: meta.userAgent,
  });
  await setSessionCookie(session.token, session.expiresAt);
  await recordAudit(db, {
    actorType: "user",
    actorId: userId,
    action: "auth.register",
    entityType: "user",
    entityId: userId,
    metadata: {},
  });
  redirect("/portal");
}

export async function logoutAction(): Promise<void> {
  const session = await getCurrentSession();
  if (session) {
    const db = await getDb();
    await deleteSession(db, session.id);
    await recordAudit(db, {
      actorType: "user",
      actorId: session.user.id,
      action: "auth.logout",
      entityType: "session",
      entityId: session.id,
      metadata: {},
    });
  }
  await clearSessionCookie();
  redirect("/");
}

const PASSWORD_RESET_TTL_MINUTES = 30;

export async function requestPasswordResetAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const email = formString(formData, "email").trim().toLowerCase();
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { error: "Enter a valid email address." };
  }

  const db = await getDb();
  const meta = await requestMeta();
  const rate = await checkRateLimit(
    db,
    `password-reset:${meta.ipHash}:${email}`,
    5,
    30 * 60,
  );
  if (!rate.allowed) {
    return { error: "Too many reset requests. Try again later." };
  }

  const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = userRows[0];
  // Always respond with the same message so the endpoint cannot be used to
  // enumerate accounts. The reset token is only created for real accounts.
  if (user) {
    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000);
    await db.insert(passwordResets).values({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
      consumedAt: null,
      createdAt: new Date(),
    });
    const resetUrl = `${siteUrl}/login/reset?token=${token}`;
    const text = [
      "You requested a password reset for your Esimprove demo account.",
      "",
      resetUrl,
      "",
      "This link expires in 30 minutes and can only be used once.",
      "The email was delivered by the local mock transport. No real email was sent.",
    ].join("\n");
    try {
      await getEmailTransport().send({
        to: user.email,
        subject: "Reset your Esimprove demo password",
        text,
        template: "auth.password_reset",
        orderId: user.id,
      });
    } catch {
      // Demo builds keep the reset token valid; failures are surfaced by the
      // reset step itself. No real delivery provider is configured here.
    }
  }

  return { success: true };
}

export async function resetPasswordAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = resetPasswordSchema.safeParse({
    token: formString(formData, "token"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { error: zodMessage(parsed.error) };
  }

  const db = await getDb();
  const token = formString(formData, "token");
  const tokenHash = hashToken(token);
  const resetRows = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.tokenHash, tokenHash))
    .limit(1);
  const reset = resetRows[0];
  if (!reset || reset.consumedAt) {
    return { error: "This password reset link is invalid or has already been used." };
  }
  if (reset.expiresAt < new Date()) {
    return { error: "This password reset link has expired. Request a new one." };
  }

  const userRows = await db.select().from(users).where(eq(users.id, reset.userId)).limit(1);
  const user = userRows[0];
  if (!user) {
    return { error: "Account not found. Request a new reset link." };
  }

  await db
    .update(passwordResets)
    .set({ consumedAt: new Date() })
    .where(eq(passwordResets.id, reset.id));
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.password),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  // A password reset invalidates any session that was created before it.
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await recordAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "auth.password_reset",
    entityType: "user",
    entityId: user.id,
    metadata: { tokenId: reset.id },
  });

  return { success: true };
}

export async function changePasswordAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getCurrentSession();
  if (!session) return { error: "You must be signed in to change your password." };
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formString(formData, "currentPassword"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { error: zodMessage(parsed.error) };
  }
  const db = await getDb();
  const userRows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  const user = userRows[0];
  if (!user) return { error: "Account not found." };
  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { error: "Your current password is incorrect." };

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.password),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  // Force re-authentication after a password change.
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await recordAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "auth.password_change",
    entityType: "user",
    entityId: user.id,
    metadata: {},
  });
  return { success: true };
}
