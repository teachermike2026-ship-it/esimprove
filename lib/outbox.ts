import { and, asc, eq, lte } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  fulfillmentJobs,
  orderEvents,
  orderItems,
  outboxEvents,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";

export async function enqueueOutbox(
  db: Database,
  input: {
    topic: string;
    aggregateType: string;
    aggregateId: string;
    payload?: Record<string, unknown>;
  },
): Promise<string> {
  const id = newId("outbox");
  await db.insert(outboxEvents).values({
    id,
    topic: input.topic,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload ?? {},
  });
  return id;
}

export interface DispatchResult {
  processed: number;
  failed: number;
}

export async function dispatchOutbox(db: Database, limit = 20): Promise<DispatchResult> {
  const events = await db
    .select()
    .from(outboxEvents)
    .where(and(eq(outboxEvents.status, "pending"), lte(outboxEvents.nextAttemptAt, new Date())))
    .orderBy(asc(outboxEvents.createdAt))
    .limit(limit);

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      if (event.topic === "fulfillment.requested") {
        const orderId = String(event.payload.orderId ?? event.aggregateId);
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
        for (const item of items) {
          await db
            .insert(fulfillmentJobs)
            .values({
              id: newId("job"),
              orderId,
              orderItemId: item.id,
              status: "queued",
              attempts: 0,
              maxAttempts: Number(process.env.JOB_MAX_ATTEMPTS || "8"),
              nextAttemptAt: new Date(),
              idempotencyKey: `fulfillment:${item.id}`,
            })
            .onConflictDoNothing();
        }
        await db.insert(orderEvents).values({
          id: newId("orderevent"),
          orderId,
          type: "fulfillment.queued",
          message: "Fulfillment jobs queued for each demo order item.",
          metadata: { itemCount: items.length },
        });
      } else {
        throw new Error(`Unknown outbox topic: ${event.topic}`);
      }

      await db
        .update(outboxEvents)
        .set({ status: "processed", processedAt: new Date(), attempts: event.attempts + 1 })
        .where(eq(outboxEvents.id, event.id));
      processed += 1;
    } catch {
      const attempts = event.attempts + 1;
      const backoffSeconds = Math.min(300, 10 * 2 ** Math.min(attempts, 5));
      await db
        .update(outboxEvents)
        .set({
          attempts,
          status: attempts >= 5 ? "failed" : "pending",
          nextAttemptAt: new Date(Date.now() + backoffSeconds * 1000),
        })
        .where(eq(outboxEvents.id, event.id));
      failed += 1;
    }
  }

  return { processed, failed };
}
