import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { DestinationSummary } from "@/lib/catalog";
import { ArrowRight } from "@/components/icons";

export function DestinationCard({ destination }: { destination: DestinationSummary }) {
  return (
    <article className={`card destination-card accent-${destination.accent}`}>
      <Link href={`/destinations/${destination.slug}`} className="destination-card-link">
        <div className="destination-art" aria-hidden="true">
          <span className="destination-code">{destination.countryCode}</span>
          <span className="destination-orbit" />
        </div>
        <div className="destination-card-body">
          <p className="eyebrow">{destination.regionName}</p>
          <h3>{destination.name}</h3>
          <p>{destination.summary}</p>
          <div className="destination-card-footer">
            <span>
              {destination.planCount} plan{destination.planCount === 1 ? "" : "s"}
            </span>
            {destination.fromPriceMinor !== null ? (
              <span>
                from {formatMoney(destination.fromPriceMinor, "USD")}
              </span>
            ) : null}
            <ArrowRight className="inline-icon" />
          </div>
        </div>
      </Link>
    </article>
  );
}
