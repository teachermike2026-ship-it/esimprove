import Link from "next/link";
import type { DestinationSummary, RegionSummary } from "@/lib/catalog";
import { getI18n } from "@/lib/i18n/server";

export interface PlanFilterValues {
  q?: string;
  destination?: string;
  region?: string;
  maxPrice?: string;
  minDataMb?: string;
  minValidityDays?: string;
  sort?: string;
}

export async function FilterBar({
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
  const { t, href } = await getI18n();

  return (
    <form
      className="filter-bar card"
      action={href(action)}
      method="get"
      aria-label={t("catalog.filterPlans")}
    >
      <div className="filter-grid">
        <div className="field">
          <label htmlFor="filter-q">{t("catalog.filterSearch")}</label>
          <input
            id="filter-q"
            name="q"
            type="search"
            defaultValue={values.q ?? ""}
            placeholder={t("catalog.filterDestinationOrPlan")}
          />
        </div>
        <div className="field">
          <label htmlFor="filter-region">{t("catalog.filterRegion")}</label>
          <select id="filter-region" name="region" defaultValue={values.region ?? ""}>
            <option value="">{t("catalog.allRegions")}</option>
            {regions.map((region) => (
              <option key={region.id} value={region.slug}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-destination">{t("catalog.filterDestination")}</label>
          <select
            id="filter-destination"
            name="destination"
            defaultValue={values.destination ?? ""}
          >
            <option value="">{t("catalog.filterAllDestinations")}</option>
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.slug}>
                {destination.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-data">{t("catalog.filterMinData")}</label>
          <select id="filter-data" name="minDataMb" defaultValue={values.minDataMb ?? ""}>
            <option value="">{t("catalog.filterAnyData")}</option>
            <option value="1000">{t("catalog.filterData1")}</option>
            <option value="5000">{t("catalog.filterData5")}</option>
            <option value="10000">{t("catalog.filterData10")}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-validity">{t("catalog.filterMinValidity")}</label>
          <select
            id="filter-validity"
            name="minValidityDays"
            defaultValue={values.minValidityDays ?? ""}
          >
            <option value="">{t("catalog.filterAnyValidity")}</option>
            <option value="7">{t("catalog.filterValidity7")}</option>
            <option value="15">{t("catalog.filterValidity15")}</option>
            <option value="30">{t("catalog.filterValidity30")}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-price">{t("catalog.filterMaxPrice")}</label>
          <input
            id="filter-price"
            name="maxPrice"
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            defaultValue={values.maxPrice ?? ""}
            placeholder={t("catalog.filterMaxPricePlaceholder")}
          />
        </div>
        <div className="field">
          <label htmlFor="filter-sort">{t("catalog.filterSort")}</label>
          <select id="filter-sort" name="sort" defaultValue={values.sort ?? "price_asc"}>
            <option value="price_asc">{t("catalog.sortPriceAsc")}</option>
            <option value="price_desc">{t("catalog.sortPriceDesc")}</option>
            <option value="data_desc">{t("catalog.sortDataDesc")}</option>
            <option value="newest">{t("catalog.sortNewest")}</option>
          </select>
        </div>
        <div className="filter-actions">
          <button className="button" type="submit">
            {t("catalog.filterApply")}
          </button>
          <Link className="button button-ghost" href={href(action)}>
            {t("catalog.filterReset")}
          </Link>
        </div>
      </div>
      <p className="filter-note">{t("catalog.filterNote")}</p>
    </form>
  );
}
