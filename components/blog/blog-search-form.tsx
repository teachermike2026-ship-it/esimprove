/** Plain GET form: works without JavaScript and is tracked by the analytics submit listener. */
export function BlogSearchForm({
  query,
  action,
  label,
  placeholder,
  submit,
}: {
  query: string;
  action: string;
  label: string;
  placeholder: string;
  submit: string;
}) {
  return (
    <form className="blog-search" role="search" action={action} method="get" data-analytics-search>
      <label htmlFor="blog-search-input" className="visually-hidden">
        {label}
      </label>
      <input
        id="blog-search-input"
        type="search"
        name="q"
        defaultValue={query}
        placeholder={placeholder}
        maxLength={100}
        autoComplete="off"
      />
      <button className="es-button es-button-primary" type="submit">
        {submit}
      </button>
    </form>
  );
}
