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
    path: "/legal/accessibility",
    title: t("legal.accessibility"),
    description: t("legal.accessibilityDescription"),
  });
}

export default async function AccessibilityPage() {
  const { t } = await getI18n();
  return (
    <div className="legal-page">
      <LegalDocumentHeader
        title={t("legal.accessibility")}
        intro="This statement describes the accessibility measures ESIMPROVE implements, the limitations that remain, and how to report a barrier you encounter."
      />

      <article className="card form prose legal-body">
        <section aria-labelledby="a11y-status">
          <h2 id="a11y-status">1. Our commitment and current status</h2>
          <p>
            ESIMPROVE aims to make the platform usable by as many people as possible, including
            people who use screen readers, keyboard navigation, magnifiers, speech input, or
            reduced-motion settings. Our working target is WCAG 2.2 Level AA.
          </p>
          <p>
            The site has not been independently certified against WCAG 2.2 Level AA at this time.
            Accessibility is an ongoing practice rather than a one-off check, and this statement
            describes where we are, not a claim of conformance.
          </p>
        </section>

        <section aria-labelledby="a11y-measures">
          <h2 id="a11y-measures">2. Measures we implement</h2>
          <ul>
            <li>Semantic landmarks, a skip link, and a single main content region on public pages.</li>
            <li>Visible keyboard focus styles and native controls for links, buttons, forms, and the consent dialog.</li>
            <li>Labelled form fields, error announcements, and a visible pattern for consent and legal acknowledgements.</li>
            <li>
              A native <code>dialog</code> for cookie preferences with a close action, focus return,
              and equal prominence for reject, accept, customise, and withdraw actions.
            </li>
            <li>Decorative graphics hidden from assistive technology where they carry no meaning.</li>
            <li>Alternative text required for meaningful blog and guide images before publication.</li>
            <li>Status messages that combine colour with text, rather than relying on colour alone.</li>
            <li>Responsive layouts that reflow at narrow widths, and a reduced-motion media query for users who request it.</li>
            <li>No autoplaying video, carousel, countdown, or flashing content.</li>
          </ul>
        </section>

        <section aria-labelledby="a11y-limitations">
          <h2 id="a11y-limitations">3. Known limitations</h2>
          <ul>
            <li>
              <strong>Manual audit pending.</strong> Keyboard-only, screen-reader, zoom and reflow,
              and colour-contrast checks have not been completed by an independent auditor.
            </li>
            <li>
              <strong>Dense data tables and forms.</strong> Some data-heavy views may require extra
              effort with a keyboard or screen reader.
            </li>
            <li>
              <strong>Consent dialog.</strong> The dialog uses the native browser element. Older
              browsers without full <code>dialog</code> support may behave differently.
            </li>
            <li>
              <strong>Optional Google Analytics.</strong> When enabled, Google&apos;s script and any
              accessibility characteristics of Google&apos;s interface are outside our control.
            </li>
            <li>
              <strong>Third-party content.</strong> Any supplier widget, payment iframe, or media
              embed will be assessed for accessibility before it is enabled.
            </li>
          </ul>
        </section>

        <section aria-labelledby="a11y-feedback">
          <h2 id="a11y-feedback">4. Feedback and alternative access</h2>
          <p>
            If a page, form, checkout step, or consent control is difficult to use, contact us at{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> or via the{" "}
            <Link href="/contact">contact page</Link>. Describe the page, the task, the assistive
            technology or input method you used, and what happened. Do not include passwords,
            one-time codes, or full card numbers.
          </p>
          <p>
            If you need this content in a different format, or need assistance completing a task on
            the site, tell us in the message and we will do our best to help.
          </p>
          <p>
            Privacy-related requests can use the{" "}
            <Link href="/privacy/request">privacy request form</Link> instead of the general
            contact page.
          </p>
        </section>

        <section aria-labelledby="a11y-enforcement">
          <h2 id="a11y-enforcement">5. Complaints</h2>
          <p>
            If you are not satisfied with our response to an accessibility problem, contact us
            first at <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. You may
            also have the right to escalate a complaint to a consumer or public-sector body in your
            country of residence. The complaint route depends on where you live.
          </p>
        </section>

        <section aria-labelledby="a11y-review">
          <h2 id="a11y-review">6. Review process</h2>
          <p>
            We review accessibility as part of design and development: automated checks and static
            analysis, keyboard-only navigation of public and account flows, screen-reader checks,
            contrast measurement, zoom and reflow testing, reduced motion, and error recovery. We
            act on findings as we identify them and are working towards a complete independent
            audit.
          </p>
        </section>

        <section aria-labelledby="a11y-changes">
          <h2 id="a11y-changes">7. Changes to this statement</h2>
          <p>
            Material changes to the interface, consent flow, or the accessibility of the platform
            will be reflected here with a new version and effective date. The current version is
            always available at this address.
          </p>
        </section>
      </article>

      <BusinessDetails />
      <SupportChannelNotice />
      <LegalDocumentFooter />
    </div>
  );
}
