import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { assertProductionSafe, isDeployed } from "@/lib/config";
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

function integerEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function databaseSsl():
  | false
  | {
      rejectUnauthorized: boolean;
      ca?: string;
    }
  | undefined {
  let mode = (process.env.DATABASE_SSL ?? "").trim().toLowerCase();
  if (!mode && isDeployed) mode = "require";
  if (!mode) return undefined;
  if (mode === "disable") return false;
  if (mode === "require" || mode === "verify-ca" || mode === "verify-full" || mode === "true") {
    const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n").trim();
    return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
  }
  throw new Error(
    "DATABASE_SSL must be one of: require (verify certificate), verify-ca, verify-full, or disable",
  );
}

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
      application_name: "esimprove",
      // Each Netlify Functions instance owns its own pool. Keep the default
      // small and use a provider pooler for concurrency; see the deployment
      // guide for connection-limit sizing.
      max: integerEnv("DATABASE_POOL_MAX", isDeployed ? 3 : 5, 1, 10),
      idleTimeoutMillis: integerEnv("DATABASE_POOL_IDLE_TIMEOUT_MS", 10_000, 1_000, 300_000),
      connectionTimeoutMillis: integerEnv(
        "DATABASE_CONNECTION_TIMEOUT_MS",
        10_000,
        1_000,
        120_000,
      ),
      statement_timeout: integerEnv("DATABASE_STATEMENT_TIMEOUT_MS", 15_000, 1_000, 120_000),
      ssl: databaseSsl(),
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

  if (isDeployed) {
    throw new Error(
      "DATABASE_URL is required in a deployed environment; refusing to start a local PGlite database",
    );
  }

  const dataDir = options?.dataDir ?? process.env.PGLITE_DATA_DIR ?? ".pglite";
  // PGlite is imported dynamically so deployed PostgreSQL functions do not load
  // the embedded database runtime.
  const { PGlite: PGliteClient } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = dataDir === "memory://" ? new PGliteClient() : new PGliteClient(dataDir);
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

async function openHandle(): Promise<DatabaseHandle> {
  const handle = await createDatabase();
  // Local PGlite has no separate migration runner and is safe to initialise on
  // first use. Deployed PostgreSQL must be migrated explicitly with
  // `npm run db:migrate` using a dedicated connection.
  if (handle.dialect === "pglite") {
    await runMigrations(handle.client, handle.dialect);
  }
  return handle;
}

function getOrCreateHandle(): Promise<DatabaseHandle> {
  if (!globalForDb.__esimproveDbPromise) {
    globalForDb.__esimproveDbPromise = openHandle().catch((error: unknown) => {
      // Do not cache a rejected initialisation forever; a transient connection
      // failure should be retryable by the next request.
      globalForDb.__esimproveDbPromise = undefined;
      throw error;
    });
  }
  return globalForDb.__esimproveDbPromise;
}

export async function getDb(): Promise<Database> {
  assertProductionSafe();
  const handle = await getOrCreateHandle();
  return handle.db;
}

export async function getDbHandle(): Promise<DatabaseHandle> {
  assertProductionSafe();
  return getOrCreateHandle();
}

export async function closeDb(): Promise<void> {
  const promise = globalForDb.__esimproveDbPromise;
  if (!promise) return;
  try {
    const handle = await promise;
    await handle.close();
  } finally {
    globalForDb.__esimproveDbPromise = undefined;
  }
}
