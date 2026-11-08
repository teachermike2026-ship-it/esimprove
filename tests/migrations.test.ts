import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, getTableName } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import {
  schema,
  supplierCapabilities,
  supplierConnections,
} from "@/lib/db/schema";
import { makeTestDb } from "./helpers/db";

type RawClient = {
  query: <T>(sql: string) => Promise<{ rows: T[] } | T[]>;
};

async function rows<T>(handle: DatabaseHandle, sql: string): Promise<T[]> {
  const result = await (handle.client as unknown as RawClient).query<T>(sql);
  return Array.isArray(result) ? result : result.rows;
}

describe("database schema and migrations", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  afterAll(async () => {
    await handle.close();
  });

  it("creates every table declared in the Drizzle schema", async () => {
    const expected = Object.values(schema)
      .map((table) => getTableName(table as Parameters<typeof getTableName>[0]))
      .sort();
    const actual = (
      await rows<{ table_name: string }>(
        handle,
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
      )
    )
      .map((row) => row.table_name)
      .sort();

    expect(expected.length).toBeGreaterThan(0);
    expect(actual).toEqual(expect.arrayContaining(expected));
  });

  it("records the supplier migration and supports the supplier tables", async () => {
    const applied = await rows<{ id: string }>(
      handle,
      "SELECT id FROM schema_migrations ORDER BY id",
    );
    expect(applied.map((row) => row.id)).toContain("0004_supplier_connect.sql");

    await handle.db.insert(supplierConnections).values({
      id: "supplier_test_migration",
      displayName: "Migration test supplier",
      adapterType: "generic-api",
      environment: "sandbox",
      baseUrl: "https://supplier.example.com",
    });
    await handle.db.insert(supplierCapabilities).values({
      id: "supplier_cap_test_migration",
      supplierKey: "generic-api",
      connectionId: "supplier_test_migration",
      capability: "order_creation",
    });

    const capabilities = await handle.db
      .select()
      .from(supplierCapabilities)
      .where(eq(supplierCapabilities.connectionId, "supplier_test_migration"));
    expect(capabilities).toHaveLength(1);

    await handle.db
      .delete(supplierConnections)
      .where(eq(supplierConnections.id, "supplier_test_migration"));
    const afterDelete = await handle.db
      .select()
      .from(supplierCapabilities)
      .where(eq(supplierCapabilities.connectionId, "supplier_test_migration"));
    expect(afterDelete).toHaveLength(0);
  });

  it("is repeatable without reapplying migration files", async () => {
    await expect(runMigrations(handle.client, handle.dialect)).resolves.toBeUndefined();
    const applied = await rows<{ id: string }>(
      handle,
      "SELECT id FROM schema_migrations WHERE id = '0004_supplier_connect.sql'",
    );
    expect(applied).toHaveLength(1);
  });
});
