import { createDatabase, type DatabaseHandle } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { seedDemoData } from "@/lib/db/seed";

export async function makeTestDb(): Promise<DatabaseHandle> {
  const handle = await createDatabase({ dataDir: "memory://", connectionString: "" });
  await runMigrations(handle.client, handle.dialect);
  await seedDemoData(handle.db, {
    adminEmail: "admin@demo.local",
    adminPassword: "DemoAdmin!2345",
    adminTotpSecret: "JBSWY3DPEHPK3PXP",
  });
  return handle;
}
