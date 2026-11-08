import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { loadAuthorizedMockPayment } from "@/lib/payment-access";
import { mockCommerceAllowed } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import { simulateFailureAction, simulateSuccessAction } from "./actions";
import { AlertIcon, ArrowRight, CreditCardIcon, LockIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Mock payment",
  description: "Simulated payment page. No real money moves.",
  robots: { index: false, follow: false },
};

export default async function MockPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ failed?: string; error?: string; token?: string }>;
}) {
  const { paymentId } = await params;
  const flags = await searchParams;
  const token = flags.token ?? null;
  if (!mockCommerceAllowed) notFound();
  const db = await getDb();
  const authorized = await loadAuthorizedMockPayment(db, paymentId, token);
  if (!authorized) notFound();
  const { payment, order } = authorized;

  if (payment.status === "paid") {
    const query = new URLSearchParams({ order: order.orderNumber });
    if (token) query.set("token", token);
    redirect(`/checkout/success?${query.toString()}`);
  }

  const failed = payment.status === "failed" || flags.failed === "1";

  return (
    <div className="centered">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Mock payment</p>
          <h1>Demo payment page</h1>
          <p className="muted">
            This page is a sandbox. It cannot charge a card, contact a processor, or move
            money.
          </p>
        </div>
      </div>

      <section className="card payment-card">
        <div className="payment-demo">
          <CreditCardIcon className="inline-icon" />
          <p>
            <strong>Sandbox only.</strong> The buttons below generate a signed mock webhook
            event. No payment provider is connected.
          </p>
        </div>

        {flags.error ? (
          <div className="form-error" role="alert">
            <AlertIcon className="inline-icon" />
            <span>{flags.error}</span>
          </div>
        ) : null}

        {failed ? (
          <div className="callout callout-warning">
            <AlertIcon className="inline-icon" />
            <p>
              This mock payment is marked failed. Return to the demo checkout to create a new
              payment session. No money moved and the cart was not charged.
            </p>
          </div>
        ) : null}

        <dl className="meta-list">
          <div>
            <dt>Order</dt>
            <dd>{order.orderNumber}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{order.email}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>{formatMoney(payment.amountMinor, payment.currency)}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{payment.provider} (mock sandbox)</dd>
          </div>
        </dl>

        {failed ? (
          <div className="payment-actions">
            <Link className="button" href="/checkout">
              Return to checkout <ArrowRight className="inline-icon" />
            </Link>
            <Link className="button button-ghost" href="/cart">
              Review cart
            </Link>
          </div>
        ) : (
          <div className="payment-actions">
            <form action={simulateSuccessAction}>
              <input type="hidden" name="paymentId" value={payment.id} />
              {token ? <input type="hidden" name="token" value={token} /> : null}
              <button className="button" type="submit">
                <LockIcon className="inline-icon" /> Simulate successful payment
              </button>
            </form>
            <form action={simulateFailureAction}>
              <input type="hidden" name="paymentId" value={payment.id} />
              {token ? <input type="hidden" name="token" value={token} /> : null}
              <button className="button button-secondary" type="submit">
                Simulate failed payment
              </button>
            </form>
          </div>
        )}

        <p className="form-note">
          <LockIcon className="inline-icon" /> The signed webhook path is shared with the API
          route at <code>/api/webhooks/payments/mock</code>. This page is for local
          demonstration only.
        </p>
      </section>
    </div>
  );
}
