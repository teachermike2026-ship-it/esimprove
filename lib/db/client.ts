import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { assertProductionSafe } from "@/lib/config";
import { schema } from "@/lib/db/schema";
import { runMigrations } from "@/lib/db/migrate";

export type Database = PgliteDatabase<typeof schema>;
export type DatabaseClient = PGlite | Pool;
export type DatabaseDialect = "pglite" | "postgres";

export interface DatabaseHandle {
  db: Database;
  client: DatabaseClient;
  dialect: DatabaseDialect;
  close: () => Promise<void>;
}

type GlobalWithDb = typeof globalThis & {
  __esimproveDbPromise?: Promise<DatabaseHandle>;
};

const globalForDb = globalThis as GlobalWithDb;

export async function createDatabase(options?: {
  dataDir?: string;
  connectionString?: string;
}): Promise<DatabaseHandle> {
  const connectionString =
    options && Object.prototype.hasOwnProperty.call(options, "connectionString")
      ? options.connectionString
      : process.env.DATABASE_URL;

  if (connectionString) {
    const pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX || "5"),
      ssl:
        process.env.DATABASE_SSL === "disable"
          ? false
          : process.env.DATABASE_SSL === "require"
            ? { rejectUnauthorized: false }
            : undefined,
    });
    const db = drizzlePg(pool, { schema }) as unknown as Database;
    return {
      db,
      client: pool,
      dialect: "postgres",
      close: async () => {
        await pool.end();
      },
    };
  }

  const dataDir = options?.dataDir ?? process.env.PGLITE_DATA_DIR ?? ".pglite";
  const client = dataDir === "memory://" ? new PGlite() : new PGlite(dataDir);
  const db = drizzle(client, { schema });
  return {
    db,
    client,
    dialect: "pglite",
    close: async () => {
      await client.close();
    },
  };
}

export async function getDb(): Promise<Database> {
  assertProductionSafe();
  if (!globalForDb.__esimproveDbPromise) {
    globalForDb.__esimproveDbPromise = (async () => {
      const handle = await createDatabase();
      await runMigrations(handle.client, handle.dialect);
      return handle;
    })();
  }
  const handle = await globalForDb.__esimproveDbPromise;
  return handle.db;
}

export async function getDbHandle(): Promise<DatabaseHandle> {
  assertProductionSafe();
  if (!globalForDb.__esimproveDbPromise) {
    globalForDb.__esimproveDbPromise = (async () => {
      const handle = await createDatabase();
      await runMigrations(handle.client, handle.dialect);
      return handle;
    })();
  }
  return globalForDb.__esimproveDbPromise;
}

export async function closeDb(): Promise<void> {
  const handle = await globalForDb.__esimproveDbPromise;
  if (handle) {
    await handle.close();
    globalForDb.__esimproveDbPromise = undefined;
  }
}
