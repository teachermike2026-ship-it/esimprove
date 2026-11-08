import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { loadLegalSettings } from "@/lib/legal";
import { legalStatusLabel, listAccessibilityReviews } from "@/lib/legal-assets";
import {
  BusinessDetails,
  LegalDocumentFooter,
  LegalDocumentHeader,
  SupportChannelNotice,
} from "@/components/legal-document";
import { AlertIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Accessibility statement",
  description:
    "Accessibility measures, known limitations, assessment status, and feedback route for the Esimprove demonstration storefront.",
  alternates: { canonical: "/legal/accessibility" },
};

export const dynamic = "force-dynamic";

export default async function AccessibilityPage() {
  const db = await getDb();
  const [settings, reviews] = await Promise.all([
    loadLegalSettings(db),
    listAccessibilityReviews(db),
  ]);

  return (
    <div className="legal-page">
      <LegalDocumentHeader
        settings={settings}
        documentKey="accessibility"
        title="Accessibility statement"
        intro="This statement describes the accessibility measures implemented in this build, the checks that are still outstanding, and how to report a barrier. It is not a certificate of conformance."
      />

      <article className="card form prose legal-body">
        <section aria-labelledby="a11y-status">
          <h2 id="a11y-status">1. Current status</h2>
          <div className="callout callout-warning">
            <AlertIcon className="inline-icon" />
            <p>
              <strong>Not certified.</strong> The site has not completed an independent WCAG 2.2
              Level AA audit. Automated checks and code review are not a substitute for manual
              testing with a keyboard, screen reader, magnifier, speech input, and reduced-motion
              settings. The owner must arrange a qualified review before claiming conformance.
            </p>
          </div>
          <p>
            The target for this project is WCAG 2.2 Level AA. That is a goal, not a claim that
            every success criterion currently passes.
          </p>
        </section>

        <section aria-labelledby="a11y-measures">
          <h2 id="a11y-measures">2. Measures implemented in this build</h2>
          <ul>
            <li>Semantic landmarks, a skip link, and a single main content region on public pages.</li>
            <li>Visible keyboard focus styles and native controls for links, buttons, forms, and the consent dialog.</li>
            <li>Labelled form fields, error announcements, and a visible checkbox pattern for consent and legal acknowledgements.</li>
            <li>
              A native <code>dialog</code> for cookie preferences with a close action, focus return,
              and equal prominence for reject, accept, customise, and withdraw actions.
            </li>
            <li>Decorative graphics hidden from assistive technology where they carry no meaning.</li>
            <li>
              Blog featured images must have alternative text before publication; the admin
              workflow rejects an empty description.
            </li>
            <li>Status messages that combine colour with text, rather than relying on colour alone.</li>
            <li>Responsive layouts that reflow at narrow widths, and a reduced-motion media query for users who request it.</li>
            <li>No autoplaying video, carousel, countdown, or flashing content.</li>
            <li>Clear demo labelling so a visitor is not misled about live payments, activation, reviews, or support.</li>
          </ul>
        </section>

        <section aria-labelledby="a11y-limitations">
          <h2 id="a11y-limitations">3. Known limitations and outstanding work</h2>
          <ul>
            <li>
              <strong>Manual audit pending.</strong> Keyboard-only, screen-reader, zoom/reflow, and
              colour-contrast checks have not been completed by an independent reviewer.
            </li>
            <li>
              <strong>Admin tables and forms.</strong> Dense data tables and repeated inline forms in
              the administrator dashboard need a dedicated keyboard and screen-reader review.
            </li>
            <li>
              <strong>Consent dialog.</strong> The dialog uses a native browser element. Older
              browsers without full <code>dialog</code> support may behave differently; a fallback
              review is outstanding.
            </li>
            <li>
              <strong>Optional Google Analytics.</strong> If the owner configures GA4, Google&apos;s
              script and any accessibility characteristics of Google&apos;s interface are outside
              this project&apos;s control.
            </li>
            <li>
              <strong>Third-party content.</strong> Any future supplier widget, payment iframe, or
              media embed must be assessed before it is enabled.
            </li>
            <li>
              <strong>No public conformance report.</strong> No VPAT, audit report, or certification
              exists for this build.
            </li>
          </ul>
        </section>

        <section aria-labelledby="a11y-assessments">
          <h2 id="a11y-assessments">4. Recorded assessment areas</h2>
          <p>
            The table below reflects the internal review register. A status of &quot;not
            verified&quot; means the area is known to require work; it is not a pass.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">Accessibility review areas and status</caption>
              <thead>
                <tr>
                  <th scope="col">Area</th>
                  <th scope="col">Target</th>
                  <th scope="col">Status</th>
                  <th scope="col">Findings</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td>{review.area.replaceAll("_", " ")}</td>
                    <td>{review.wcagLevel}</td>
                    <td>
                      <span
                        className={`badge ${
                          review.status === "complete" ? "badge-success" : "badge-warning"
                        }`}
                      >
                        {legalStatusLabel(review.status)}
                      </span>
                    </td>
                    <td className="small">{review.findings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reviews.length === 0 ? (
            <p className="muted">No assessment rows are recorded in this build.</p>
          ) : null}
        </section>

        <section aria-labelledby="a11y-feedback">
          <h2 id="a11y-feedback">5. Feedback and alternative access</h2>
          <p>
            If a page, form, checkout step, or consent control is difficult to use, use the{" "}
            <Link href="/contact">contact page</Link> and describe the page, the task, the
            assistive technology or input method you used, and what happened. Do not include
            passwords, one-time codes, or full card numbers.
          </p>
          <p>
            This build stores the message as a local support ticket for administrator review. It
            does not send an email and does not provide a live response time. If you need a
            different format or an alternative route, say so in the message and the owner can
            arrange it once a real support channel exists.
          </p>
          <p>
            Privacy-related requests can use the{" "}
            <Link href="/privacy/request">privacy request form</Link> instead of the general contact
            form.
          </p>
        </section>

        <section aria-labelledby="a11y-enforcement">
          <h2 id="a11y-enforcement">6. Complaints and enforcement</h2>
          <p>
            Accessibility complaint routes and enforcement bodies depend on the owner&apos;s
            jurisdiction and the visitor&apos;s country. The owner has not yet configured a
            jurisdiction-specific route. This draft does not name an ombudsman, regulator, or
            certification body that has not been verified.
          </p>
        </section>

        <section aria-labelledby="a11y-review-process">
          <h2 id="a11y-review-process">7. Review process</h2>
          <p>
            The intended review covers: automated linting and static checks; keyboard-only
            navigation for public, checkout, account, and admin flows; screen-reader checks on
            Windows and at least one mobile platform; contrast measurement for text and controls;
            200% zoom and 320 CSS-pixel reflow; reduced motion; and error recovery. Findings are
            recorded in the admin Legal &amp; Compliance section with a status, owner, and date. A
            statement is only marked complete when a qualified reviewer has signed it off.
          </p>
        </section>

        <section aria-labelledby="a11y-changes">
          <h2 id="a11y-changes">8. Changes to this statement</h2>
          <p>
            The version and effective date are shown above. Material changes to the interface,
            consent flow, or review status require a new version. A draft version must not be
            presented as a final conformance statement.
          </p>
        </section>
      </article>

      <BusinessDetails settings={settings} />
      <SupportChannelNotice settings={settings} />
      <LegalDocumentFooter settings={settings} documentKey="accessibility" />
    </div>
  );
}
