import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getCartView } from "@/lib/cart";
import { readCartToken } from "@/lib/cart-session";
import { updateCartAction, removeCartAction } from "@/app/actions/cart";
import { formatData, formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/empty-state";
import { ArrowRight, CartIcon, TrashIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/cart",
    title: t("cart.metaTitle"),
    description: t("cart.metaDescription"),
    robots: { index: false, follow: false },
  });
}

export default async function CartPage() {
  const { t, href } = await getI18n();
  const token = await readCartToken();
  const db = await getDb();
  const cart = token ? await getCartView(db, token) : null;

  if (!cart || cart.lines.length === 0) {
    return (
      <>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("cart.eyebrow")}</p>
            <h1>{t("cart.title")}</h1>
          </div>
        </div>
        <EmptyState
          title={t("cart.emptyTitle")}
          action={{ href: href("/plans"), label: t("common.browsePlans") }}
        >
          {t("cart.emptyBody")}
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("cart.eyebrow")}</p>
          <h1>{t("cart.title")}</h1>
          <p className="muted">{t("cart.pricesNote")}</p>
        </div>
      </div>

      <div className="checkout-layout">
        <section className="stack" aria-label={t("cart.itemsAria")}>
          {cart.lines.map((line) => (
            <article key={line.id} className="card form cart-line">
              <div className="cart-line-head">
                <div>
                  <p className="eyebrow">
                    {line.destinationName} · {formatData(line.dataMb)}
                  </p>
                  <h2>
                    <Link href={href(`/plans/${line.planSlug}`)}>{line.planName}</Link>
                  </h2>
                  <p className="muted small">
                    {t("cart.daysValidity", { count: line.validityDays })}
                  </p>
                </div>
                <span className="price">{formatMoney(line.unitPriceMinor, line.currency)}</span>
              </div>
              <div className="cart-line-actions">
                <form action={updateCartAction} className="quantity-form">
                  <input type="hidden" name="itemId" value={line.id} />
                  <label className="visually-hidden" htmlFor={`qty-${line.id}`}>
                    {t("cart.quantityFor", { plan: line.planName })}
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
                    {t("cart.update")}
                  </button>
                </form>
                <form action={removeCartAction}>
                  <input type="hidden" name="itemId" value={line.id} />
                  <button className="button button-ghost button-small" type="submit">
                    <TrashIcon className="inline-icon" /> {t("cart.remove")}
                  </button>
                </form>
                <span className="cart-line-total">
                  {formatMoney(line.unitPriceMinor * line.quantity, line.currency)}
                </span>
              </div>
            </article>
          ))}
        </section>

        <aside className="checkout-sidebar" aria-label={t("cart.summaryAria")}>
          <section className="card summary-card">
            <h2>
              <CartIcon className="inline-icon" /> {t("cart.summary")}
            </h2>
            <div className="summary-row">
              <span>
                {t(cart.count === 1 ? "cart.itemCount" : "cart.itemsCount", {
                  count: cart.count,
                })}
              </span>
              <span>{formatMoney(cart.subtotalMinor, cart.currency)}</span>
            </div>
            <div className="summary-row">
              <span>{t("cart.taxEstimate")}</span>
              <span>{formatMoney(cart.taxMinor, cart.currency)}</span>
            </div>
            <div className="summary-total">
              <span>{t("cart.total")}</span>
              <span>{formatMoney(cart.totalMinor, cart.currency)}</span>
            </div>
            <Link className="button button-wide" href={href("/checkout")}>
              {t("cart.continue")} <ArrowRight className="inline-icon" />
            </Link>
            <Link className="button button-ghost button-wide" href={href("/plans")}>
              {t("cart.keepBrowsing")}
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
