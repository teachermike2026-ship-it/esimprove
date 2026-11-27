/**
 * Import / refresh the real eSIM Access catalog into the ESIMPROVE database.
 *
 *   npm run catalog:sync                 -> sync into the configured database
 *   npm run catalog:sync -- --data-dir <path>   -> sync into another PGlite copy
 *
 * Calls ONLY POST /api/v1/open/package/list (read-only). No order, top-up,
 * balance, or other supplier endpoint is ever called.
 *
 * Local PGlite can only be opened by one process. When the local database is
 * the target, this script refuses to run while a website server is listening
 * on port 3000 or 3001: stop the server, run the sync, start the server again.
 * Deployed PostgreSQL targets are refused here; use the scheduled job
 * (CATALOGUE_SYNC_ENABLED=true) after migrating the deployed database.
 */
import { createConnection } from "node:net";
import { loadLocalEnv } from "./env";

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(800);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function main(): Promise<void> {
  loadLocalEnv();
  const args = process.argv.slice(2);
  const dataDirIndex = args.indexOf("--data-dir");
  const dataDir = dataDirIndex >= 0 ? args[dataDirIndex + 1] : undefined;

  const appEnv = (process.env.APP_ENV || "local").trim().toLowerCase();
  if (["preview", "staging", "production"].includes(appEnv)) {
    throw new Error(`Refusing to run against APP_ENV=${appEnv}. Use the scheduled job on the deployment.`);
  }
  const usesPostgres = !dataDir && Boolean(process.env.DATABASE_URL?.trim());
  if (!dataDir && !usesPostgres) {
    for (const port of [3000, 3001]) {
      if (await portOpen(port)) {
        throw new Error(
          `A server is running on port ${port} and holds the local PGlite database. ` +
            "Stop it, run `npm run catalog:sync`, then start it again.",
        );
      }
    }
  }

  const { createDatabase } = await import("@/lib/db/client");
  const { runMigrations } = await import("@/lib/db/migrate");
  const { runEsimAccessCatalogSync } = await import("@/lib/supplier-catalog/esimaccess-sync");

  const handle = await createDatabase(
    dataDir ? { dataDir, connectionString: "" } : usesPostgres ? { connectionString: process.env.DATABASE_URL!.trim() } : { connectionString: "" },
  );
  try {
    await runMigrations(handle.client, handle.dialect);
    const result = await runEsimAccessCatalogSync(handle.db);
    const { excluded, ...summary } = result;
    console.log(JSON.stringify({ ...summary, excludedCount: excluded.length }, null, 2));
    if (excluded.length > 0) {
      console.log("Excluded packages (not for sale):");
      for (const item of excluded.slice(0, 50)) console.log(`  ${item.packageCode}: ${item.reason}`);
    }
  } finally {
    await handle.close();
  }
}

main().catch((error: unknown) => {
  console.error("Catalog sync failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
