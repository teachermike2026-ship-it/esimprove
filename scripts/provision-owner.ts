import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { loadLocalEnv } from "./env";
import { createDatabase } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { encryptSecret } from "@/lib/crypto";
import { generateTotpSecret, otpauthUrl, totpCode } from "@/lib/auth/totp";
import { recordAudit } from "@/lib/audit";

/**
 * Provision or repair the local owner administrator account.
 *
 * The temporary password is read from stdin and never written to disk, logs,
 * source control, or the environment. It is printed to stdout once, so the
 * operator must run this in a private interactive terminal.
 *
 * Safety:
 * - PGlite only. Refuses DATABASE_URL, deployed environments, and memory://.
 * - Prints the exact resolved data directory before touching anything.
 * - Refuses to create a second account for the same email.
 * - Requires --repair to update an existing administrator account.
 * - Writes a verified compressed backup of the data directory before any
 *   insert/update. Aborts if the backup cannot be created.
 * - Rotating an existing account revokes its active sessions.
 * - Uses createDatabase() directly, so it does not run migrations.
 */

loadLocalEnv();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "teacher.mike2026@gmail.com").trim().toLowerCase();
const MIN_PASSWORD_LENGTH = 20;
const MAX_PASSWORD_LENGTH = 200;
const BACKUP_DIR = path.join(process.cwd(), ".audit", "backups");

interface ExistingOwner {
  id: string;
  role: string;
  emailVerifiedAt: Date | null;
  totpEnabled: boolean;
  passwordChangeRequired: boolean;
}

class ProvisioningError extends Error {}

function fail(message: string): never {
  throw new ProvisioningError(message);
}

function readPasswordFromStdin(): string {
  if (process.stdin.isTTY) {
    fail("Pipe a password into this script over stdin; do not pass it as an argument.");
  }
  const raw = readFileSync(0).toString("utf8");
  return raw.trim();
}

