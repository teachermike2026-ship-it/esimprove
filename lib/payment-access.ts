import type { Database } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewOrder, getOrderById } from "@/lib/orders";
import { getPaymentById } from "@/lib/payments";

export interface AuthorizedMockPayment {
  payment: NonNullable<Awaited<ReturnType<typeof getPaymentById>>>;
  order: NonNullable<Awaited<ReturnType<typeof getOrderById>>>;
  userId: string | null;
}

/**
 * A mock payment page/action is only available to the order owner, an
 * administrator, or the holder of a valid order access token. A payment ID by
 * itself is not an authorization credential.
 */
export async function loadAuthorizedMockPayment(
  db: Database,
  paymentId: string,
  token: string | null,
): Promise<AuthorizedMockPayment | null> {
  if (!paymentId) return null;
  const payment = await getPaymentById(db, paymentId);
  if (!payment) return null;
  const order = await getOrderById(db, payment.orderId);
  if (!order) return null;

  const user = await getCurrentUser();
  const allowed = await canViewOrder(db, order, {
    userId: user?.id ?? null,
    role: user?.role ?? null,
    token: token || null,
  });
  if (!allowed) return null;
  return { payment, order, userId: user?.id ?? null };
}
