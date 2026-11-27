"use server";

import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { passwordResets, sessions, users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { decryptSecret } from "@/lib/crypto";
import { hashToken, randomToken } from "@/lib/crypto";
import { verifyTotp } from "@/lib/auth/totp";
import { sendTransactionalEmail } from "@/lib/email-notices";
import {
  emailVerificationEmail,
  passwordChangedEmail,
  passwordResetEmail,
} from "@/lib/email-templates";
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
  ownerFirstLoginPasswordSchema,
  safeNextPath,
  zodMessage,
  emailSchema,
} from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { isAdminRole } from "@/lib/auth/roles";
import { flags, sessionCookieName, siteUrl } from "@/lib/config";
import { recordConsent } from "@/lib/consents";
import { loadLegalSettings } from "@/lib/legal";
import { LEGAL_DOCUMENT_VERSION } from "@/lib/legal-profile";
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
  // Limit both the account and the source address. A single email+IP key can be
  // bypassed by rotating one dimension, while an account-only key lets an
  // attacker lock out a known address. Keep the two counters independent.
  const [accountRate, ipRate] = await Promise.all([
    checkRateLimit(db, `login:account:${email}`, 10, 15 * 60),
    checkRateLimit(db, `login:ip:${meta.ipHash}`, 30, 15 * 60),
  ]);
  if (!accountRate.allowed || !ipRate.allowed) {
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
  const mustChangePassword = user.passwordChangeRequired && adminAccount;

  // When 2FA is not required (local dev), skip the TOTP gate entirely — both
  // the "no secret" block and the 2FA redirect. The secret and the login
  // code are untouched and re-enabling ADMIN_2FA_REQUIRED restores the gate.
  if (adminAccount && flags.admin2faRequired) {
    if (!user.totpEnabled) {
      return {
        error:
          "This admin account has no TOTP secret. Admin sign-in is blocked until 2FA is configured.",
      };
    }

    const pending = await createSession(db, user.id, {
      pendingTwoFactor: true,
      ttlMinutes: 10,
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    });
    await setSessionCookie(pending.token, pending.expiresAt);
    // A first-login owner must rotate the temporary password before any admin
    // surface is opened.
    const destination = mustChangePassword ? "/admin/set-password" : nextPath;
    redirect(`/login/2fa?next=${encodeURIComponent(destination)}`);
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
  redirect(mustChangePassword ? "/admin/set-password" : nextPath);
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
  redirect(session.user.passwordChangeRequired ? "/admin/set-password" : nextPath);
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
    parsed.data.termsVersion !== LEGAL_DOCUMENT_VERSION ||
    parsed.data.privacyVersion !== LEGAL_DOCUMENT_VERSION
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
    version: LEGAL_DOCUMENT_VERSION,
    accepted: true,
    ...consentContext,
  });
  await recordConsent(db, {
    userId,
    purpose: "privacy",
    version: LEGAL_DOCUMENT_VERSION,
    accepted: true,
    ...consentContext,
  });
  await recordConsent(db, {
    userId,
    purpose: "age",
    version: LEGAL_DOCUMENT_VERSION,
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

  await issueEmailVerificationToken(db, {
    userId,
    email,
    actorType: "user",
  });

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
  // Back to where the customer came from (for example checkout), otherwise
  // the profile page that explains email verification.
  const nextPath = safeNextPath(formString(formData, "next"), "");
  redirect(nextPath || "/portal/profile?verification=sent");
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
const EMAIL_VERIFICATION_TTL_HOURS = 24;

async function issueEmailVerificationToken(
  db: Awaited<ReturnType<typeof getDb>>,
  input: { userId: string; email: string; actorType: string },
): Promise<void> {
  const now = new Date();
  await db
    .update(passwordResets)
    .set({ consumedAt: now })
    .where(
      and(
        eq(passwordResets.userId, input.userId),
        eq(passwordResets.purpose, "email_verification"),
        isNull(passwordResets.consumedAt),
      ),
    );
  const token = randomToken(32);
  await db.insert(passwordResets).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    tokenHash: hashToken(token),
    purpose: "email_verification",
    expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000),
    consumedAt: null,
    createdAt: now,
  });
  const template = emailVerificationEmail(
    `${siteUrl}/verify-email?token=${encodeURIComponent(token)}`,
  );
  await sendTransactionalEmail(db, {
    to: input.email,
    subject: template.subject,
    text: template.text,
    template: "auth.email_verification",
  });
  await recordAudit(db, {
    actorType: input.actorType,
    actorId: input.userId,
    action: "auth.email_verification_sent",
    entityType: "user",
    entityId: input.userId,
    metadata: {},
  });
}

