import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  auditLogs,
  destinations,
  plans,
  regions,
  users,
} from "@/lib/db/schema";
import { demoDestinations, demoPlans, demoRegions } from "@/data/demo-catalog";
import { hashPassword } from "@/lib/auth/password";
import { encryptSecret } from "@/lib/crypto";

export interface SeedOptions {
  adminEmail?: string;
  adminPassword?: string;
  adminTotpSecret?: string;
}

export interface SeedResult {
  regions: number;
  destinations: number;
  plans: number;
  adminCreated: boolean;
}

export async function seedDemoData(db: Database, options: SeedOptions = {}): Promise<SeedResult> {
  await db.insert(regions).values(demoRegions).onConflictDoNothing();

  await db.insert(destinations).values(demoDestinations).onConflictDoNothing();

  await db
    .insert(plans)
    .values(
      demoPlans.map((plan) => ({
        ...plan,
        updatedAt: new Date(),
      })),
    )
    .onConflictDoNothing();

  let adminCreated = false;
  const adminEmail = (options.adminEmail || process.env.DEMO_ADMIN_EMAIL || "admin@demo.local")
    .trim()
    .toLowerCase();
  const adminPassword = options.adminPassword || process.env.DEMO_ADMIN_PASSWORD;
  const adminTotpSecret = options.adminTotpSecret || process.env.DEMO_ADMIN_TOTP_SECRET;

  if (adminEmail && adminPassword && adminTotpSecret) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail));
    if (existing.length === 0) {
      await db.insert(users).values({
        id: crypto.randomUUID(),
        email: adminEmail,
        name: "Demo Administrator",
        passwordHash: await hashPassword(adminPassword),
        role: "admin",
        emailVerifiedAt: new Date(),
        totpEnabled: true,
        totpSecretEncrypted: encryptSecret(adminTotpSecret),
      });
      adminCreated = true;
    }
  }

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorType: "system",
    actorId: null,
    action: "demo.seed",
    entityType: "catalogue",
    entityId: "demo",
    metadata: {
      label: "DEMO CATALOGUE — NOT REAL SUPPLIER DATA",
      regions: demoRegions.length,
      destinations: demoDestinations.length,
      plans: demoPlans.length,
      adminCreated,
    },
  });

  return {
    regions: demoRegions.length,
    destinations: demoDestinations.length,
    plans: demoPlans.length,
    adminCreated,
  };
}
