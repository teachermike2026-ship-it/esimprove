import { loadLocalEnv } from "./env";

/**
 * Creates the 8 storefront regions (Europe, North America, Asia, Oceania,
 * Middle East, Africa, South America, Global) on an empty database, with the
 * same ids, slugs, names and accents as the live site. The eSIM Access catalog
 * sync needs at least one region to exist before it can assign destinations.
 *
 * Inserts only: rows that already exist (same id or slug) are left untouched,
 * so it is safe to re-run. It never creates destinations or plans; the catalog
 * sync does that from the supplier. Same database-target guards as
 * scripts/migrate.ts.
 */
const DEPLOYED_CONTEXTS = new Set(["preview", "staging", "production"]);

async function main(): Promise<void> {
  loadLocalEnv();
  const appEnv = (process.env.APP_ENV || "local").trim().toLowerCase();
  const databaseEnv = (process.env.DATABASE_ENV || "").trim().toLowerCase();
  if (DEPLOYED_CONTEXTS.has(appEnv) && databaseEnv !== appEnv) {
    throw new Error(
      `Refusing to bootstrap regions: APP_ENV=${appEnv} but DATABASE_ENV=${databaseEnv || "unset"}.`,
    );
  }
  const connectionString =
    process.env.DATABASE_MIGRATION_URL?.trim() ||
    (DEPLOYED_CONTEXTS.has(appEnv) ? "" : process.env.DATABASE_URL?.trim());
  if (DEPLOYED_CONTEXTS.has(appEnv) && !connectionString) {
    throw new Error(`Refusing to bootstrap regions for APP_ENV=${appEnv} without DATABASE_MIGRATION_URL.`);
  }

  const { createDatabase } = await import("@/lib/db/client");
  const { regions } = await import("@/lib/db/schema");
  const { demoRegions } = await import("@/data/demo-catalog");

  const target = connectionString ? "PostgreSQL (target redacted)" : "PGlite (local directory)";
  console.log(`Bootstrapping storefront regions on ${target} (APP_ENV=${appEnv})...`);
  const handle = await createDatabase(connectionString ? { connectionString } : { connectionString: "" });
  try {
    const before = await handle.db.select({ id: regions.id }).from(regions);
    await handle.db.insert(regions).values(demoRegions).onConflictDoNothing();
    const after = await handle.db.select({ id: regions.id }).from(regions);
    console.log(`Regions: ${before.length} before, ${after.length} after (${after.length - before.length} added).`);
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error("Region bootstrap failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
