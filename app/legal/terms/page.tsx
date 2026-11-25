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
    path: "/legal/terms",
    title: t("legal.terms"),
    description: t("legal.termsDescription"),
  });
}

export default async function TermsPage() {
  const { t } = await getI18n();
  return (
    <div className="legal-page">
      <LegalDocumentHeader
        title={t("legal.terms")}
        intro="These terms govern use of the ESIMPROVE website and any account, order, or purchase made through it. They describe your rights and responsibilities, how orders and digital delivery work, and the rules that apply to the platform."
      />

      <article className="card form prose legal-body">
        <section aria-labelledby="terms-agreement">
          <h2 id="terms-agreement">1. Agreement and scope</h2>
          <p>
            By using the website, creating an account, or placing an order, you agree to these
            terms and to the documents they link to, including the{" "}
            <Link href="/legal/privacy">Privacy Policy</Link>,{" "}
            <Link href="/legal/refunds">Refund policy</Link>, and{" "}
            <Link href="/legal/cookies">Cookie policy</Link>. If you do not agree, do not use
            the service.
          </p>
          <p>
            Nothing in these terms excludes or limits any right you have under mandatory consumer
            protection or data protection law in your country of residence.
          </p>
        </section>

        <section aria-labelledby="terms-business">
          <h2 id="terms-business">2. Who we are</h2>
          <p>
            ESIMPROVE is an online digital services platform operating as an online brand. It is
            operated by ESIMPROVE from Vietnam, a provisional operating location, and is not a
            registered company in Vietnam or elsewhere. It does not hold or claim a company
            registration number, VAT number, telephone support line, or registered office. There is
            no public physical office; the platform operates online only.
          </p>
          <p>
            Contact is handled online only, at{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. See the business
            and contact details below for the full contact information.
          </p>
        </section>

        <section aria-labelledby="terms-eligibility">
          <h2 id="terms-eligibility">3. Eligibility and age</h2>
          <p>
            You must be able to enter a binding contract where you live. You must be at least the
            age of majority in your country of residence, or use the service with the agreement of
            a parent or guardian who accepts these terms on your behalf. The site is not directed
            at children.
          </p>
          <p>
            You must not use the service if you are barred by applicable law or sanctions, or if
            you intend to use it for any prohibited activity described in section 14.
          </p>
        </section>

        <section aria-labelledby="terms-account">
          <h2 id="terms-account">4. Accounts and security</h2>
          <ul>
            <li>Provide accurate account and order information and keep it up to date.</li>
            <li>Keep your password confidential and do not share your account or credentials.</li>
            <li>
              Use a strong, unique password. Administrator accounts are protected by two-factor
              authentication.
            </li>
            <li>
              Tell us promptly at{" "}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> if you believe
              your account or an authentication factor has been compromised.
            </li>
            <li>
              You are responsible for activity that occurs under your account, including purchases,
              until you notify us of the compromise and we suspend the account.
            </li>
            <li>
              We may suspend or restrict an account to protect the service, investigate fraud or
              abuse, comply with law, or enforce these terms. Where appropriate, we will explain
              the reason and how to restore access.
            </li>
          </ul>
        </section>

        <section aria-labelledby="terms-products">
          <h2 id="terms-products">5. Product descriptions and catalogue</h2>
          <p>
            Plans are described by destination, data allowance, validity, and price. We aim to
            present accurate plan descriptions before purchase; the plan page shown at checkout is
            part of the agreement for that order.
          </p>
          <p>
            Images, icons, and QR graphics shown in guides are visual aids and may not
            represent an actual activation code for your plan. The plan page for your order
            shows the actual product details that apply to your purchase.
          </p>
        </section>

        <section aria-labelledby="terms-compatibility">
          <h2 id="terms-compatibility">6. eSIM and device compatibility</h2>
          <p>
            You need an eSIM-capable, carrier-unlocked device. Compatibility depends on the exact
            model, manufacturing region, operating-system version, and carrier configuration. A
            compatibility checker or compatibility article is guidance only and is not a guarantee.
            Confirm support with the device manufacturer and your carrier before buying.
          </p>
          <p>
            You are responsible for checking that your device can install an additional eSIM or
            mobile plan, that it supports the relevant radio bands, and that it is not subject to a
            carrier lock or management profile that prevents installation. If your device turns out
            to be incompatible and the eSIM has not been installed or activated, contact us before
            activating it; the <Link href="/legal/refunds">Refund policy</Link> explains your
            options.
          </p>
        </section>

        <section aria-labelledby="terms-coverage">
          <h2 id="terms-coverage">7. Destinations and coverage limitations</h2>
          <p>
            Destination lists describe where a plan is intended to be used. Actual coverage,
            network availability, speed, technology, and service quality depend on local mobile
            operators, your device, terrain, building materials, network congestion, and regulatory
            restrictions. No specific speed, technology, or uninterrupted coverage is promised.
          </p>
          <p>
            A regional plan may not work in every country in the region. Check the plan details
            before purchase. Roaming and network-access rules can change without notice.
          </p>
        </section>

        <section aria-labelledby="terms-plans">
          <h2 id="terms-plans">8. Data plans, validity, and activation</h2>
          <p>
            Validity and activation rules differ by product. Some plans begin when the eSIM first
            connects to a network; others begin at purchase or installation. The activation rule
            for each plan is shown on the plan page before payment.
          </p>
          <p>
            Install and test the eSIM before travelling where the plan permits it. Keep the QR
            code and manual activation details until installation is confirmed. Do not repeatedly
            scan, delete, or transfer an eSIM; some products cannot be reissued.
          </p>
          <p>
            Data allowances, throttling, hotspot availability, and fair-use restrictions depend on
            the underlying mobile network and supplier terms. Plans are not unlimited unless the
            plan description expressly says so and describes the applicable restrictions.
          </p>
        </section>

        <section aria-labelledby="terms-fair-use">
          <h2 id="terms-fair-use">9. Fair use</h2>
          <p>
            You must comply with the supplier and network fair-use rules that apply to your plan.
            Prohibited uses may include reselling access, automated or fraudulent traffic, using
            the service to break the law, interfering with a network, or any other use the
            supplier prohibits. A supplier may suspend or restrict service for a violation, subject
            to applicable law and any mandatory consumer protections.
          </p>
        </section>

        <section aria-labelledby="terms-orders">
          <h2 id="terms-orders">10. Orders, prices, tax, and payment</h2>
          <p>
            An order is an offer to buy, subject to acceptance and successful payment. The checkout
            shows the plan, quantity, currency, subtotal, tax treatment, and total before you
            continue to payment. The amount shown at the payment step is the amount due for that
            order. No additional fee is added later by ESIMPROVE.
          </p>
          <p>
            Prices may change before an order is accepted; the price shown at checkout applies to
            that checkout session. Where tax applies, it is shown at checkout before payment. Where
            no tax is added at this time, no tax will be added later for that order.
          </p>
          <p>
            We may cancel and refund an order that cannot be fulfilled, that appears fraudulent, or
            that was placed in error due to a pricing or catalogue mistake. You will be notified and
            refunded in full in those cases.
          </p>
        </section>

        <section aria-labelledby="terms-delivery">
          <h2 id="terms-delivery">11. Digital delivery and fulfilment</h2>
          <p>
            eSIM products are digital. Delivery means making the installation details and
            activation information available to you in your account, by the contact email used for
            the order, or on the order page. Delivery is not a guarantee that installation will
            succeed on an incompatible or locked device.
          </p>
          <p>
            Where available, order and activation status can be inspected in your customer portal
            or through the order link included with your order confirmation.
          </p>
          <p>
            If a paid order is not delivered, contact us at{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> with the order
            reference. Do not send passwords, one-time codes, or full card numbers. We will
            investigate and apply the <Link href="/legal/refunds">Refund policy</Link>.
          </p>
        </section>

        <section aria-labelledby="terms-refunds">
          <h2 id="terms-refunds">12. Cancellation and refunds</h2>
          <p>
            Refund eligibility depends on whether the eSIM was delivered, provisioned, installed,
            activated, or used, and on the nature of the issue. The{" "}
            <Link href="/legal/refunds">Refund policy</Link> explains what is refundable and how to
            request a refund. Nothing in these terms excludes a mandatory refund or cancellation
            right you have under consumer law.
          </p>
        </section>

        <section aria-labelledby="terms-customer">
          <h2 id="terms-customer">13. Customer responsibilities</h2>
          <ul>
            <li>Check device compatibility, carrier lock status, and destination coverage before purchase.</li>
            <li>Provide a correct email address and order details.</li>
            <li>Install and test the eSIM according to the supplied or platform instructions.</li>
            <li>Keep order references and activation details secure and do not share them publicly.</li>
            <li>Use the service lawfully and follow supplier fair-use rules.</li>
            <li>Tell us promptly about a failed delivery, duplicate charge, or technical fault.</li>
          </ul>
        </section>

        <section aria-labelledby="terms-prohibited">
          <h2 id="terms-prohibited">14. Prohibited use</h2>
          <p>
            You must not attempt to gain unauthorised access, bypass authentication or payment,
            interfere with the site or another user, submit false identity or deletion requests,
            scrape private data, distribute malware, resell services without authorisation, or use
            the service for unlawful, fraudulent, or abusive activity. We may investigate and take
            reasonable protective action, including suspending accounts.
          </p>
        </section>

        <section aria-labelledby="terms-availability">
          <h2 id="terms-availability">15. Availability, interruptions, and third parties</h2>
          <p>
            The website and the eSIM services delivered through it are provided on an as-available
            basis. Maintenance, security incidents, hosting failures, network outages, supplier
            outages, payment-provider failures, and events outside reasonable control may interrupt
            service. No uninterrupted availability or specific response time is promised.
          </p>
          <p>
            eSIM service depends on third-party mobile networks, suppliers, payment processors,
            hosting, and email providers. Their terms and limitations may also apply to you. No
            partnership with, certification by, or endorsement from any network, supplier, or
            provider is implied unless expressly documented.
          </p>
        </section>

        <section aria-labelledby="terms-ip">
          <h2 id="terms-ip">16. Intellectual property</h2>
          <p>
            The site design, text, brand elements, and software are owned by ESIMPROVE or used with
            permission. You receive a limited, revocable, non-exclusive right to use the site for
            personal shopping and account management. You must not copy, modify, distribute, scrape,
            or create derivative commercial products without written permission. Supplier names,
            network names, and third-party marks remain the property of their owners.
          </p>
        </section>

        <section aria-labelledby="terms-liability">
          <h2 id="terms-liability">17. Liability</h2>
          <p>
            To the extent permitted by law, ESIMPROVE is not liable for indirect or consequential
            loss, loss of profit, loss of opportunity, or damage caused by third-party networks,
            suppliers, devices, or events outside reasonable control, except to the extent such
            liability cannot be excluded by law.
          </p>
          <p>
            Nothing in these terms excludes or limits liability that cannot lawfully be excluded,
            including mandatory consumer rights, liability for fraud or fraudulent misrepresentation,
            or liability for death or personal injury caused by negligence where the law does not
            permit exclusion.
          </p>
        </section>

        <section aria-labelledby="terms-disputes">
          <h2 id="terms-disputes">18. Disputes and governing law</h2>
          <p>
            If a dispute arises, contact us first at{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> so the issue can be
            investigated and, we hope, resolved quickly.
          </p>
          <p>
            These terms are governed by the laws of Vietnam, subject to such mandatory consumer
            protection and privacy laws as apply in your country of residence. If you are a consumer,
            nothing in this section deprives you of the protection of mandatory provisions of the
            law of your country of residence, including any right to bring proceedings in a local
            court or use an alternative dispute-resolution route available to you there.
          </p>
        </section>

        <section aria-labelledby="terms-changes">
          <h2 id="terms-changes">19. Changes to these terms</h2>
          <p>
            Material changes will be published with a new version and effective date. Continued use
            of the service after the effective date of a new version constitutes acceptance, except
            where these terms or mandatory law require a fresh acknowledgement. The version in
            force when an order is placed is recorded with the order.
          </p>
        </section>

        <section aria-labelledby="terms-contact">
          <h2 id="terms-contact">20. Contact</h2>
          <p>
            Questions about these terms can be sent to{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> or via the{" "}
            <Link href="/contact">contact page</Link>.
          </p>
        </section>
      </article>

      <BusinessDetails />
      <SupportChannelNotice />
      <LegalDocumentFooter />
    </div>
  );
}
