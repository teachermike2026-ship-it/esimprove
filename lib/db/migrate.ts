import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DatabaseClient, DatabaseDialect } from "@/lib/db/client";

interface QueryClient {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
  exec?: (sql: string) => Promise<unknown>;
}

async function exec(client: DatabaseClient, sql: string): Promise<void> {
  const queryClient = client as unknown as QueryClient;
  if (typeof queryClient.exec === "function") {
    await queryClient.exec(sql);
    return;
  }
  await queryClient.query(sql);
}

async function query<T>(client: DatabaseClient, sql: string): Promise<T[]> {
  const queryClient = client as unknown as QueryClient;
  const result = await queryClient.query(sql);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export async function runMigrations(
  client: DatabaseClient,
  dialect: DatabaseDialect,
): Promise<void> {
  await exec(
    client,
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`,
  );

  const migrationDir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(migrationDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  const appliedRows = await query<{ id: string }>(client, "SELECT id FROM schema_migrations");
  const applied = new Set(appliedRows.map((row) => row.id));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationDir, file), "utf8");
    try {
      await exec(client, "BEGIN");
      await exec(client, sql);
      await exec(
        client,
        `INSERT INTO schema_migrations (id) VALUES ('${file.replace(/'/g, "''")}')`,
      );
      await exec(client, "COMMIT");
    } catch (error) {
      await exec(client, "ROLLBACK");
      throw new Error(
        `Migration ${file} failed on ${dialect}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
