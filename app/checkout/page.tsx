import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getCartView } from "@/lib/cart";
import { readCartToken } from "@/lib/cart-session";
import { getCurrentUser } from "@/lib/auth/session";
import { CheckoutForm } from "@/components/checkout-form";
import { DemoBadge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { formatData, formatMoney } from "@/lib/money";
import { newId } from "@/lib/ids";
import { mockCommerceAllowed } from "@/lib/config";
import { loadLegalSettings } from "@/lib/legal";
import { AlertIcon, ArrowRight, ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Demo checkout for illustrative eSIM plans. No real payment is taken.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  if (!mockCommerceAllowed) {
    return (
      <EmptyState
        title="Online checkout is not available"
        action={{ href: "/plans", label: "Browse plans" }}
      >
        This deployment has no live payment provider configured. No card details are accepted
        and no order can be placed.
      </EmptyState>
    );
  }
  const token = await readCartToken();
  if (!token) redirect("/cart");
  const db = await getDb();
  const cart = await getCartView(db, token);
  if (!cart || cart.lines.length === 0) redirect("/cart");
  const user = await getCurrentUser();
  const legal = await loadLegalSettings(db);
  const idempotencyKey = newId("checkout");
  const hasUnavailable = cart.lines.some((line) => line.status !== "published");

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1>Demo checkout</h1>
          <p className="muted">
            This creates a real local order and a mock payment session. No card details are
            requested and no money moves.
          </p>
        </div>
        <DemoBadge label="Mock payment" />
      </div>

      {hasUnavailable ? (
        <div className="callout callout-warning section-tight">
          <AlertIcon className="inline-icon" />
          <p>
            One or more cart plans are no longer published. Remove them before continuing.
          </p>
        </div>
      ) : null}

      <div className="checkout-layout">
        <CheckoutForm
          idempotencyKey={idempotencyKey}
          termsVersion={legal.termsVersion}
          defaultEmail={user?.email ?? ""}
          defaultName={user?.name ?? ""}
          disabled={hasUnavailable}
        />

        <aside className="checkout-sidebar" aria-label="Order summary">
          <section className="card summary-card">
            <h2>Order summary</h2>
            {cart.lines.map((line) => (
              <div className="summary-row" key={line.id}>
                <span>
                  {line.destinationName} · {formatData(line.dataMb)} × {line.quantity}
                </span>
                <span>{formatMoney(line.unitPriceMinor * line.quantity, line.currency)}</span>
              </div>
            ))}
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{formatMoney(cart.subtotalMinor, cart.currency)}</span>
            </div>
            <div className="summary-row">
              <span>Tax (demo calculation)</span>
              <span>{formatMoney(cart.taxMinor, cart.currency)}</span>
            </div>
            <div className="summary-total">
              <span>Total due on the mock payment page</span>
              <span>{formatMoney(cart.totalMinor, cart.currency)}</span>
            </div>
            <p className="form-note">
              {cart.taxMinor === 0
                ? "No tax is added by this demo. Live tax treatment depends on the owner's jurisdiction and is not configured."
                : "The tax amount above is included in the total. No further charge is added by this build."}
            </p>
            <Link className="button button-ghost button-small" href="/cart">
              Edit cart <ArrowRight className="inline-icon" />
            </Link>
          </section>
          <div className="callout">
            <ShieldIcon className="inline-icon" />
            <p>
              Server-side validation and idempotency are active. The payment page is a mock
              sandbox and cannot charge a card.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
