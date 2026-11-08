import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { loadLegalSettings } from "@/lib/legal";
import {
  BusinessDetails,
  LegalDocumentFooter,
  LegalDocumentHeader,
  SupportChannelNotice,
} from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Refund policy",
  description:
    "Draft refund and cancellation policy describing the implemented order, payment, refund, and review workflow. Requires owner and legal approval.",
  alternates: { canonical: "/legal/refunds" },
};

export const dynamic = "force-dynamic";

export default async function RefundsPage() {
  const settings = await loadLegalSettings(await getDb());

  return (
    <div className="legal-page">
      <LegalDocumentHeader
        settings={settings}
        documentKey="refunds"
        title="Refund and cancellation policy"
        intro="This draft explains how the application records orders, mock payments, and refunds, what a live refund review would need to consider, and which decisions the owner and legal adviser still have to make. No refund promise is made in this build."
      />

      <article className="card form prose legal-body">
        <section aria-labelledby="refunds-status">
          <h2 id="refunds-status">1. Current status of this policy</h2>
          <p>
            This is a draft. The owner has not yet approved refund eligibility rules, review
            timelines, or the treatment of partially used plans. The build uses a local mock
            payment page: no card details are requested, no payment processor is contacted, and
            no money moves. A demo order marked paid or delivered is a simulated record, not a
            live purchase.
          </p>
          <p>
            Nothing in this draft excludes or limits a mandatory consumer right that applies in
            your country. The final policy must be reviewed by a qualified lawyer for each market
            where the owner sells.
          </p>
        </section>

        <section aria-labelledby="refunds-records">
          <h2 id="refunds-records">2. What the application records</h2>
          <ul>
            <li>
              Orders: order number, customer name and email, country, plan, quantity, currency,
              subtotal, tax calculation, total, status, and timestamps.
            </li>
            <li>
              Payments: mock provider label, amount, currency, status, and signed mock webhook
              events. Card numbers, CVV codes, and bank credentials are never collected.
            </li>
            <li>
              Refunds: order reference, amount, currency, reason, status, idempotency key, admin
              actor, and timestamps. A refund cannot be recorded twice for the same idempotency
              key.
            </li>
            <li>
              Audit records: administrator actions, review decisions, and status changes needed to
              evidence how a request was handled.
            </li>
          </ul>
          <p>
            These records may be retained after an account deletion request where they are needed
            for financial recordkeeping, fraud prevention, dispute handling, or legal obligations.
            The retention table in the{" "}
            <Link href="/legal/privacy">Privacy Policy</Link> describes the proposed periods.
          </p>
        </section>

        <section aria-labelledby="refunds-eligibility">
          <h2 id="refunds-eligibility">3. Eligibility is not configured yet</h2>
          <p>
            The owner must decide, with supplier, payment-provider, and legal input, how each of
            the following is treated:
          </p>
          <ul>
            <li>Whether a plan counts as delivered at payment, provisioning, first connection, or successful installation.</li>
            <li>Whether an unused eSIM can be refunded before it is installed or activated.</li>
            <li>How a partially used data allowance is treated.</li>
            <li>What happens when the supplier cannot provision a plan or the destination network fails.</li>
            <li>What happens when a device turns out to be incompatible or carrier-locked.</li>
            <li>How duplicate charges, duplicate orders, and failed mock or live payments are corrected.</li>
            <li>Whether a change-of-mind request is available and how digital-supply rules affect it.</li>
            <li>Which statutory cooling-off, withdrawal, or conformity rights apply in each market.</li>
            <li>Who pays any payment-provider or currency-conversion fee that is not controlled by the operator.</li>
          </ul>
          <p>
            Until those decisions are made, reviewed, and published, live payments must remain
            disabled. This build does not present a guessed rule as a real policy.
          </p>
        </section>

        <section aria-labelledby="refunds-request">
          <h2 id="refunds-request">4. How to raise a refund or cancellation question</h2>
          <p>
            Use the <Link href="/contact">contact page</Link> and include the order reference, the
            email used for the order, what went wrong, and any relevant dates. Do not send your
            password, one-time authentication code, full card number, or bank credentials.
          </p>
          <p>
            This build stores the message as a local support ticket that an administrator can
            review. It does not send an email, contact a payment provider, or create a live refund.
            No response time is promised because no live support desk is connected.
          </p>
        </section>

        <section aria-labelledby="refunds-review">
          <h2 id="refunds-review">5. How a live refund review would work</h2>
          <p>
            A live workflow would need to verify the order and the requester, inspect the payment
            and supplier records, decide whether the product was delivered or used, and record the
            outcome. Approved refunds would be sent to the contracted payment provider; the
            provider controls settlement timing and any fees it charges. The operator cannot
            promise a refund before the provider completes it.
          </p>
          <p>
            If a request is refused, the response should explain the reason and any available
            complaint or dispute route. A refusal must not remove a mandatory right.
          </p>
        </section>

        <section aria-labelledby="refunds-chargebacks">
          <h2 id="refunds-chargebacks">6. Chargebacks and payment disputes</h2>
          <p>
            If a live payment is disputed with a bank or card issuer, the operator may need to
            provide order, delivery, consent, and support records to the payment provider. Please
            contact the operator first so the issue can be investigated. Starting a chargeback does
            not remove any right you have, and the operator will not retaliate for exercising a
            lawful right.
          </p>
        </section>

        <section aria-labelledby="refunds-fees">
          <h2 id="refunds-fees">7. Price and fee transparency</h2>
          <p>
            This build shows the plan price, quantity, subtotal, tax calculation, and total before
            the mock payment step. No additional fee is added later by the application. If tax is
            zero, the checkout says that no tax is added by this demo rather than implying a tax
            conclusion. A live storefront must show the final price, currency, applicable tax, and
            any unavoidable third-party fee before the customer pays.
          </p>
        </section>

        <section aria-labelledby="refunds-changes">
          <h2 id="refunds-changes">8. Changes to this policy</h2>
          <p>
            The version and effective date are shown above. A material change requires a new
            version and, where appropriate, updated customer notice. Do not rely on this draft as
            the final production policy.
          </p>
        </section>
      </article>

      <BusinessDetails settings={settings} />
      <SupportChannelNotice settings={settings} />
      <LegalDocumentFooter settings={settings} documentKey="refunds" />
    </div>
  );
}
