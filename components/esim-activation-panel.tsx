import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { esims } from "@/lib/db/schema";
import type { OrderItemView } from "@/lib/orders";
import { logActivationAccess } from "@/lib/orders";
import { getCurrentUser, requestMeta } from "@/lib/auth/session";
import { buildActivation } from "@/lib/esim-activation";
import { ActivationCard } from "@/components/activation-card";

/**
 * Shows the customer's eSIM QR code and manual activation code directly on
 * their order page as soon as fulfillment is confirmed. Render it only on
 * pages that have already authorised the viewer for this order (order link
 * token, owner account, or staff). `items` comes from `getOrderItems`, which
 * already lists eSIMs only for confirmed (delivered) order items.
 *
 * Every display is recorded in the activation access log, exactly like the
 * dedicated activation page.
 */
export async function EsimActivationPanel({ orderId, items }: { orderId: string; items: OrderItemView[] }) {
  const esimIds = items.flatMap((item) => item.esims.map((esim) => esim.id));
  if (esimIds.length === 0) return null;

  const db = await getDb();
  const rows = await db.select().from(esims).where(inArray(esims.id, esimIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const user = await getCurrentUser();
  const meta = await requestMeta();

  const cards = [];
  for (const item of items) {
    for (const [index, ref] of item.esims.entries()) {
      const esim = byId.get(ref.id);
      if (!esim) continue;
      const { lpa, qrDataUrl } = await buildActivation(esim);
      await logActivationAccess(db, {
        esimId: esim.id,
        orderId,
        actorType: user ? "user" : "guest_order_link",
        actorId: user?.id ?? null,
        ipHash: meta.ipHash,
      });
      cards.push(
        <ActivationCard
          key={esim.id}
          headingId={`activation-title-${esim.id}`}
          planName={item.esims.length > 1 ? `${item.planName} · ${index + 1}` : item.planName}
          iccid={esim.iccid}
          status={esim.status}
          lpa={lpa}
          qrDataUrl={qrDataUrl}
        />,
      );
    }
  }
  return cards.length > 0 ? <div className="stack esim-activation-panel">{cards}</div> : null;
}
