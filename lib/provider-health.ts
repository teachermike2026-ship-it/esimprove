import type { Database } from "@/lib/db/client";
import { getSupplierAdapter } from "@/lib/integrations/supplier";
import { listApiHealthChecks, recordApiHealthCheck } from "@/lib/operations";

export async function checkSupplierHealth(db: Database, providerKey = "mock") {
  const adapter = getSupplierAdapter();
  const health = await adapter.healthCheck();
  await recordApiHealthCheck(db, {
    target: `supplier:${providerKey}`,
    method: "healthCheck",
    status: health.ok ? "ok" : "failed",
    responseCode: health.ok ? 200 : 503,
    latencyMs: null,
    message: health.message,
  });
  return health;
}

export async function listProviderHealthChecks(db: Database, limit = 50) {
  return listApiHealthChecks(db, limit);
}
