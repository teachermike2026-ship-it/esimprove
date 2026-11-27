import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/config";
import { CopyLinkButton } from "@/components/copy-link-button";
import { rememberGuestOrderAction } from "@/app/orders/actions";
import { readGuestOrders } from "@/lib/guest-orders";
import { LockIcon } from "@/components/icons";

/**
 * Shown to guests (no account) on the confirmation and order pages: how to
 * keep and recover access to the order without registering.
 */
export async function GuestAccessCard({
  orderNumber,
  token,
}: {
  orderNumber: string;
  token: string;
}) {
  const { t, href } = await getI18n();
  const link = `${siteUrl}/orders/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(token)}`;
  const onThisDevice = (await readGuestOrders()).some((entry) => entry.orderNumber === orderNumber);

  return (
    <section className="card guest-access-card" aria-labelledby="guest-access-title">
      <div className="guest-access-head">
        <span className="checkout-entry-icon" aria-hidden="true">
          <LockIcon />
        </span>
        <div>
          <h2 id="guest-access-title">{t("guest.accessTitle")}</h2>
          <p className="muted">{t("guest.accessLead")}</p>
        </div>
      </div>
      <div className="guest-access-actions">
        <CopyLinkButton value={link} label={t("guest.copyLink")} copiedLabel={t("guest.copied")} />
        {onThisDevice ? (
          <span className="form-note">{t("guest.savedOnDevice")}</span>
        ) : (
          <form action={rememberGuestOrderAction}>
            <input type="hidden" name="orderNumber" value={orderNumber} />
            <input type="hidden" name="token" value={token} />
            <button className="button button-ghost button-small" type="submit">
              {t("guest.saveOnDevice")}
            </button>
          </form>
        )}
      </div>
      <p className="form-note">
        {t("guest.recoverNote")} <Link href={href("/orders")}>{t("guest.myOrdersLink")}</Link>
      </p>
      <p className="form-note">{t("guest.privateNote")}</p>
    </section>
  );
}
