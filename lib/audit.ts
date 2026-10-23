import type { Database } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";
import type { AuditMetadata } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

export async function recordAudit(
  db: Database,
  input: {
    actorType: string;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: AuditMetadata;
  },
): Promise<void> {
  await db.insert(auditLogs).values({
    id: newId("audit"),
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {},
  });
}
