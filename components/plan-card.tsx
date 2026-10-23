import Link from "next/link";
import { addToCartAction } from "@/app/actions/cart";
import { formatData, formatMoney } from "@/lib/money";
import type { PlanSummary } from "@/lib/catalog";
import { ArrowRight, CartIcon, QrIcon } from "@/components/icons";

export function PlanCard({ plan, compact = false }: { plan: PlanSummary; compact?: boolean }) {
  return (
    <article className={`card plan-card accent-${plan.accent} ${compact ? "plan-card-compact" : ""}`}>
      <div className="plan-card-top">
        <div>
          <p className="eyebrow">
            {plan.destinationName} <span aria-hidden="true">·</span> {plan.regionName}
          </p>
          <h3>
            <Link href={`/plans/${plan.slug}`}>{plan.name}</Link>
          </h3>
        </div>
        <span className="badge badge-demo">Demo</span>
      </div>
      <div className="plan-card-meta">
        <span>
          <strong>{formatData(plan.dataMb)}</strong> data
        </span>
        <span>
          <strong>{plan.validityDays}</strong> days
        </span>
        <span>
          <QrIcon className="inline-icon" /> QR + manual
        </span>
      </div>
      {!compact ? <p className="plan-card-copy">{plan.description}</p> : null}
      <div className="plan-card-bottom">
        <div className="price-block">
          <span className="price">{formatMoney(plan.priceMinor, plan.currency)}</span>
          <span className="price-note">demo price</span>
        </div>
        <div className="plan-card-actions">
          <Link className="button button-ghost button-small" href={`/plans/${plan.slug}`}>
            Details <ArrowRight className="inline-icon" />
          </Link>
          <form action={addToCartAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="quantity" value="1" />
            <button className="button button-small" type="submit">
              <CartIcon className="inline-icon" /> Add
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
