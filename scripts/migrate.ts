import { loadLocalEnv } from "./env";

const DEPLOYED_CONTEXTS = new Set(["preview", "staging", "production"]);

async function main(): Promise<void> {
  loadLocalEnv();
  const { createDatabase } = await import("@/lib/db/client");
  const { runMigrations } = await import("@/lib/db/migrate");

  const appEnv = (process.env.APP_ENV || "local").trim().toLowerCase();
  const databaseEnv = (process.env.DATABASE_ENV || "").trim().toLowerCase();
  if (DEPLOYED_CONTEXTS.has(appEnv) && databaseEnv !== appEnv) {
    throw new Error(
      `Refusing to migrate: APP_ENV=${appEnv} but DATABASE_ENV=${databaseEnv || "unset"}. ` +
        "Set DATABASE_ENV to the same deployed context.",
    );
  }

  const connectionString =
    process.env.DATABASE_MIGRATION_URL?.trim() ||
    (DEPLOYED_CONTEXTS.has(appEnv) ? "" : process.env.DATABASE_URL?.trim());
  if (DEPLOYED_CONTEXTS.has(appEnv) && !connectionString) {
    throw new Error(
      `Refusing to migrate APP_ENV=${appEnv} without DATABASE_MIGRATION_URL. ` +
        "Use the direct/session connection string; the pooled runtime URL is not safe for session advisory locks.",
    );
  }

  const target = connectionString ? "PostgreSQL (target redacted)" : `PGlite (local directory)`;
  console.log(`Applying migrations to ${target} (APP_ENV=${appEnv})...`);

  const handle = await createDatabase(
    connectionString ? { connectionString } : { connectionString: "" },
  );
  try {
    await runMigrations(handle.client, handle.dialect);
    console.log(`Migrations applied on ${handle.dialect}.`);
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
