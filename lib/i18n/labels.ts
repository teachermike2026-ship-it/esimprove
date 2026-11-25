import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  type SupportCategory,
  type SupportPriority,
} from "@/lib/support";
import type { Translator } from "./translate";

/** Localizes a support ticket category, falling back to the English label. */
export function supportCategoryLabel(t: Translator, category: SupportCategory | string): string {
  const key = `support.cat.${category}`;
  const translated = t(key);
  return translated === key
    ? (SUPPORT_CATEGORY_LABELS[category as SupportCategory] ?? String(category))
    : translated;
}

/** Localizes a support ticket priority, falling back to the English label. */
export function supportPriorityLabel(t: Translator, priority: SupportPriority | string): string {
  const key = `support.priority.${priority}`;
  const translated = t(key);
  return translated === key
    ? (SUPPORT_PRIORITY_LABELS[priority as SupportPriority] ?? String(priority))
    : translated;
}