export async function requestEmailVerificationAction(): Promise<{
  error?: string;
  success?: boolean;
}> {
  const session = await getCurrentSession();
  if (!session || session.pendingTwoFactor) {
    return { error: "Sign in to request email verification." };
  }
  const db = await getDb();
  const rate = await checkRateLimit(db, `verify-email:${session.user.id}`, 3, 60 * 60);
  if (!rate.allowed) {
    return { error: "Too many verification emails. Try again in an hour." };
  }
  const rows = await db
    .select({ emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (rows[0]?.emailVerifiedAt) {
    return { success: true };
  }
  await issueEmailVerificationToken(db, {
    userId: session.user.id,
    email: session.user.email,
    actorType: "user",
  });
  return { success: true };
}

export async function verifyEmailAction(formData: FormData): Promise<void> {
  const token = formString(formData, "token");
  if (token.length < 20 || token.length > 200) redirect("/verify-email?status=invalid");
  const db = await getDb();
  const resetRows = await db
    .select()
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, hashToken(token)),
        eq(passwordResets.purpose, "email_verification"),
      ),
    )
    .limit(1);
  const verification = resetRows[0];
  if (!verification || verification.consumedAt || verification.expiresAt < new Date()) {
    redirect("/verify-email?status=invalid");
  }
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, verification.userId))
    .limit(1);
  const user = userRows[0];
  if (!user) redirect("/verify-email?status=invalid");

  await db.transaction(async (tx) => {
    const claimed = await tx
      .update(passwordResets)
      .set({ consumedAt: new Date() })
      .where(and(eq(passwordResets.id, verification.id), isNull(passwordResets.consumedAt)))
      .returning({ id: passwordResets.id });
    if (claimed.length === 0) return;
    await tx
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await recordAudit(tx, {
      actorType: "user",
      actorId: user.id,
      action: "auth.email_verified",
      entityType: "user",
      entityId: user.id,
      metadata: {},
    });
  });
  const session = await getCurrentSession();
  if (session?.user.id === user.id) redirect("/portal/profile?verified=1");
  redirect("/login?verified=1");
}

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
    const now = new Date();
    await db
      .update(passwordResets)
      .set({ consumedAt: now })
      .where(
        and(
          eq(passwordResets.userId, user.id),
          eq(passwordResets.purpose, "password_reset"),
          isNull(passwordResets.consumedAt),
        ),
      );
    const token = randomToken(32);
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MINUTES * 60_000);
    await db.insert(passwordResets).values({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash: hashToken(token),
      purpose: "password_reset",
      expiresAt,
      consumedAt: null,
      createdAt: now,
    });
    const template = passwordResetEmail(
      `${siteUrl}/login/reset?token=${encodeURIComponent(token)}`,
    );
    await sendTransactionalEmail(db, {
      to: user.email,
      subject: template.subject,
      text: template.text,
      template: "auth.password_reset",
    });
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
    .where(
      and(
        eq(passwordResets.tokenHash, tokenHash),
        eq(passwordResets.purpose, "password_reset"),
      ),
    )
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

  await db.transaction(async (tx) => {
    await tx.update(passwordResets).set({ consumedAt: new Date() }).where(eq(passwordResets.id, reset.id));
    await tx.update(users).set({
      passwordHash: await hashPassword(parsed.data.password),
      passwordChangeRequired: false,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });
  await recordAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "auth.password_reset",
    entityType: "user",
    entityId: user.id,
    metadata: { tokenId: reset.id },
  });

  const changedTemplate = passwordChangedEmail();
  await sendTransactionalEmail(db, {
    to: user.email,
    subject: changedTemplate.subject,
    text: changedTemplate.text,
    template: "auth.password_changed",
  });

  return { success: true };
}

export async function changePasswordAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getCurrentSession();
  // A pending second factor is an untrusted session, but a first-login
  // password rotation (passwordChangeRequired) is exactly the moment a
  // user chooses a new password — allow it here and clear the flag.
  if (!session || session.pendingTwoFactor) return { error: "You must be fully signed in to change your password." };
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

  await db.transaction(async (tx) => {
    await tx.update(users).set({
      passwordHash: await hashPassword(parsed.data.password),
      passwordChangeRequired: false,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });
  // A password reset invalidates any session that was created before it.
  await recordAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "auth.password_change",
    entityType: "user",
    entityId: user.id,
    metadata: {},
  });

  const changedTemplate = passwordChangedEmail();
  await sendTransactionalEmail(db, {
    to: user.email,
    subject: changedTemplate.subject,
    text: changedTemplate.text,
    template: "auth.password_changed",
  });
  return { success: true };
}

/**
 * Owner first-login password rotation. Called from the dedicated
 * /admin/set-password screen after the owner authenticated with the temporary
 * password (and passed admin TOTP). Saves the new password, clears the
 * first-login requirement, and invalidates all existing sessions so the owner
 * must authenticate again with the new password.
 */
export async function setNewOwnerPasswordAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getCurrentSession();
  if (!session || session.pendingTwoFactor || !session.user.passwordChangeRequired || !isAdminRole(session.user.role)) {
    return { error: "A fully authenticated account requiring password rotation is required." };
  }
  const parsed = ownerFirstLoginPasswordSchema.safeParse({
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const db = await getDb();
  const userRows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  const user = userRows[0];
  if (!user) return { error: "Account not found." };
  if (!isAdminRole(user.role)) {
    return { error: "Owner password rotation is restricted to administrator accounts." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const changed = await db.transaction(async (tx) => {
    const updated = await tx.update(users)
      .set({ passwordHash, passwordChangeRequired: false, updatedAt: new Date() })
      .where(and(eq(users.id, user.id), eq(users.passwordChangeRequired, true), eq(users.passwordHash, user.passwordHash)))
      .returning({ id: users.id });
    if (!updated.length) return false;
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    return true;
  });
  if (!changed) return { error: "Password rotation has already been completed. Sign in again." };
  await recordAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "auth.password_change_first_login",
    entityType: "user",
    entityId: user.id,
    metadata: { firstLogin: true },
  });

  return { success: true };
}
