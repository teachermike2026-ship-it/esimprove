import { SearchIcon } from "@/components/icons";

export function SearchForm({
  defaultValue = "",
  action = "/search",
  label = "Search destinations or plans",
}: {
  defaultValue?: string;
  action?: string;
  label?: string;
}) {
  return (
    <form className="search-form" action={action} method="get" role="search" data-analytics-search>
      <label className="visually-hidden" htmlFor="site-search">
        {label}
      </label>
      <SearchIcon className="search-icon" />
      <input
        id="site-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Try Japan, Europe, or 5 GB"
        autoComplete="off"
      />
      <button className="button" type="submit">
        Search
      </button>
    </form>
  );
}
