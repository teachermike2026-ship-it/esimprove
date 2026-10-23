import type { Metadata } from "next";
import { AlertIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Cookies used by the eSIMprove demo storefront.",
  alternates: { canonical: "/legal/cookies" },
};

export default function CookiesPage() {
  return (
    <article className="card form prose">
      <span className="badge badge-demo">Demo configuration</span>
      <h1>Cookies used by this demo</h1>
      <div className="callout">
        <AlertIcon className="inline-icon" />
        <p>
          The demo uses only essential cookies. It does not include analytics, advertising, or
          third-party tracking cookies.
        </p>
      </div>
      <h2>Essential cookies</h2>
      <ul>
        <li>
          <code>esimprove_session</code> — an HTTP-only session cookie for a demo account. It
          is set after sign-in and cleared on sign-out.
        </li>
        <li>
          <code>cart_token</code> — an HTTP-only cart identifier used to associate a browser
          with a local demo cart.
        </li>
      </ul>
      <h2>Consent</h2>
      <p>
        Because these cookies are essential to the demo&apos;s cart and account behavior, no
        consent banner is shown. A production service that adds analytics, marketing, or
        personalization must review consent requirements before enabling those features.
      </p>
    </article>
  );
}
