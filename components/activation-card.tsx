import Image from "next/image";
import { CopyButton } from "@/components/copy-button";
import { AlertIcon, QrIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";

export function ActivationCard({
  planName,
  iccid,
  status,
  lpa,
  qrDataUrl,
}: {
  planName: string;
  iccid: string | null;
  status: string;
  lpa: string;
  qrDataUrl: string;
}) {
  return (
    <section className="card activation-card" aria-labelledby="activation-title">
      <div className="activation-head">
        <div>
          <p className="eyebrow">Activation</p>
          <h2 id="activation-title">{planName}</h2>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="callout">
        <AlertIcon className="inline-icon" />
        <p>
          These activation details are personal to your order. Do not share them — anyone with
          this code can install your eSIM.
        </p>
      </div>
      <div className="activation-grid">
        <div className="qr-card">
          <Image
            src={qrDataUrl}
            alt={`Activation QR code for ${planName}`}
            width={280}
            height={280}
            unoptimized
          />
          <p>
            <QrIcon className="inline-icon" /> Scan in a device eSIM setup screen.
          </p>
        </div>
        <div className="activation-details">
          <h3>Manual activation</h3>
          <p className="muted">
            If scanning is not possible, copy the activation LPA string. It is stored encrypted at
            rest and decrypted only for this authorized view.
          </p>
          <pre className="activation-code">{lpa}</pre>
          <CopyButton value={lpa} label="Copy activation LPA" />
          <dl className="meta-list">
            <div>
              <dt>ICCID</dt>
              <dd>{iccid ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{status.replaceAll("_", " ")}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
