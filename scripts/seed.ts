import { loadLocalEnv } from "./env";

async function main(): Promise<void> {
  loadLocalEnv();
  const { createDatabase } = await import("@/lib/db/client");
  const { runMigrations } = await import("@/lib/db/migrate");
  const { seedDemoData } = await import("@/lib/db/seed");
  const handle = await createDatabase({ connectionString: "" });
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
