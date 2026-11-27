"use client";

import { useMemo, useState } from "react";
import { Checkout, CheckoutElement, WhopElements } from "@whop/elements-react";
import { loadWhop } from "@whop/elements";

/**
 * Whop's embedded checkout (Whop Elements) for a checkout configuration the
 * server created for this order. The configuration carries the server-side
 * price and the order references; nothing here can change what is charged.
 *
 * Completion in the browser is never treated as payment: Whop redirects to
 * `returnUrl`, which only displays the status our verified webhook recorded.
 * If the hosted Elements script cannot load (blocked, offline, or sandbox
 * Elements unavailable), the customer can use Whop's hosted checkout page for
 * the same configuration instead.
 */
export function WhopEmbeddedCheckout({
  checkoutConfigurationId,
  environment,
  returnUrl,
  hostedCheckoutUrl,
  labels,
}: {
  checkoutConfigurationId: string;
  environment: "sandbox" | "production";
  returnUrl: string;
  hostedCheckoutUrl: string | null;
  labels: { loading: string; loadFailed: string; openHosted: string; sandboxNotice: string };
}) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const elements = useMemo(() => loadWhop(), []);

  return (
    <div className="whop-embed">
      {environment === "sandbox" ? <p className="badge badge-demo whop-embed-sandbox">{labels.sandboxNotice}</p> : null}
      {failed ? (
        <div className="callout callout-warning" role="alert">
          <p>{labels.loadFailed}</p>
        </div>
      ) : (
        <>
          {loading ? (
            <p className="muted whop-embed-loading" role="status">
              {labels.loading}
            </p>
          ) : null}
          <WhopElements elements={elements} environment={environment} onLoadError={() => setFailed(true)}>
            <Checkout
              checkoutConfiguration={checkoutConfigurationId}
              returnUrl={returnUrl}
              onLoadingChange={(next) => setLoading(Boolean(next))}
            >
              <CheckoutElement />
            </Checkout>
          </WhopElements>
        </>
      )}
      {hostedCheckoutUrl ? (
        <p className="whop-embed-fallback">
          <a href={hostedCheckoutUrl} rel="noreferrer">
            {labels.openHosted}
          </a>
        </p>
      ) : null}
    </div>
  );
}
