import { SearchIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";

export async function SearchForm({
  defaultValue = "",
  action = "/search",
  label,
}: {
  defaultValue?: string;
  action?: string;
  label?: string;
}) {
  const { t, href } = await getI18n();
  return (
    <form
      className="search-form"
      action={href(action)}
      method="get"
      role="search"
      data-analytics-search
    >
      <label className="visually-hidden" htmlFor="site-search">
        {label ?? t("home.hero.searchLabel")}
      </label>
      <SearchIcon className="search-icon" />
      <input
        id="site-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={t("catalog.filterDestinationOrPlan")}
        autoComplete="off"
      />
      <button className="button" type="submit">
        {t("common.search")}
      </button>
    </form>
  );
}
