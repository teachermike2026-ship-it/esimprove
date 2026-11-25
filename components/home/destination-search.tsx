import { SearchIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";

export async function DestinationSearch({
  id,
  suggestions,
  size = "hero",
}: {
  id: string;
  suggestions: string[];
  size?: "hero" | "cta";
}) {
  const { t, href } = await getI18n();
  const inputId = `${id}-input`;
  const listId = `${id}-suggestions`;

  return (
    <form
      className={`es-search es-search-${size}`}
      action={href("/search")}
      method="get"
      role="search"
    >
      <label className="visually-hidden" htmlFor={inputId}>
        {t("home.hero.searchLabel")}
      </label>
      <SearchIcon className="es-search-icon" />
      <input
        id={inputId}
        name="q"
        type="search"
        placeholder={t("home.hero.searchPlaceholder")}
        autoComplete="off"
        list={listId}
      />
      <datalist id={listId}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
      <button className="es-search-button" type="submit" aria-label={t("common.search")}>
        <SearchIcon />
        <span>{t("common.search")}</span>
      </button>
    </form>
  );
}
