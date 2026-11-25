import type { Metadata } from "next";
import Link from "next/link";
import {
  BusinessDetails,
  LegalDocumentFooter,
  LegalDocumentHeader,
  SupportChannelNotice,
} from "@/components/legal-document";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/legal/refunds",
    title: t("legal.refunds"),
    description: t("legal.refundsDescription"),
  });
}

export default async function RefundsPage() {
  const { t } = await getI18n();
  return (
    <div className="legal-page">
      <LegalDocumentHeader
        title={t("legal.refunds")}
        intro="This policy explains when you can cancel or request a refund for an ESIMPROVE order, how refunds are processed, and how to raise a request. Mandatory consumer rights that apply in your country always take precedence over this policy."
      />

      <article className="card form prose legal-body">
        <section aria-labelledby="refunds-overview">
          <h2 id="refunds-overview">1. Overview</h2>
          <p>
            eSIM products are digital goods that are usually delivered instantly. Refund eligibility
            therefore depends on whether the eSIM was delivered, provisioned, installed, activated,
            or used — and on the nature of the issue. Nothing in this policy limits any mandatory
            refund, cancellation, withdrawal, or conformity right you have under the consumer law of
            your country of residence. Where this policy is more generous than your local law, the
            more generous treatment applies.
          </p>
        </section>

        <section aria-labelledby="refunds-full">
          <h2 id="refunds-full">2. Full refunds</h2>
          <p>You are entitled to a full refund of the order total, including any tax paid, in the following cases:</p>
          <ul>
            <li>
              <strong>Before activation.</strong> The eSIM has been purchased but not installed,
              activated, or connected to a network, and you ask for a refund before activation.
            </li>
            <li>
              <strong>Duplicate charge.</strong> You were charged twice for the same order, or an
              order was placed and paid more than once in error.
            </li>
            <li>
              <strong>Provisioning failure.</strong> The order could not be fulfilled: no plan was
              provisioned, no activation details were issued, or the destination product does not
              exist.
            </li>
            <li>
              <strong>Material misdescription.</strong> The plan delivered is materially different
              from its description — for example, wrong destination, data allowance, or validity —
              and the issue is not resolved by replacement or correction.
            </li>
            <li>
              <strong>Technical failure.</strong> A fault on our side or a supplier outage prevents
              delivery or activation entirely and is not resolved within a reasonable period.
            </li>
            <li>
              <strong>Pricing or catalogue error.</strong> The order was placed because of a pricing,
              tax, or catalogue error and has been cancelled by us.
            </li>
          </ul>
        </section>

        <section aria-labelledby="refunds-partial">
          <h2 id="refunds-partial">3. After activation and partial use</h2>
          <ul>
            <li>
              Once an eSIM has been activated, installed, or has connected to a mobile network, the
              digital service has begun. A change of mind at that point is not normally refundable.
            </li>
            <li>
              Partially used data allowances are not refunded pro rata. If a defect affecting only
              part of the service is proven, we will offer the remedy available under your local
              law, which may include a partial refund or a replacement plan.
            </li>
            <li>
              Unused eSIMs that have not been installed, activated, or connected to a network remain
              refundable, even after the order date, subject to the activation rule stated on the
              plan page.
            </li>
          </ul>
        </section>

        <section aria-labelledby="refunds-compatibility">
          <h2 id="refunds-compatibility">4. Device compatibility</h2>
          <p>
            You are responsible for confirming that your device is eSIM-capable, carrier-unlocked,
            and supports the relevant network bands before purchasing. Compatibility information on
            the site is guidance, not a guarantee. If you discover your device is incompatible and
            the eSIM has not been installed or activated, contact us before activating it and we
            will refund the order in full. Once the eSIM has been installed or activated, refund
            eligibility is assessed under section 3.
          </p>
        </section>

        <section aria-labelledby="refunds-statutory">
          <h2 id="refunds-statutory">5. Your statutory rights</h2>
          <p>
            Nothing in this policy excludes, restricts, or replaces any right or remedy you have
            under mandatory consumer protection law, including rights relating to conformity of
            digital content, faulty or misdescribed goods and services, cancellation and withdrawal
            rights, and complaint to a supervisory or dispute-resolution body. Where mandatory law
            in your country grants a right that is broader than this policy, that law prevails.
          </p>
        </section>

        <section aria-labelledby="refunds-request">
          <h2 id="refunds-request">6. How to request a refund</h2>
          <p>
            Send your request to{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> or via the{" "}
            <Link href="/contact">contact page</Link>, and include:
          </p>
          <ul>
            <li>the order reference;</li>
            <li>the email address used for the order;</li>
            <li>what went wrong, and when;</li>
            <li>whether the eSIM has been installed, activated, or used, and how much data was used;</li>
            <li>any relevant error messages or screenshots.</li>
          </ul>
          <p>
            Do not include your password, one-time authentication codes, or full card numbers. We
            will never ask for them.
          </p>
        </section>

        <section aria-labelledby="refunds-process">
          <h2 id="refunds-process">7. How refunds are processed</h2>
          <p>
            Each request is verified against the order and payment records, and the state of the
            eSIM (provisioned, installed, activated, or used) is checked with the supplier records
            where available. Approved refunds are returned to the original payment method through
            the payment provider; the provider controls settlement timing and any fee it charges. We
            cannot promise a refund before the provider completes it.
          </p>
          <p>
            If a request is refused, we will explain the reason and any available dispute or
            complaint route. A refusal never removes a mandatory right you have.
          </p>
        </section>

        <section aria-labelledby="refunds-chargebacks">
          <h2 id="refunds-chargebacks">8. Chargebacks and payment disputes</h2>
          <p>
            If you dispute a payment with your bank or card issuer, we may need to provide order,
            delivery, consent, and support records to the payment provider. Please contact us first
            so the issue can be investigated — most problems can be resolved without a dispute.
            Starting a chargeback does not remove any right you have, and we will not retaliate
            against you for exercising a lawful right.
          </p>
        </section>

        <section aria-labelledby="refunds-fees">
          <h2 id="refunds-fees">9. Price and fee transparency</h2>
          <p>
            Checkout shows the plan price, quantity, subtotal, tax treatment, and total before
            payment. No additional fee is added later by ESIMPROVE. Refunds cover the order total
            actually paid, including tax; any fee charged by your own bank or payment provider
            remains governed by your agreement with that provider.
          </p>
        </section>

        <section aria-labelledby="refunds-changes">
          <h2 id="refunds-changes">10. Changes to this policy</h2>
          <p>
            Material changes will be published with a new version and effective date, and where
            appropriate you will be notified. The version in force when your order is placed is
            recorded with the order.
          </p>
        </section>
      </article>

      <BusinessDetails />
      <SupportChannelNotice />
      <LegalDocumentFooter />
    </div>
  );
}
