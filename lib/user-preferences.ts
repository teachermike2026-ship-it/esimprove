import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { userPreferences } from "@/lib/db/schema";

export type UserPreferencesRow = typeof userPreferences.$inferSelect;

export interface UpsertUserPreferencesInput {
  locale?: string;
  marketingOptIn?: boolean;
  productUpdatesOptIn?: boolean;
  orderUpdatesOptIn?: boolean;
}

export async function getOrCreateUserPreferences(
  db: Database,
  userId: string,
): Promise<UserPreferencesRow> {
  const existing = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  const row = existing[0];
  if (row) return row;
  const created = {
    userId,
    locale: "en",
    marketingOptIn: false,
    productUpdatesOptIn: true,
    orderUpdatesOptIn: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.insert(userPreferences).values(created);
  return created as UserPreferencesRow;
}

export async function updateUserPreferences(
  db: Database,
  userId: string,
  patch: UpsertUserPreferencesInput,
): Promise<UserPreferencesRow> {
  const preferences = await getOrCreateUserPreferences(db, userId);
  const updated = {
    ...preferences,
    ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
    ...(patch.marketingOptIn !== undefined ? { marketingOptIn: patch.marketingOptIn } : {}),
    ...(patch.productUpdatesOptIn !== undefined
      ? { productUpdatesOptIn: patch.productUpdatesOptIn }
      : {}),
    ...(patch.orderUpdatesOptIn !== undefined
      ? { orderUpdatesOptIn: patch.orderUpdatesOptIn }
      : {}),
    updatedAt: new Date(),
  };
  const existing = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  const previous = existing[0];
  if (previous) {
    await db
      .update(userPreferences)
      .set({
        locale: updated.locale,
        marketingOptIn: updated.marketingOptIn,
        productUpdatesOptIn: updated.productUpdatesOptIn,
        orderUpdatesOptIn: updated.orderUpdatesOptIn,
        updatedAt: updated.updatedAt,
      })
      .where(eq(userPreferences.userId, userId));
    return updated as UserPreferencesRow;
  }
  await db.insert(userPreferences).values(updated);
  return updated as UserPreferencesRow;
}
