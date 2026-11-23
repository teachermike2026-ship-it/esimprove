import { loadLocalEnv } from "./env";

const DEPLOYED_CONTEXTS = new Set(["preview", "staging", "production"]);

async function main(): Promise<void> {
  loadLocalEnv();
  const { createDatabase } = await import("@/lib/db/client");
  const { runMigrations } = await import("@/lib/db/migrate");
  const { seedDemoData } = await import("@/lib/db/seed");

  const appEnv = (process.env.APP_ENV || "local").trim().toLowerCase();
  if (appEnv === "production") {
    throw new Error("Demo seeding is disabled when APP_ENV=production.");
  }
  if (process.env.SEED_DEMO_DATA === "false") {
    throw new Error("Demo seeding is disabled by SEED_DEMO_DATA=false.");
  }

  const databaseEnv = (process.env.DATABASE_ENV || "").trim().toLowerCase();
  if (DEPLOYED_CONTEXTS.has(appEnv) && databaseEnv !== appEnv) {
    throw new Error(
      `Refusing to seed: APP_ENV=${appEnv} but DATABASE_ENV=${databaseEnv || "unset"}. ` +
        "Set DATABASE_ENV to the same deployed context.",
    );
  }

  const connectionString =
    process.env.DATABASE_MIGRATION_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (DEPLOYED_CONTEXTS.has(appEnv) && !connectionString) {
    throw new Error(
      `Refusing to seed APP_ENV=${appEnv} without DATABASE_MIGRATION_URL or DATABASE_URL; no local PGlite fallback is allowed for a deployed context.`,
    );
  }

  const target = connectionString ? "PostgreSQL (target redacted)" : `PGlite (local directory)`;
  console.log(`Seeding demo catalogue into ${target} (APP_ENV=${appEnv})...`);

  const handle = await createDatabase(
    connectionString ? { connectionString } : { connectionString: "" },
  );
  try {
    await runMigrations(handle.client, handle.dialect);
    const result = await seedDemoData(handle.db);
    console.log(
      `Seeded demo catalogue: ${result.regions} regions, ${result.destinations} destinations, ${result.plans} plans.`,
    );
    console.log(result.adminCreated ? "Demo admin created." : "Demo admin already exists.");
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
