import { generateTotpSecret } from "@/lib/auth/totp";
import { loadLocalEnv } from "../scripts/env";

loadLocalEnv();

const BASE32 = /^[A-Z2-7]{16,64}$/;

/**
 * Secure local owner bootstrap. Provisions an administrator account with a
 * hashed temporary password and an encrypted TOTP secret, marks the account as
 * requiring a first-login password rotation, and refuses to overwrite an
 * existing account. Credentials are supplied via environment variables only and
 * are never written to source control or logs.
 */
async function main(): Promise<void> {
  const env = (name: string) => (process.env[name] ?? "").trim();
  const email = env("ADMIN_EMAIL").toLowerCase();
  const password = env("ADMIN_PASSWORD");
  const totpSecret = env("ADMIN_TOTP_SECRET").replace(/\s+/g, "").toUpperCase();
  const name = env("ADMIN_NAME") || "ESIMPROVE Owner";

  if (!email || !password || !totpSecret) {
    throw new Error("ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_TOTP_SECRET are required for owner bootstrap.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("ADMIN_EMAIL must be a valid email address.");
  if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters.");
  if (!BASE32.test(totpSecret)) throw new Error("ADMIN_TOTP_SECRET must be a base32 authenticator secret (16-64 characters).");

  const { createDatabase } = await import("@/lib/db/client");
  const { users } = await import("@/lib/db/schema");
  const { hashPassword } = await import("@/lib/auth/password");
  const { encryptSecret } = await import("@/lib/crypto");
  const { eq } = await import("drizzle-orm");

  const handle = await createDatabase();
  try {
    const existing = await handle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length > 0) {
      throw new Error(`An administrator account already exists for ${email}; no owner was created.`);
    }

    const now = new Date();
    await handle.db.insert(users).values({
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash: await hashPassword(password),
      role: "admin",
      emailVerifiedAt: now,
      totpEnabled: true,
      totpSecretEncrypted: encryptSecret(totpSecret),
      passwordChangeRequired: true,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`Owner administrator created for ${email}.`);
    console.log("A temporary password was accepted for this session only; rotate it via the first-login screen.");
  } finally {
    await handle.close();
  }
}

void main().catch((error: unknown) => {
  console.error("Owner bootstrap failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
