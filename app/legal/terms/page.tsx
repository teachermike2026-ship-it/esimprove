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
  title: "Terms of service",
  description:
    "Draft terms covering accounts, eSIM compatibility, data plans, orders, payment, delivery, liability, and disputes.",
  alternates: { canonical: "/legal/terms" },
};

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const settings = await loadLegalSettings(await getDb());

  return (
    <div className="legal-page">
      <LegalDocumentHeader
        settings={settings}
        documentKey="terms"
        title="Terms of service"
        intro="These terms govern use of the Esimprove website and any account or order created through it. They describe the demo limitations in this build and the conditions that must be finalised with the owner's supplier, payment, and legal advisers before live sales."
      />

      <article className="card form prose legal-body">
        <section aria-labelledby="terms-agreement">
          <h2 id="terms-agreement">1. Agreement and scope</h2>
          <p>
            By using the website, creating an account, or placing an order, you agree to these
            terms and the documents they link to. If you do not agree, do not use the service.
            These terms do not limit mandatory rights you have under consumer law.
          </p>
          <p>
            This build is a demonstration storefront. No live eSIM is provisioned, no real
            payment is taken, and no real transactional or marketing email is sent.
          </p>
        </section>

        <section aria-labelledby="terms-business">
          <h2 id="terms-business">2. Who we are</h2>
          <p>
            The service is operated by the business identified in the business details below. If
            no verified legal entity, address, registration number, or jurisdiction is shown, the
            operator identity is not configured and these terms are not ready for publication.
          </p>
        </section>

        <section aria-labelledby="terms-eligibility">
          <h2 id="terms-eligibility">3. Eligibility and age</h2>
          <p>
            You must be able to enter a binding contract where you live. The site is not directed
            at children, and no date of birth is requested. The owner has not yet set a specific
            minimum age. If you are below the age of majority, use the service only with a parent
            or guardian&apos;s agreement. The final age position must be confirmed by the owner
            and legal adviser.
          </p>
          <p>
            You must not use the service if you are barred by applicable law or sanctions, or if
            you are using it for prohibited activity described below.
          </p>
        </section>

        <section aria-labelledby="terms-account">
          <h2 id="terms-account">4. Accounts and security</h2>
          <ul>
            <li>Provide accurate account and order information and keep it up to date.</li>
            <li>Keep your password confidential and do not share your account.</li>
            <li>Use a strong, unique password. Administrator accounts require TOTP two-factor authentication in this build.</li>
            <li>
              Tell the operator promptly if you believe your account or an authentication factor
              has been compromised. No live support inbox is connected in this demo.
            </li>
            <li>
              The operator may suspend or restrict an account to protect the service, investigate
              fraud or abuse, comply with law, or enforce these terms. Where appropriate, the
              reason will be explained.
            </li>
          </ul>
        </section>

        <section aria-labelledby="terms-products">
          <h2 id="terms-products">5. Product descriptions and demo catalogue</h2>
          <p>
            Plans are described by destination, data allowance, validity, and price. Catalogue
            rows in this build are demonstration data, not live supplier offers. A live
            storefront must display the actual supplier plan, network, validity, activation
            conditions, restrictions, and price before purchase.
          </p>
          <p>
            Images, QR graphics, and installation illustrations are illustrative unless a live
            order supplies an actual activation code. A displayed demo QR code cannot activate a
            real eSIM.
          </p>
        </section>

        <section aria-labelledby="terms-compatibility">
          <h2 id="terms-compatibility">6. eSIM and device compatibility</h2>
          <p>
            You need an eSIM-capable, carrier-unlocked device. Compatibility depends on the exact
            model, manufacturing region, operating-system version, and carrier configuration. A
            compatibility checker or general article is guidance only and is not a guarantee.
            Confirm support with the device manufacturer and your carrier before buying.
          </p>
          <p>
            You are responsible for checking that the device can install a second eSIM or mobile
            plan, that it supports the relevant radio bands, and that it is not subject to a
            carrier lock or management profile that prevents installation.
          </p>
        </section>

        <section aria-labelledby="terms-coverage">
          <h2 id="terms-coverage">7. Destinations and coverage limitations</h2>
          <p>
            Destination lists describe where a plan is intended to be used. Actual coverage,
            network availability, speed, technology, and service quality depend on local mobile
            operators, your device, terrain, building materials, network congestion, and
            regulatory restrictions. No specific speed, technology, or uninterrupted coverage is
            promised.
          </p>
          <p>
            A regional plan may not work in every country in the region. Check the plan details
            before purchase. Roaming and network-access rules can change without notice.
          </p>
        </section>

        <section aria-labelledby="terms-plans">
          <h2 id="terms-plans">8. Data plans, validity, and activation</h2>
          <p>
            Validity and activation rules differ by supplier and product. Some plans begin when
            the eSIM first connects to a network; others begin at purchase or installation. The
            final rule must be shown on the live plan page before payment. This demo does not
            sell live plans and does not activate an eSIM.
          </p>
          <p>
            Install and test the eSIM before travelling where the plan permits it. Keep the QR
            code and manual activation details until installation is confirmed. Do not repeatedly
            scan, delete, or transfer an eSIM; some products cannot be reissued.
          </p>
          <p>
            Data allowances, throttling, hotspot availability, and fair-use restrictions depend on
            the supplier and network. Plans are not unlimited unless the live supplier terms
            expressly say so and describe the applicable restrictions.
          </p>
        </section>

        <section aria-labelledby="terms-fair-use">
          <h2 id="terms-fair-use">9. Fair use</h2>
          <p>
            You must comply with supplier and network fair-use rules. Prohibited uses may include
            reselling access, automated or fraudulent traffic, using the service to break the law,
            interfering with a network, or using the SIM in a way the supplier prohibits. A
            supplier may suspend or restrict service for a violation, subject to applicable law
            and any mandatory consumer protections.
          </p>
        </section>

        <section aria-labelledby="terms-orders">
          <h2 id="terms-orders">10. Orders, prices, tax, and payment</h2>
          <p>
            An order is an offer to buy subject to acceptance and successful payment. The
            checkout shows the plan, quantity, currency, subtotal, tax calculation, and total
            before you continue to payment. The amount shown on the payment step is the amount
            due for that order. No additional fee is added later by this build.
          </p>
          <p>
            The demo uses a mock payment page and signed mock webhook. No card details are
            requested, no processor is contacted, and no money moves. A live payment provider must
            be selected, contracted, and configured before live sales; its terms and
            authentication requirements will also apply.
          </p>
          <p>
            Where tax is not configured, the demo adds none and says so. The owner must confirm
            tax registration, rates, invoices, and recordkeeping for each jurisdiction before
            production. Prices may change before an order is accepted; the price shown at
            checkout applies to that checkout session.
          </p>
        </section>

        <section aria-labelledby="terms-delivery">
          <h2 id="terms-delivery">11. Delivery and fulfilment</h2>
          <p>
            eSIM products are digital. In a live storefront, delivery usually means making
            installation details available in your account, by email, or on the order page.
            Delivery is not a guarantee that installation will succeed on an incompatible or
            locked device.
          </p>
          <p>
            In this demo, fulfilment is simulated. No real eSIM, QR activation code, or supplier
            order is created. You can inspect the demo order and activation record in the portal,
            but it cannot connect to a network.
          </p>
          <p>
            If a live order is paid but delivery fails, contact support with the order reference.
            Do not send passwords, one-time codes, or full card numbers. The operator will
            investigate the supplier and payment records and apply the{" "}
            <Link href="/legal/refunds">Refund policy</Link>.
          </p>
        </section>

        <section aria-labelledby="terms-refunds">
          <h2 id="terms-refunds">12. Cancellation and refunds</h2>
          <p>
            Refund eligibility depends on whether the eSIM was provisioned, installed, activated,
            used, or misdescribed, and on the supplier and payment provider&apos;s capabilities.
            The <Link href="/legal/refunds">Refund policy</Link> explains the review process.
            Nothing in these terms excludes a mandatory refund or cancellation right.
          </p>
        </section>

        <section aria-labelledby="terms-customer">
          <h2 id="terms-customer">13. Customer responsibilities</h2>
          <ul>
            <li>Check device compatibility, carrier lock status, and destination coverage before purchase.</li>
            <li>Provide a correct email address and order details.</li>
            <li>Install and test the eSIM according to the supplier&apos;s instructions.</li>
            <li>Keep order references and activation details secure and do not share them publicly.</li>
            <li>Use the service lawfully and follow supplier fair-use rules.</li>
            <li>Tell the operator promptly about a failed delivery, duplicate charge, or technical fault.</li>
          </ul>
        </section>

        <section aria-labelledby="terms-prohibited">
          <h2 id="terms-prohibited">14. Prohibited use</h2>
          <p>
            You must not attempt to gain unauthorized access, bypass authentication or payment,
            interfere with the site or another user, submit false identity or deletion requests,
            scrape private data, distribute malware, resell services without authorization, or use
            the service for unlawful, fraudulent, or abusive activity. The operator may investigate
            and take reasonable protective action.
          </p>
        </section>

        <section aria-labelledby="terms-availability">
          <h2 id="terms-availability">15. Availability, interruptions, and third parties</h2>
          <p>
            The website is provided on an as-available basis. Maintenance, security incidents,
            hosting failures, network outages, supplier outages, payment-provider failures, and
            events outside reasonable control may interrupt service. No uninterrupted availability
            or specific response time is promised.
          </p>
          <p>
            Live eSIM service will depend on third-party mobile networks, suppliers, payment
            processors, hosting, and email providers. Their terms and limitations may also apply.
            No partnership, certification, or endorsement is implied unless a verified
            relationship is expressly documented.
          </p>
        </section>

        <section aria-labelledby="terms-ip">
          <h2 id="terms-ip">16. Intellectual property</h2>
          <p>
            The site design, text, brand elements, and software are owned by the operator or used
            with permission. You receive a limited, revocable, non-exclusive right to use the site
            for personal shopping and account management. You must not copy, modify, distribute,
            scrape, or create derivative commercial products without written permission. Supplier
            names, network names, and third-party marks remain the property of their owners.
          </p>
        </section>

        <section aria-labelledby="terms-liability">
          <h2 id="terms-liability">17. Liability</h2>
          <p>
            To the extent permitted by law, the operator is not liable for indirect or
            consequential loss, loss of profit, loss of opportunity, or damage caused by
            third-party networks, suppliers, devices, or events outside reasonable control. The
            operator is responsible for its own acts and omissions as required by law.
          </p>
          <p>
            Nothing in these terms excludes or limits liability that cannot lawfully be excluded,
            including mandatory consumer rights, fraud, or liability for death or personal injury
            caused by negligence where the law does not permit exclusion. The final liability
            position requires legal review for the applicable jurisdiction.
          </p>
        </section>

        <section aria-labelledby="terms-disputes">
          <h2 id="terms-disputes">18. Disputes and governing law</h2>
          <p>
            Contact the operator first so the issue can be investigated. The governing law and
            courts are not configured in this build and must be chosen with legal advice. If you
            are a consumer, you keep the protection of mandatory laws in your country of
            residence, including any right to use a local court or alternative dispute-resolution
            route.
          </p>
        </section>

        <section aria-labelledby="terms-changes">
          <h2 id="terms-changes">19. Changes to these terms</h2>
          <p>
            The version and effective date are shown above. Material changes will be published
            with a new version and, where required, a new acknowledgement. The version in force
            when an order is placed is recorded with the order.
          </p>
        </section>

        <section aria-labelledby="terms-contact">
          <h2 id="terms-contact">20. Contact</h2>
          <p>
            Use the business contact details below or the{" "}
            <Link href="/contact">contact page</Link>. No live support inbox or response-time
            promise is connected in this demo.
          </p>
        </section>
      </article>

      <BusinessDetails settings={settings} />
      <SupportChannelNotice settings={settings} />
      <LegalDocumentFooter settings={settings} documentKey="terms" />
    </div>
  );
}
