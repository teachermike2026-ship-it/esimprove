import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { loadAuthorizedMockPayment } from "@/lib/payment-access";
import { mockCommerceAllowed, onlineCheckoutAvailable } from "@/lib/config";
import { isWhopCheckoutUrl } from "@/lib/integrations/payment/whop";
import { formatMoney } from "@/lib/money";
import { AlertIcon, ArrowRight, CreditCardIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Payment",
  description: "Complete your eSIM order.",
  robots: { index: false, follow: false },
};

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { paymentId } = await params;
  const flags = await searchParams;
  const token = flags.token ?? null;
  const db = await getDb();
  const authorized = await loadAuthorizedMockPayment(db, paymentId, token);
  if (!authorized) notFound();
  const { payment, order } = authorized;

  // Preserve the original mock-payment gate. A recorded Whop payment remains
  // viewable by its owner even while checkout is disabled, but it can only be
  // opened again when the storefront currently allows online checkout.
  if (payment.provider === "mock" && !mockCommerceAllowed) notFound();

  if (payment.status === "paid") {
    const query = new URLSearchParams({ order: order.orderNumber });
    if (token) query.set("token", token);
    redirect(`/checkout/success?${query.toString()}`);
  }

  const failed = payment.status === "failed";
  const isWhop = payment.provider === "whop";
  const canResume =
    isWhop &&
    !failed &&
    payment.status === "pending" &&
    onlineCheckoutAvailable() &&
    isWhopCheckoutUrl(payment.checkoutUrl);
  const orderHref = `/orders/${order.orderNumber}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  return (
    <div className="centered">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Payment</p>
          <h1>
            {failed
              ? "Payment not completed"
              : isWhop
                ? "Payment is awaiting confirmation"
                : "Online payment is not available yet"}
          </h1>
          <p className="lead">
            {failed
              ? "Your order was recorded, but the payment did not complete. This store has not marked the order as paid."
              : isWhop
                ? "Your order has been recorded. It is not paid until the payment provider confirms the payment."
                : "Your order has been recorded, but we cannot take payment online right now. Nothing has been charged."}
          </p>
        </div>
      </div>

      <section className="card payment-card">
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
        </dl>

        {failed ? (
          <div className="callout callout-warning">
            <AlertIcon className="inline-icon" />
            <p>
              This payment could not be completed. No money was charged, and your cart has not
              been billed.
            </p>
          </div>
        ) : null}

        <p>
          {isWhop && !failed ? (
            <>
              Complete the payment on the secure payment page. Your eSIM will be issued only
              after the payment provider confirms the payment.
            </>
          ) : (
            <>
              To complete this order, contact our support team and quote your order number{" "}
              <strong>{order.orderNumber}</strong>. Your eSIM will be issued once payment is
              confirmed.
            </>
          )}
        </p>

        <div className="payment-actions">
          {canResume ? (
            <a className="button" href={payment.checkoutUrl} rel="noreferrer">
              <CreditCardIcon className="inline-icon" /> Continue to secure payment{" "}
              <ArrowRight className="inline-icon" />
            </a>
          ) : null}
          <Link className="button" href={orderHref}>
            <CreditCardIcon className="inline-icon" /> View your order{" "}
            <ArrowRight className="inline-icon" />
          </Link>
          <Link className="button button-secondary" href="/contact">
            Contact support
          </Link>
          <Link className="button button-ghost" href="/plans">
            Continue shopping
          </Link>
        </div>
      </section>
    </div>
  );
}
