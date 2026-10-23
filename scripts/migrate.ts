import { loadLocalEnv } from "./env";

async function main(): Promise<void> {
  loadLocalEnv();
  const { createDatabase } = await import("@/lib/db/client");
  const { runMigrations } = await import("@/lib/db/migrate");
  const handle = await createDatabase({ connectionString: "" });
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
