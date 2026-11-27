import type { Metadata } from "next";
import { isOrderItemDelivered } from "@/lib/esim-activation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { esims, orderItems, orders } from "@/lib/db/schema";
import type { EncryptedSecret } from "@/lib/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { isAdminRole } from "@/lib/auth/roles";
import { requestMeta } from "@/lib/auth/session";
import { logActivationAccess } from "@/lib/orders";
import { ActivationCard } from "@/components/activation-card";
import { ArrowRight } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/portal/esims",
    title: t("activation.title"),
    robots: { index: false, follow: false },
  });
}

export default async function PortalEsimPage({
  params,
}: {
  params: Promise<{ esimId: string }>;
}) {
  const { t, href } = await getI18n();
  const { esimId } = await params;
  const user = await requireUser(`/portal/esims/${esimId}`);
  const db = await getDb();
  const rows = await db
    .select({ esim: esims, item: orderItems, order: orders })
    .from(esims)
    .innerJoin(orderItems, eq(esims.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(esims.id, esimId), isAdminRole(user.role) ? undefined : eq(orders.userId, user.id)))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();
  // Never show activation details before fulfillment is confirmed.
  if (!(await isOrderItemDelivered(db, row.item.id))) notFound();

  const encrypted: EncryptedSecret = {
    ciphertext: row.esim.lpaCiphertext,
    iv: row.esim.lpaIv,
    tag: row.esim.lpaTag,
    wrappedDek: row.esim.dekWrapped,
    dekIv: row.esim.dekIv,
    dekTag: row.esim.dekTag,
    keyVersion: row.esim.keyVersion,
  };

  let lpa: string;
  try {
    lpa = decryptSecret(encrypted);
  } catch {
    // Decryption failure is a server-side configuration problem, not a client
    // error. Surface it as a 500 so it is visible in logs and monitoring.
    throw new Error("Activation data could not be decrypted");
  }

  const qrDataUrl = await QRCode.toDataURL(lpa, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#102a2e", light: "#ffffff" },
  });
  const meta = await requestMeta();
  await logActivationAccess(db, {
    esimId: row.esim.id,
    orderId: row.order.id,
    actorType: isAdminRole(user.role) ? "admin" : "user",
    actorId: user.id,
    ipHash: meta.ipHash,
  });

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href={href("/portal")}>{t("profile.breadcrumbPortal")}</Link>
          </li>
          <li>
            <Link href={href(`/portal/orders/${row.order.orderNumber}`)}>
              {row.order.orderNumber}
            </Link>
          </li>
          <li aria-current="page">{t("activation.eyebrow")}</li>
        </ol>
      </nav>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("activation.portalEyebrow")}</p>
          <h1>{t("activation.title")}</h1>
          <p className="muted">{t("activation.authorizedNote")}</p>
        </div>
      </div>
      <ActivationCard
        planName={row.item.planName}
        iccid={row.esim.iccid}
        status={row.esim.status}
        lpa={lpa}
        qrDataUrl={qrDataUrl}
      />
      <div className="hero-actions section-tight">
        <Link
          className="button button-secondary"
          href={href(`/portal/orders/${row.order.orderNumber}`)}
        >
          {t("activation.backToOrder")} <ArrowRight className="inline-icon" />
        </Link>
        <Link className="button button-ghost" href={href("/guides")}>
          {t("activation.installGuides")}
        </Link>
      </div>
    </>
  );
}
