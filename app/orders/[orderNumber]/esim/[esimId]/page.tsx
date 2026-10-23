import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { getDb } from "@/lib/db/client";
import { esims, orderItems } from "@/lib/db/schema";
import type { EncryptedSecret } from "@/lib/db/schema";
import { getCurrentUser, requestMeta } from "@/lib/auth/session";
import {
  canViewOrder,
  getOrderByNumber,
  logActivationAccess,
} from "@/lib/orders";
import { decryptSecret } from "@/lib/crypto";
import { ActivationCard } from "@/components/activation-card";
import { EmptyState } from "@/components/empty-state";
import { AlertIcon, ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Demo activation",
  robots: { index: false, follow: false },
};

export default async function ActivationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string; esimId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { orderNumber, esimId } = await params;
  const { token } = await searchParams;
  const db = await getDb();
  const order = await getOrderByNumber(db, orderNumber);
  if (!order) {
    return (
      <EmptyState title="Order not found" action={{ href: "/plans", label: "Browse demo plans" }}>
        The order could not be found.
      </EmptyState>
    );
  }

  const user = await getCurrentUser();
  const allowed = await canViewOrder(db, order, {
    userId: user?.id ?? null,
    role: user?.role ?? null,
    token: token ?? null,
  });
  if (!allowed) {
    return (
      <EmptyState title="Activation access required" action={{ href: "/login", label: "Sign in" }}>
        Use the secure order link or sign in as the customer who placed the order.
      </EmptyState>
    );
  }

  const rows = await db
    .select({ esim: esims, item: orderItems })
    .from(esims)
    .innerJoin(orderItems, eq(esims.orderItemId, orderItems.id))
    .where(and(eq(esims.id, esimId), eq(orderItems.orderId, order.id)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return (
      <EmptyState title="Activation not found" action={{ href: `/orders/${orderNumber}`, label: "Back to order" }}>
        This activation does not belong to the order or has not been provisioned yet.
      </EmptyState>
    );
  }

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
      <EmptyState title="Activation data could not be decrypted" action={{ href: `/orders/${orderNumber}`, label: "Back to order" }}>
        Check that the server encryption key is configured and matches the key version used
        for this record.
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
    orderId: order.id,
    actorType: user ? "user" : "guest_order_link",
    actorId: user?.id ?? null,
    ipHash: meta.ipHash,
  });

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href={`/orders/${orderNumber}${token ? `?token=${encodeURIComponent(token)}` : ""}`}>
              {orderNumber}
            </Link>
          </li>
          <li aria-current="page">Activation</li>
        </ol>
      </nav>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Demo activation</p>
          <h1>Your mock eSIM</h1>
          <p className="muted">
            The activation data was decrypted for this authorized view. Access has been
            written to the activation audit log.
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
          This code is a mock. It uses the reserved <code>.invalid</code> domain, cannot be
          installed on a real eSIM, and must not be shared as a real activation.
        </p>
      </div>
      <div className="hero-actions section-tight">
        <Link className="button button-secondary" href={`/orders/${orderNumber}${token ? `?token=${encodeURIComponent(token)}` : ""}`}>
          Back to order <ArrowRight className="inline-icon" />
        </Link>
        <Link className="button button-ghost" href="/guides">
          Install guides
        </Link>
      </div>
    </>
  );
}
