import Image from "next/image";
import { CopyButton } from "@/components/copy-button";
import { AlertIcon, QrIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { getI18n } from "@/lib/i18n/server";
import { statusLabel } from "@/lib/i18n/status";

export async function ActivationCard({
  planName,
  iccid,
  status,
  lpa,
  qrDataUrl,
  headingId = "activation-title",
}: {
  planName: string;
  iccid: string | null;
  status: string;
  lpa: string;
  qrDataUrl: string;
  /** Unique heading id when several activation cards share one page. */
  headingId?: string;
}) {
  const { t } = await getI18n();
  return (
    <section className="card activation-card" aria-labelledby={headingId}>
      <div className="activation-head">
        <div>
          <p className="eyebrow">{t("activation.eyebrow")}</p>
          <h2 id={headingId}>{planName}</h2>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="callout">
        <AlertIcon className="inline-icon" />
        <p>{t("activation.keepPrivate")}</p>
      </div>
      <div className="activation-grid">
        <div className="qr-card">
          <Image
            src={qrDataUrl}
            alt={t("activation.qrAlt", { plan: planName })}
            width={280}
            height={280}
            unoptimized
          />
          <p>
            <QrIcon className="inline-icon" /> {t("activation.scanNote")}
          </p>
        </div>
        <div className="activation-details">
          <h3>{t("activation.manualTitle")}</h3>
          <p className="muted">{t("activation.manualBody")}</p>
          <pre className="activation-code" dir="ltr">
            {lpa}
          </pre>
          <CopyButton value={lpa} label={t("activation.copyLpa")} />
          <dl className="meta-list">
            <div>
              <dt>{t("activation.iccid")}</dt>
              <dd dir="ltr">{iccid ?? t("activation.notProvided")}</dd>
            </div>
            <div>
              <dt>{t("activation.status")}</dt>
              <dd>{statusLabel(t, status)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