function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`Temporary password must be at least ${MIN_PASSWORD_LENGTH} characters. No changes were made.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    fail(`Temporary password must be at most ${MAX_PASSWORD_LENGTH} characters. No changes were made.`);
  }
  // Fail closed on invisible or embedded whitespace/control characters. This is
  // the class of input that silently corrupted an earlier bootstrap attempt.
  if (!/^[\x21-\x7e]+$/.test(password)) {
    fail(
      "Temporary password must contain only printable ASCII characters with no spaces, " +
        "newlines, BOMs, or other control characters. No changes were made.",
    );
  }
}

async function writeBackup(
  client: unknown,
  mode: "create" | "repair",
): Promise<string> {
  let bytes: Buffer;
  try {
    const dump = (client as { dumpDataDir: () => Promise<Blob> }).dumpDataDir;
    if (typeof dump !== "function") throw new Error("dumpDataDir is unavailable for this target");
    const blob = await dump.call(client);
    bytes = Buffer.from(await blob.arrayBuffer());
  } catch (error) {
    fail(
      `Refusing to provision: pre-change backup failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (bytes.length < 1024 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    fail("Refusing to provision: pre-change backup is not a valid gzip archive.");
  }

  mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `owner-${mode}-${timestamp}.tar.gz`);
  try {
    writeFileSync(backupPath, bytes);
  } catch (error) {
    fail(
      `Refusing to provision: could not write backup: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return backupPath;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== "--repair");
  if (unknown.length > 0) fail(`Unknown argument: ${unknown[0]}`);
  const repair = args.includes("--repair");

  if ((process.env.DATABASE_URL ?? "").trim()) {
    fail("Refusing to provision: DATABASE_URL is set. This script is local PGlite only.");
  }

  const configuredDir = (process.env.PGLITE_DATA_DIR ?? "").trim() || ".pglite";
  if (configuredDir === "memory://") {
    fail("Refusing to provision against memory://. Use the persistent local data directory.");
  }
  const dataDir = path.resolve(configuredDir);
  if (!existsSync(dataDir)) {
    fail(
      `Refusing to provision: ${dataDir} does not exist. Start the local app once so PGlite ` +
        "initialises the intended database, then re-run this script.",
    );
  }
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    fail(`Refusing to provision: ${dataDir} is not a PGlite data directory (PG_VERSION missing).`);
  }

  console.log(`Database target: local PGlite at ${dataDir}`);
  console.log(`Mode: ${repair ? "repair existing owner" : "create owner"}`);

  const handle = await createDatabase({ dataDir, connectionString: "" });
  try {
    if (handle.dialect !== "pglite") {
      fail("Refusing to provision: target is not PGlite.");
    }
    const db = handle.db;

    const existingRows = await db
      .select({
        id: users.id,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
        totpEnabled: users.totpEnabled,
        passwordChangeRequired: users.passwordChangeRequired,
      })
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .limit(1);
    const existing: ExistingOwner | undefined = existingRows[0];

    if (existing && !repair) {
      console.error(`An account already exists for ${ADMIN_EMAIL}. No changes were made.`);
      console.error(`Role: ${existing.role}`);
      console.error(`Email verified: ${existing.emailVerifiedAt ? "yes" : "no"}`);
      console.error(`TOTP enabled: ${existing.totpEnabled ? "yes" : "no"}`);
      console.error(`Password change required: ${existing.passwordChangeRequired ? "yes" : "no"}`);
      console.error("Re-run with --repair to rotate its temporary password, TOTP secret, and sessions.");
      process.exitCode = 1;
      return;
    }

    if (existing && repair && existing.role !== "admin") {
      fail(
        `Refusing to repair ${ADMIN_EMAIL}: the existing account has role "${existing.role}", ` +
          "not \"admin\". No changes were made.",
      );
    }

    const password = readPasswordFromStdin();
    validatePassword(password);

    const totpSecret = generateTotpSecret();
    const passwordHash = await hashPassword(password);
    const backupPath = await writeBackup(handle.client, repair ? "repair" : "create");
    const now = new Date();

    if (existing) {
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({
            passwordHash,
            totpEnabled: true,
            totpSecretEncrypted: encryptSecret(totpSecret),
            passwordChangeRequired: true,
            emailVerifiedAt: existing.emailVerifiedAt ?? now,
            updatedAt: now,
          })
          .where(eq(users.id, existing.id));
        await tx.delete(sessions).where(eq(sessions.userId, existing.id));
        await recordAudit(tx, {
          actorType: "system",
          actorId: "owner-provisioning",
          action: "owner.account.repaired",
          entityType: "user",
          entityId: existing.id,
          metadata: {
            role: "admin",
            passwordChangeRequired: true,
            sessionsRevoked: true,
            passwordRotated: true,
            totpRotated: true,
          },
        });
      });
    } else {
      const userId = randomUUID();
      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          email: ADMIN_EMAIL,
          name: "ESIMPROVE Owner",
          passwordHash,
          role: "admin",
          emailVerifiedAt: now,
          totpEnabled: true,
          totpSecretEncrypted: encryptSecret(totpSecret),
          passwordChangeRequired: true,
          createdAt: now,
          updatedAt: now,
        });
        await recordAudit(tx, {
          actorType: "system",
          actorId: "owner-provisioning",
          action: "owner.account.created",
          entityType: "user",
          entityId: userId,
          metadata: { role: "admin", passwordChangeRequired: true },
        });
      });
    }

    console.log(`Pre-change backup: ${backupPath}`);
    console.log(existing ? "Owner admin account repaired." : "Owner admin account created.");
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Temporary password: ${password}`);
    console.log(`Current TOTP code (valid for about 30 seconds): ${totpCode(totpSecret)}`);
    console.log(`Authenticator setup URL (secret; keep private): ${otpauthUrl(totpSecret, ADMIN_EMAIL)}`);
    console.log(
      "Log in at http://localhost:3000/login?next=%2Fadmin, complete TOTP, then set a new " +
        "password at /admin/set-password. Do not paste this output into chat, files, or Git.",
    );
  } finally {
    await handle.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof ProvisioningError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  console.error("Owner provisioning failed:", error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
