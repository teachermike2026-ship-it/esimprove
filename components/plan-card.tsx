import Link from "next/link";
import { addToCartAction } from "@/app/actions/cart";
import { formatData, formatMoney } from "@/lib/money";
import type { PlanSummary } from "@/lib/catalog";
import { ArrowRight, CartIcon, QrIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { isLocalDemoPlan } from "@/lib/demo-plan";
import { DestinationFlag } from "@/components/country-flag";

export async function PlanCard({ plan, compact = false }: { plan: PlanSummary; compact?: boolean }) {
  const { t, href } = await getI18n();
  const demo = isLocalDemoPlan(plan);
  return (
    <article className={`card plan-card accent-${plan.accent} ${compact ? "plan-card-compact" : ""}`}>
      <div className="plan-card-top">
        <div>
          {demo ? (
            <p>
              <span className="badge badge-demo">{t("demo.badge")}</span>
            </p>
          ) : null}
          <p className="eyebrow plan-card-place">
            <DestinationFlag countryCode={plan.countryCode} name={plan.destinationName} coverage={plan.coverage} size="sm" />
            <span>
              {plan.destinationName} <span aria-hidden="true">·</span> {plan.regionName}
            </span>
          </p>
          <h3>
            <Link href={href(`/plans/${plan.slug}`)}>{plan.name}</Link>
          </h3>
        </div>
      </div>
      <div className="plan-card-meta">
        <span>
          <strong dir="ltr">{formatData(plan.dataMb)}</strong> {t("catalog.cardData")}
        </span>
        <span>
          <strong dir="ltr">{plan.validityDays}</strong> {t("catalog.cardDays")}
        </span>
        <span>
          <QrIcon className="inline-icon" /> {t("catalog.cardQr")}
        </span>
      </div>
      {!compact ? (
        <p className="plan-card-copy">
          {demo ? t("demo.shortDescription") : plan.description}
        </p>
      ) : null}
      <div className="plan-card-bottom">
        <div className="price-block">
          <span className="price" dir="ltr">
            {formatMoney(plan.priceMinor, plan.currency)}
          </span>
          {demo ? <span className="price-note">{t("demo.priceLabel")}</span> : null}
        </div>
        <div className="plan-card-actions">
          <Link className="button button-ghost button-small" href={href(`/plans/${plan.slug}`)}>
            {t("common.details")} <ArrowRight className="inline-icon" />
          </Link>
          {demo ? (
            <Link className="button button-small" href={href("/checkout?demo=1")}>
              {t("demo.previewShort")} <ArrowRight className="inline-icon" />
            </Link>
          ) : (
            <form action={addToCartAction}>
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="quantity" value="1" />
              <button className="button button-small" type="submit">
                <CartIcon className="inline-icon" /> {t("common.add")}
              </button>
            </form>
          )}
        </div>
      </div>
    </article>
  );
}
