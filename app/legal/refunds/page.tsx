import type { Metadata } from "next";
import { AlertIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Refund policy draft",
  description: "Draft refund notes for the eSIMprove demonstration storefront.",
  alternates: { canonical: "/legal/refunds" },
};

export default function RefundsPage() {
  return (
    <article className="card form prose">
      <span className="badge badge-demo">Draft — not legal advice</span>
      <h1>Refund policy draft</h1>
      <div className="callout callout-warning">
        <AlertIcon className="inline-icon" />
        <p>
          No real payments are accepted in this demo, so no refund process is active. The
          owner must decide the production policy with legal and payment advisers.
        </p>
      </div>
      <h2>Demo orders</h2>
      <p>
        A demo order marked paid or delivered reflects mock records only. There is no charge to
        refund and no live customer-support queue.
      </p>
      <h2>Production questions to decide</h2>
      <ul>
        <li>When a plan counts as delivered: on payment, on provisioning, or on installation.</li>
        <li>How unused or partially used plans are treated.</li>
        <li>How supplier failures and duplicate activations are resolved.</li>
        <li>Which consumer rights apply in each market and how they are presented.</li>
        <li>Who handles chargebacks, disputes, and fraud review.</li>
      </ul>
      <p>
        Until those decisions are made and reviewed, live payments must remain disabled.
      </p>
    </article>
  );
}
