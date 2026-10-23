"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { decryptSecret } from "@/lib/crypto";
import { verifyTotp } from "@/lib/auth/totp";
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
  safeNextPath,
  zodMessage,
} from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { flags, sessionCookieName } from "@/lib/config";

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

  const nextPath = safeNextPath(parsed.data.next, user.role === "admin" ? "/admin" : "/portal");

  if (user.role === "admin" && flags.admin2faRequired && !user.totpEnabled) {
    return {
      error:
        "This admin account has no TOTP secret. Admin sign-in is blocked until 2FA is configured.",
    };
  }

  if (user.role === "admin" && user.totpEnabled) {
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
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const db = await getDb();
  const meta = await requestMeta();
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
