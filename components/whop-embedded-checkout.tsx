"use client";

import { useMemo, useState } from "react";
import { Checkout, CheckoutElement, WhopElements } from "@whop/elements-react";
import { loadWhop } from "@whop/elements";
import { RetryIcon } from "@/components/icons";

/** Whop Elements UI languages; anything else (for example Arabic) uses English. */
const WHOP_LOCALES = new Set(["en", "es", "fr"]);

/**
 * Whop's payment form embedded inside ESIMPROVE's own checkout page, for the
 * checkout configuration the server created for this order. The customer
 * never leaves esimprove.com: card details, Apple Pay and Google Pay are
 * entered in Whop's secure frame on this page, and there is no link to a
 * whop.com page.
 *
 * The configuration carries the server-side price and order references;
 * nothing here can change what is charged. Completion in the browser is never
 * treated as payment: Whop then sends the customer to `returnUrl` (our own
 * success page), which only shows the status our signature-verified webhook
 * recorded.
 */
export function WhopEmbeddedCheckout({
  checkoutConfigurationId,
  environment,
  returnUrl,
  locale,
  labels,
}: {
  checkoutConfigurationId: string;
  environment: "sandbox" | "production";
  returnUrl: string;
  locale: string;
  labels: { loading: string; loadFailed: string; retry: string; sandboxNotice: string };
}) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const elements = useMemo(() => loadWhop(), []);
  const whopLocale = (WHOP_LOCALES.has(locale) ? locale : "en") as "en" | "es" | "fr";

  return (
    <div className="whop-embed">
      {environment === "sandbox" ? <p className="badge badge-demo whop-embed-sandbox">{labels.sandboxNotice}</p> : null}
      {failed ? (
        <div className="callout callout-warning whop-embed-failed" role="alert">
          <p>{labels.loadFailed}</p>
          <button type="button" className="button button-secondary button-small" onClick={() => window.location.reload()}>
            <RetryIcon className="inline-icon" /> {labels.retry}
          </button>
        </div>
      ) : (
        <>
          {loading ? (
            <div className="whop-embed-loading" role="status">
              <span className="whop-embed-spinner" aria-hidden="true" />
              <span className="muted">{labels.loading}</span>
            </div>
          ) : null}
          <WhopElements
            elements={elements}
            environment={environment}
            locale={whopLocale}
            // ESIMPROVE look: light theme, green accent, soft neutral grays.
            appearance={{ theme: { appearance: "light", accentColor: "green", grayColor: "sage" } }}
            // No Whop advertising pixel on our checkout (no ad tracking
            // without consent). Payment processing is unaffected.
            skipPixel
            onLoadError={() => setFailed(true)}
          >
            <Checkout
              checkoutConfiguration={checkoutConfigurationId}
              returnUrl={returnUrl}
              onLoadingChange={(next) => setLoading(Boolean(next))}
            >
              {/* onReady fires once Whop's form is drawn inside our page. */}
              <CheckoutElement onReady={() => setLoading(false)} />
            </Checkout>
          </WhopElements>
        </>
      )}
    </div>
  );
}
