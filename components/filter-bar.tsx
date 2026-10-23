import Link from "next/link";
import type { DestinationSummary, RegionSummary } from "@/lib/catalog";

export interface PlanFilterValues {
  q?: string;
  destination?: string;
  region?: string;
  maxPrice?: string;
  minDataMb?: string;
  minValidityDays?: string;
  sort?: string;
}

export function FilterBar({
  regions,
  destinations,
  values,
  action = "/plans",
}: {
  regions: RegionSummary[];
  destinations: DestinationSummary[];
  values: PlanFilterValues;
  action?: string;
}) {
  return (
    <form className="filter-bar card" action={action} method="get" aria-label="Filter demo plans">
      <div className="filter-grid">
        <div className="field">
          <label htmlFor="filter-q">Search</label>
          <input
            id="filter-q"
            name="q"
            type="search"
            defaultValue={values.q ?? ""}
            placeholder="Destination or plan"
          />
        </div>
        <div className="field">
          <label htmlFor="filter-region">Region</label>
          <select id="filter-region" name="region" defaultValue={values.region ?? ""}>
            <option value="">All regions</option>
            {regions.map((region) => (
              <option key={region.id} value={region.slug}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-destination">Destination</label>
          <select
            id="filter-destination"
            name="destination"
            defaultValue={values.destination ?? ""}
          >
            <option value="">All destinations</option>
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.slug}>
                {destination.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-data">Minimum data</label>
          <select id="filter-data" name="minDataMb" defaultValue={values.minDataMb ?? ""}>
            <option value="">Any data</option>
            <option value="1000">1 GB or more</option>
            <option value="5000">5 GB or more</option>
            <option value="10000">10 GB or more</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-validity">Minimum validity</label>
          <select
            id="filter-validity"
            name="minValidityDays"
            defaultValue={values.minValidityDays ?? ""}
          >
            <option value="">Any validity</option>
            <option value="7">7 days or more</option>
            <option value="15">15 days or more</option>
            <option value="30">30 days or more</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-price">Maximum price (USD)</label>
          <input
            id="filter-price"
            name="maxPrice"
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            defaultValue={values.maxPrice ?? ""}
            placeholder="e.g. 25"
          />
        </div>
        <div className="field">
          <label htmlFor="filter-sort">Sort</label>
          <select id="filter-sort" name="sort" defaultValue={values.sort ?? "price_asc"}>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="data_desc">Data: high to low</option>
            <option value="newest">Newest</option>
          </select>
        </div>
        <div className="filter-actions">
          <button className="button" type="submit">
            Apply filters
          </button>
          <Link className="button button-ghost" href={action}>
            Reset
          </Link>
        </div>
      </div>
      <p className="filter-note">
        Every plan shown is demo data. Filters and prices are functional locally, but no
        supplier price or coverage has been verified.
      </p>
    </form>
  );
}
