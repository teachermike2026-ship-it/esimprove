import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
export type NotificationRow = typeof notifications.$inferSelect;

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

export async function createNotification(
  db: Database,
  input: CreateNotificationInput,
): Promise<NotificationRow> {
  const notification = {
    id: newId("notification"),
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    payload: input.payload ?? {},
    read: false,
    createdAt: new Date(),
  };
  await db.insert(notifications).values(notification);
  return notification as NotificationRow;
}

export async function listNotificationsForUser(
  db: Database,
  userId: string,
): Promise<NotificationRow[]> {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(notifications.createdAt);
}

export async function markNotificationRead(db: Database, id: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(db: Database, userId: string): Promise<number> {
  const unread = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  const ids = unread.map((row) => row.id);
  if (ids.length === 0) return 0;
  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(inArray(notifications.id, ids));
  return ids.length;
}
