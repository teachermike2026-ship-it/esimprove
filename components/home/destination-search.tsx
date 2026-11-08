import { SearchIcon } from "@/components/icons";

export function DestinationSearch({
  id,
  suggestions,
  size = "hero",
}: {
  id: string;
  suggestions: string[];
  size?: "hero" | "cta";
}) {
  const inputId = `${id}-input`;
  const listId = `${id}-suggestions`;

  return (
    <form
      className={`es-search es-search-${size}`}
      action="/search"
      method="get"
      role="search"
    >
      <label className="visually-hidden" htmlFor={inputId}>
        Search for a destination
      </label>
      <SearchIcon className="es-search-icon" />
      <input
        id={inputId}
        name="q"
        type="search"
        placeholder="Search for destination"
        autoComplete="off"
        list={listId}
      />
      <datalist id={listId}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
      <button className="es-search-button" type="submit" aria-label="Search">
        <SearchIcon />
        <span>Search</span>
      </button>
    </form>
  );
}
