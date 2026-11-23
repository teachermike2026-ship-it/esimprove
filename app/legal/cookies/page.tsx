import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { loadSeoSettings } from "@/lib/seo";
import {
  BusinessDetails,
  LegalDocumentFooter,
  LegalDocumentHeader,
  SupportChannelNotice,
} from "@/components/legal-document";
import { CookieSettingsButton } from "@/components/analytics-tracker";

export const metadata: Metadata = {
  title: "Cookie policy",
  description:
    "Cookies and browser storage used by ESIMPROVE, the consent categories, the optional Google Analytics 4 integration, and how to withdraw consent.",
  alternates: { canonical: "/legal/cookies" },
};

export const dynamic = "force-dynamic";

export default async function CookiesPage() {
  const db = await getDb();
  const seo = await loadSeoSettings(db);
  const ga4Configured = Boolean(
    seo.ga4MeasurementId && /^G-[A-Z0-9]{6,}$/i.test(seo.ga4MeasurementId),
  );

  return (
    <div className="legal-page">
      <LegalDocumentHeader
        title="Cookie policy"
        intro="This policy lists the cookies and browser storage used by ESIMPROVE, the categories you can choose, the optional Google Analytics 4 integration, and how to change or withdraw a choice."
      />

      <article className="card form prose legal-body">
        <section aria-labelledby="cookies-scope">
          <h2 id="cookies-scope">1. Scope</h2>
          <p>
            This policy covers cookies, local storage, and session storage set by this website. It
            does not cover storage set by a third-party website you visit separately. ESIMPROVE does
            not install advertising pixels, social plugins, or marketing SDKs.
          </p>
          <div className="callout">
            <p>
              <strong>Current configuration:</strong> optional first-party analytics is available
              but off until you allow it. Google Analytics 4 is{" "}
              {ga4Configured
                ? "enabled and loads only after analytics consent"
                : "not currently enabled"}
              . No marketing storage is used.
            </p>
          </div>
          <p>
            <CookieSettingsButton label="Open cookie settings" />
          </p>
        </section>

        <section aria-labelledby="cookies-consent">
          <h2 id="cookies-consent">2. How consent works</h2>
          <ul>
            <li>
              The first visit shows a consent banner with equally accessible actions to reject
              non-essential storage, accept all, or customise categories. No optional analytics is
              loaded before you make a choice.
            </li>
            <li>
              Your choice is stored in your browser with a policy version and timestamp. A missing,
              malformed, or outdated value is never treated as consent.
            </li>
            <li>
              The server records a pseudonymous consent ID (an HMAC hash of a random browser ID),
              the policy version, the categories, the action, a coarse country code if the hosting
              provider supplies one, and the browser user-agent string. Raw IP addresses are not
              stored in the consent record.
            </li>
            <li>
              First-party analytics requests must include the consent ID. The server checks its own
              consent record and rejects or ignores collection if the record is missing, withdrawn,
              outdated, or older than 180 days.
            </li>
            <li>
              Rejecting analytics does not block sign-in, the cart, checkout, or legal pages.
              Consent is not a condition of purchase.
            </li>
          </ul>
        </section>

        <section aria-labelledby="cookies-essential">
          <h2 id="cookies-essential">3. Strictly necessary storage</h2>
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">
                Strictly necessary cookies and browser storage
              </caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>esimprove_session</code>
                  </td>
                  <td>HTTP-only cookie</td>
                  <td>
                    Keeps a signed-in account session secure. SameSite=Lax; Secure when the site is
                    served over HTTPS.
                  </td>
                  <td>Session expiry; 30 days by default, or 10 minutes while two-factor sign-in is pending.</td>
                </tr>
                <tr>
                  <td>
                    <code>cart_token</code>
                  </td>
                  <td>HTTP-only cookie</td>
                  <td>
                    Associates this browser with its local cart. SameSite=Lax; Secure when served
                    over HTTPS.
                  </td>
                  <td>30 days or until the cart cookie is cleared.</td>
                </tr>
                <tr>
                  <td>
                    <code>es_consent_v1</code>
                  </td>
                  <td>Local storage</td>
                  <td>
                    Stores the versioned consent choice (policy version, timestamp, action, and
                    categories). This record is how the interface remembers not to load optional
                    storage.
                  </td>
                  <td>Until you clear site storage, change the choice, or the policy version changes.</td>
                </tr>
                <tr>
                  <td>
                    <code>es_consent_id</code>
                  </td>
                  <td>Local storage</td>
                  <td>
                    A random pseudonymous identifier used to match your browser to the server-side
                    consent evidence. The server stores only an HMAC hash of this value.
                  </td>
                  <td>Until you clear site storage.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="cookies-optional">
          <h2 id="cookies-optional">4. Optional analytics storage</h2>
          <p>
            The following storage is used only after you grant analytics consent. If you reject or
            withdraw analytics, it is not created or used.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">
                Optional analytics cookies and browser storage
              </caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>es_analytics_visitor</code>
                  </td>
                  <td>Local storage</td>
                  <td>
                    A random pseudonymous visitor identifier for first-party analytics. The server
                    stores an HMAC hash, not the raw value.
                  </td>
                  <td>Until you clear site storage.</td>
                </tr>
                <tr>
                  <td>
                    <code>es_analytics_session</code>
                  </td>
                  <td>Session storage</td>
                  <td>
                    A random session identifier used to group events within the browser tab.
                  </td>
                  <td>Until the tab or browser session ends.</td>
                </tr>
                {ga4Configured ? (
                  <tr>
                    <td>
                      <code>_ga</code>, <code>_ga_*</code>
                    </td>
                    <td>Cookies set by Google</td>
                    <td>
                      Optional Google Analytics 4 measurement. The loader runs only after analytics
                      consent and sets Google advertising-personalisation and signals options off.
                    </td>
                    <td>Controlled by Google and the browser; commonly up to two years for _ga.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {!ga4Configured ? (
            <p>
              Google Analytics 4 is not currently enabled, so no Google Analytics script or Google
              cookie is loaded.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="cookies-marketing">
          <h2 id="cookies-marketing">5. Marketing storage</h2>
          <p>
            No marketing cookies, advertising pixels, remarketing tags, or social-media trackers are
            used. If we add one in future, this policy and the consent manager will be updated
            first, and the category will remain off until consent is recorded.
          </p>
        </section>

        <section aria-labelledby="cookies-server">
          <h2 id="cookies-server">6. Server-side consent evidence</h2>
          <p>
            We keep server-side records of your consent choice so we can honour it, enforce the
            analytics gate, and investigate a dispute about what you agreed to. These records are
            not used to build an advertising profile.
          </p>
          <p>
            A consent record is treated as analytics evidence for at most 180 days. After that, the
            browser is asked to make a fresh choice before optional analytics can resume.
          </p>
        </section>

        <section aria-labelledby="cookies-controls">
          <h2 id="cookies-controls">7. Changing or withdrawing your choice</h2>
          <p>
            Use the cookie settings button in the footer or on this page at any time. You can reject
            all non-essential storage, allow analytics only, or withdraw optional consent. A
            withdrawal stops first-party analytics and disables Google Analytics for this browser
            where it is enabled. It does not delete records that were lawfully collected before
            withdrawal; those records follow the retention section of the{" "}
            <Link href="/legal/privacy">Privacy policy</Link>.
          </p>
          <p>
            You can also clear cookies and site storage through your browser settings. Clearing
            storage removes the local choice, so the consent banner may appear again and no
            analytics runs until you choose.
          </p>
          <p>
            <CookieSettingsButton label="Manage cookie preferences" />
          </p>
        </section>

        <section aria-labelledby="cookies-signals">
          <h2 id="cookies-signals">8. Do Not Track and Global Privacy Control</h2>
          <p>
            When the browser sends Do Not Track or Global Privacy Control, first-party analytics
            suppresses collection even if an analytics consent previously exists. These signals are
            not treated as consent to anything.
          </p>
        </section>

        <section aria-labelledby="cookies-third-parties">
          <h2 id="cookies-third-parties">9. Third parties</h2>
          <p>
            ESIMPROVE uses a hosting provider to serve the site and a database provider to store
            application data. Google Analytics 4 is optional and consent-gated. Payment processing
            is handled by the payment provider shown at checkout. eSIM service depends on mobile
            network operators and eSIM suppliers. Their storage and privacy practices are described
            in their own policies.
          </p>
        </section>

        <section aria-labelledby="cookies-changes">
          <h2 id="cookies-changes">10. Changes to this policy</h2>
          <p>
            A material change to storage or tracking requires a new policy version. When the version
            changes, the site asks for a fresh choice rather than reusing an older consent value.
          </p>
        </section>
      </article>

      <BusinessDetails />
      <SupportChannelNotice />
      <LegalDocumentFooter />
    </div>
  );
}
