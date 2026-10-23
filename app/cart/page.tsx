import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getCartView } from "@/lib/cart";
import { readCartToken } from "@/lib/cart-session";
import { updateCartAction, removeCartAction } from "@/app/actions/cart";
import { formatData, formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/empty-state";
import { ArrowRight, CartIcon, TrashIcon } from "@/components/icons";
import { DemoBadge } from "@/components/badges";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review demo eSIM plans in your local cart.",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const token = await readCartToken();
  const db = await getDb();
  const cart = token ? await getCartView(db, token) : null;

  if (!cart || cart.lines.length === 0) {
    return (
      <>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Cart</p>
            <h1>Your demo cart</h1>
          </div>
        </div>
        <EmptyState title="Your cart is empty" action={{ href: "/plans", label: "Browse demo plans" }}>
          Add a clearly labelled demo plan to walk through checkout, mock payment, and mock
          fulfillment.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cart</p>
          <h1>Your demo cart</h1>
          <p className="muted">
            Prices are recalculated from the local catalogue when you continue. No real
            payment will be taken.
          </p>
        </div>
        <DemoBadge />
      </div>

      <div className="checkout-layout">
        <section className="stack" aria-label="Cart items">
          {cart.lines.map((line) => (
            <article key={line.id} className="card form cart-line">
              <div className="cart-line-head">
                <div>
                  <p className="eyebrow">
                    {line.destinationName} · {formatData(line.dataMb)}
                  </p>
                  <h2>
                    <Link href={`/plans/${line.planSlug}`}>{line.planName}</Link>
                  </h2>
                  <p className="muted small">
                    {line.validityDays} days · {line.isDemo ? "Demo plan" : "Plan"}
                  </p>
                </div>
                <span className="price">{formatMoney(line.unitPriceMinor, line.currency)}</span>
              </div>
              <div className="cart-line-actions">
                <form action={updateCartAction} className="quantity-form">
                  <input type="hidden" name="itemId" value={line.id} />
                  <label className="visually-hidden" htmlFor={`qty-${line.id}`}>
                    Quantity for {line.planName}
                  </label>
                  <input
                    id={`qty-${line.id}`}
                    name="quantity"
                    type="number"
                    min="1"
                    max="5"
                    defaultValue={line.quantity}
                  />
                  <button className="button button-secondary button-small" type="submit">
                    Update
                  </button>
                </form>
                <form action={removeCartAction}>
                  <input type="hidden" name="itemId" value={line.id} />
                  <button className="button button-ghost button-small" type="submit">
                    <TrashIcon className="inline-icon" /> Remove
                  </button>
                </form>
                <span className="cart-line-total">
                  {formatMoney(line.unitPriceMinor * line.quantity, line.currency)}
                </span>
              </div>
            </article>
          ))}
        </section>

        <aside className="checkout-sidebar" aria-label="Cart summary">
          <section className="card summary-card">
            <h2>
              <CartIcon className="inline-icon" /> Summary
            </h2>
            <div className="summary-row">
              <span>{cart.count} item{cart.count === 1 ? "" : "s"}</span>
              <span>{formatMoney(cart.subtotalMinor, cart.currency)}</span>
            </div>
            <div className="summary-row">
              <span>Tax (demo)</span>
              <span>{formatMoney(cart.taxMinor, cart.currency)}</span>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <span>{formatMoney(cart.totalMinor, cart.currency)}</span>
            </div>
            <Link className="button button-wide" href="/checkout">
              Continue to demo checkout <ArrowRight className="inline-icon" />
            </Link>
            <Link className="button button-ghost button-wide" href="/plans">
              Keep browsing
            </Link>
          </section>
          <div className="callout callout-warning">
            <p>
              The cart, prices, and checkout are real local application behavior. The supplier
              and payment provider are mock adapters, not live connections.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
