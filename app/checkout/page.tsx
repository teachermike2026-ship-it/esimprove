import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getCartView } from "@/lib/cart";
import { readCartToken } from "@/lib/cart-session";
import { getCurrentUser } from "@/lib/auth/session";
import { CheckoutForm } from "@/components/checkout-form";
import { EmptyState } from "@/components/empty-state";
import { formatData, formatMoney } from "@/lib/money";
import { newId } from "@/lib/ids";
import { onlineCheckoutAvailable } from "@/lib/config";
import { AlertIcon, ArrowRight, ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Review your eSIM plans and confirm your order details.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  if (!onlineCheckoutAvailable()) {
    return (
      <EmptyState
        title="Online checkout is not available"
        action={{ href: "/plans", label: "Browse plans" }}
      >
        This deployment has no enabled payment provider configured. No card details are
        accepted and no order can be placed.
      </EmptyState>
    );
  }
  const token = await readCartToken();
  if (!token) redirect("/cart");
  const db = await getDb();
  const cart = await getCartView(db, token);
  if (!cart || cart.lines.length === 0) redirect("/cart");
  const user = await getCurrentUser();
  const idempotencyKey = newId("checkout");
  const hasUnavailable = cart.lines.some((line) => line.status !== "published");

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1>Checkout</h1>
          <p className="muted">
            Enter your contact details and review your order. Your eSIM delivery details are
            sent to your account after your order is confirmed.
          </p>
        </div>
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
              <span>Tax (estimate)</span>
              <span>{formatMoney(cart.taxMinor, cart.currency)}</span>
            </div>
            <div className="summary-total">
              <span>Total due</span>
              <span>{formatMoney(cart.totalMinor, cart.currency)}</span>
            </div>
            <p className="form-note">
              {cart.taxMinor === 0
                ? "No tax is added at this time. Applicable tax, if any, will be shown at checkout before payment."
                : "The tax amount above is included in the total. No further charge is added at this time."}
            </p>
            <Link className="button button-ghost button-small" href="/cart">
              Edit cart <ArrowRight className="inline-icon" />
            </Link>
          </section>
          <div className="callout">
            <ShieldIcon className="inline-icon" />
            <p>
              Your order is marked paid only after the payment provider confirms the payment.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
