import { loadLocalEnv } from "./env";

const BASE32 = /^[A-Z2-7]{16,64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for admin bootstrap.`);
  return value;
}

async function main(): Promise<void> {
  loadLocalEnv();

  const appEnv = (process.env.APP_ENV || "local").trim().toLowerCase();
  if (appEnv === "production" && process.env.ADMIN_CREATE_CONFIRM !== "CREATE") {
    throw new Error(
      "Refusing to create a production admin without ADMIN_CREATE_CONFIRM=CREATE. " +
        "Set it only for this one command.",
    );
  }
  const databaseEnv = (process.env.DATABASE_ENV || "").trim().toLowerCase();
  if (appEnv === "production" && databaseEnv !== "production") {
    throw new Error("APP_ENV=production requires DATABASE_ENV=production for admin bootstrap.");
  }

  const email = required("ADMIN_EMAIL").toLowerCase();
  if (!EMAIL.test(email)) throw new Error("ADMIN_EMAIL must be a valid email address.");
  const password = required("ADMIN_PASSWORD");
  if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters.");
  const totpSecret = required("ADMIN_TOTP_SECRET").replace(/\s+/g, "").toUpperCase();
  if (!BASE32.test(totpSecret)) {
    throw new Error("ADMIN_TOTP_SECRET must be a base32 authenticator secret (16–64 characters).");
  }
  if (!process.env.ACTIVATION_KEK_V1) {
    throw new Error("ACTIVATION_KEK_V1 is required to encrypt the admin TOTP secret.");
  }

  const connectionString =
    process.env.DATABASE_MIGRATION_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_MIGRATION_URL or DATABASE_URL is required for admin bootstrap.");
  }

  const { createDatabase } = await import("@/lib/db/client");
  const { users } = await import("@/lib/db/schema");
  const { hashPassword } = await import("@/lib/auth/password");
  const { encryptSecret } = await import("@/lib/crypto");
  const { eq } = await import("drizzle-orm");

  const handle = await createDatabase({ connectionString });
  try {
    const existing = await handle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length > 0) {
      throw new Error(`A user with ${email} already exists; no admin was created.`);
    }

    await handle.db.insert(users).values({
      id: crypto.randomUUID(),
      email,
      name: process.env.ADMIN_NAME?.trim() || "Administrator",
      passwordHash: await hashPassword(password),
      role: "admin",
      emailVerifiedAt: new Date(),
      totpEnabled: true,
      totpSecretEncrypted: encryptSecret(totpSecret),
    });

    console.log(`Administrator created for ${email}.`);
    console.log("The password and TOTP secret were not logged. Enrol the TOTP secret now.");
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error("Admin bootstrap failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
