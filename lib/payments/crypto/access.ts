import type { Database } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewOrder, getOrderById } from "@/lib/orders";
import {
  getCryptoPaymentById,
  type CryptoOrderRow,
  type CryptoPaymentRow,
} from "@/lib/payments/crypto/payment-service";

export interface AuthorizedCryptoPayment {
  payment: CryptoPaymentRow;
  order: CryptoOrderRow;
  userId: string | null;
}

/**
 * A crypto payment ID is not an authorization credential. The viewer must be
 * the signed-in owner, an administrator, or present the order access token that
 * was issued when the order was created.
 */
export async function loadAuthorizedCryptoPayment(
  db: Database,
  cryptoPaymentId: string,
  token: string | null,
): Promise<AuthorizedCryptoPayment | null> {
  if (!cryptoPaymentId) return null;
  const payment = await getCryptoPaymentById(db, cryptoPaymentId);
  if (!payment) return null;
  const order = await getOrderById(db, payment.orderId);
  if (!order) return null;

  const user = await getCurrentUser();
  const allowed = await canViewOrder(db, order, {
    userId: user?.id ?? null,
    role: user?.role ?? null,
    token,
  });
  if (!allowed) return null;
  return { payment, order, userId: user?.id ?? null };
}
