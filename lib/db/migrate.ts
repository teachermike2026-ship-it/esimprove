import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import type { DatabaseClient, DatabaseDialect } from "@/lib/db/client";

interface QueryClient {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
  exec?: (sql: string) => Promise<unknown>;
}

// Arbitrary, stable key for the schema migration advisory lock.
const MIGRATION_LOCK_KEY = 1481193201;

async function exec(client: DatabaseClient, sql: string): Promise<void> {
  const queryClient = client as unknown as QueryClient;
  if (typeof queryClient.exec === "function") {
    await queryClient.exec(sql);
    return;
  }
  await queryClient.query(sql);
}

async function query<T>(
  client: DatabaseClient,
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const queryClient = client as unknown as QueryClient;
  const result = await queryClient.query(sql, params);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function checksumOf(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

async function migrationFiles(migrationDir: string): Promise<string[]> {
  return (await readdir(migrationDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

export interface MigrationStatus {
  /** Whether schema_migrations could be read (false on a pre-migration database). */
  checked: boolean;
  applied: string[];
  pending: string[];
}

/**
 * Read-only migration status for health checks and deployment verification.
 * Never creates tables or applies SQL.
 */
export async function listPendingMigrations(
  client: DatabaseClient,
  options: RunMigrationsOptions = {},
): Promise<MigrationStatus> {
  const migrationDir =
    options.migrationDir ?? path.join(process.cwd(), "db", "migrations");
  const files = await migrationFiles(migrationDir);
  try {
    const appliedRows = await query<{ id: string }>(
      client,
      "SELECT id FROM schema_migrations ORDER BY id",
    );
    const appliedSet = new Set(appliedRows.map((row) => row.id));
    return {
      checked: true,
      applied: files.filter((file) => appliedSet.has(file)),
      pending: files.filter((file) => !appliedSet.has(file)),
    };
  } catch {
    return { checked: false, applied: [], pending: files };
  }
}

async function migrateOn(
  client: DatabaseClient,
  dialect: DatabaseDialect,
  migrationDir: string,
): Promise<void> {
  await exec(
    client,
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
  // Older local databases predate checksum tracking. Add it in place rather
  // than requiring a reset, then backfill on the next run.
  await exec(client, "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text");

  const files = await migrationFiles(migrationDir);

  const appliedRows = await query<{ id: string; checksum: string | null }>(
    client,
    "SELECT id, checksum FROM schema_migrations",
  );
  const applied = new Map(appliedRows.map((row) => [row.id, row.checksum]));

  for (const file of files) {
    const sql = await readFile(path.join(migrationDir, file), "utf8");
    const checksum = checksumOf(sql);
    const previousChecksum = applied.get(file);

    if (previousChecksum !== undefined) {
      if (previousChecksum && previousChecksum !== checksum) {
        throw new Error(
          `Migration ${file} checksum mismatch: the file changed after it was applied. ` +
            "Create a new migration instead of editing an applied one.",
        );
      }
      if (!previousChecksum) {
        await query(client, "UPDATE schema_migrations SET checksum = $1 WHERE id = $2", [
          checksum,
          file,
        ]);
      }
      continue;
    }

    try {
      await exec(client, "BEGIN");
      await exec(client, sql);
      await query(client, "INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)", [
        file,
        checksum,
      ]);
      await exec(client, "COMMIT");
    } catch (error) {
      try {
        await exec(client, "ROLLBACK");
      } catch {
        // Preserve the original migration error.
      }
      throw new Error(
        `Migration ${file} failed on ${dialect}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function isPostgresPool(client: DatabaseClient, dialect: DatabaseDialect): client is Pool {
  return (
    dialect === "postgres" &&
    typeof (client as unknown as { connect?: unknown }).connect === "function"
  );
}

export interface RunMigrationsOptions {
  /** Override the migration directory (used by upgrade tests). */
  migrationDir?: string;
}

/**
 * Apply pending SQL migrations in filename order.
 *
 * PostgreSQL runs on one dedicated connection so BEGIN/COMMIT cannot span
 * different pooled sessions, and takes a session advisory lock so two deploys
 * cannot apply migrations concurrently. PGlite is single-connection and needs
 * neither.
 */
export async function runMigrations(
  client: DatabaseClient,
  dialect: DatabaseDialect,
  options: RunMigrationsOptions = {},
): Promise<void> {
  const migrationDir =
    options.migrationDir ?? path.join(process.cwd(), "db", "migrations");

  if (!isPostgresPool(client, dialect)) {
    await migrateOn(client, dialect, migrationDir);
    return;
  }

  const connection: PoolClient = await client.connect();
  let locked = false;
  try {
    await exec(connection as unknown as DatabaseClient, "SET lock_timeout = '15s'");
    await query(connection as unknown as DatabaseClient, "SELECT pg_advisory_lock($1)", [
      MIGRATION_LOCK_KEY,
    ]);
    locked = true;
    await migrateOn(connection as unknown as DatabaseClient, dialect, migrationDir);
  } finally {
    if (locked) {
      try {
        await query(connection as unknown as DatabaseClient, "SELECT pg_advisory_unlock($1)", [
          MIGRATION_LOCK_KEY,
        ]);
      } catch (error) {
        console.error(
          "Failed to release migration advisory lock",
          error instanceof Error ? error.name : "unknown error",
        );
      }
    }
    connection.release();
  }
}
