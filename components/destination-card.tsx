import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { DestinationSummary } from "@/lib/catalog";
import { ArrowRight } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";

export async function DestinationCard({ destination }: { destination: DestinationSummary }) {
  const { t, href } = await getI18n();
  return (
    <article className={`card destination-card accent-${destination.accent}`}>
      <Link href={href(`/destinations/${destination.slug}`)} className="destination-card-link">
        <div className="destination-art" aria-hidden="true">
          <span className="destination-code" dir="ltr">
            {destination.countryCode}
          </span>
          <span className="destination-orbit" />
        </div>
        <div className="destination-card-body">
          <p className="eyebrow">{destination.regionName}</p>
          <h3>{destination.name}</h3>
          <p>{destination.summary}</p>
          <div className="destination-card-footer">
            <span>{t("catalog.destinationPlanCount", { count: destination.planCount })}</span>
            {destination.fromPriceMinor !== null ? (
              <span dir="ltr">
                {t("catalog.fromPrice", {
                  price: formatMoney(destination.fromPriceMinor, "USD"),
                })}
              </span>
            ) : null}
            <ArrowRight className="inline-icon" />
          </div>
        </div>
      </Link>
    </article>
  );
}
