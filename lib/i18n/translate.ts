export type TranslationValues = Record<string, string | number>;

/**
 * Replaces `{placeholder}` tokens. Unknown placeholders are left untouched so a
 * missing value is visible in review rather than silently emptied.
 */
export function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

export interface Translator {
  (key: string, values?: TranslationValues): string;
}

export function createTranslator(dictionary: Record<string, string>, fallback?: Record<string, string>): Translator {
  return (key, values) => {
    const raw = dictionary[key] ?? fallback?.[key] ?? key;
    return interpolate(raw, values);
  };
}

/** Count helper for languages with simple singular/plural forms. */
export function plural(
  count: number,
  one: string,
  many: string,
  values?: TranslationValues,
): string {
  return interpolate(count === 1 ? one : many, { count, ...values });
}
