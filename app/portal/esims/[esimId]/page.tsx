import type { Metadata } from "next";
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
import { EmptyState } from "@/components/empty-state";
import { AlertIcon, ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Demo eSIM activation",
  robots: { index: false, follow: false },
};

export default async function PortalEsimPage({
  params,
}: {
  params: Promise<{ esimId: string }>;
}) {
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
    return (
      <EmptyState title="Activation data could not be decrypted" action={{ href: "/portal", label: "Back to portal" }}>
        Check the server encryption key configuration.
      </EmptyState>
    );
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
            <Link href="/portal">Portal</Link>
          </li>
          <li>
            <Link href={`/portal/orders/${row.order.orderNumber}`}>{row.order.orderNumber}</Link>
          </li>
          <li aria-current="page">Activation</li>
        </ol>
      </nav>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Customer portal</p>
          <h1>Your mock eSIM</h1>
          <p className="muted">
            Activation data is decrypted only for this authorized view and the access is
            audited.
          </p>
        </div>
      </div>
      <ActivationCard
        planName={row.item.planName}
        iccid={row.esim.iccid}
        status={row.esim.status}
        lpa={lpa}
        qrDataUrl={qrDataUrl}
      />
      <div className="callout callout-warning section-tight">
        <AlertIcon className="inline-icon" />
        <p>
          This is a demo activation. The LPA uses the reserved <code>.invalid</code> domain and
          cannot connect to a real network.
        </p>
      </div>
      <div className="hero-actions section-tight">
        <Link className="button button-secondary" href={`/portal/orders/${row.order.orderNumber}`}>
          Back to order <ArrowRight className="inline-icon" />
        </Link>
        <Link className="button button-ghost" href="/guides">
          Install guides
        </Link>
      </div>
    </>
  );
}
