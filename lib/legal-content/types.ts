/**
 * Structured, translatable legal documents.
 *
 * Each language file returns the same documents with the same section ids, so
 * the legal meaning stays aligned across English, French, Spanish and Arabic.
 *
 * Inline markup inside strings (rendered by components/legal-content.tsx):
 *   [label](/legal/refunds)   internal link (localised automatically)
 *   [label](https://...)      external link
 *   **bold**
 *   {email}                   the public contact address
 */
export type LegalBlock =
  | string
  | { h3: string }
  | { ul: string[] }
  | { ol: string[] }
  | { callout: string }
  | { table: { caption: string; head: string[]; rows: string[][] } };

export interface LegalSection {
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  title: string;
  /** One-sentence summary used for metadata and the legal index. */
  description: string;
  intro: string;
  sections: LegalSection[];
}

export const LEGAL_DOC_KEYS = [
  "terms",
  "esim",
  "payments",
  "refunds",
  "privacy",
  "cookies",
  "notice",
  "accessibility",
] as const;
export type LegalDocKey = (typeof LEGAL_DOC_KEYS)[number];

export const LEGAL_DOC_PATHS: Record<LegalDocKey, string> = {
  terms: "/legal/terms",
  esim: "/legal/esim-service",
  payments: "/legal/payments",
  refunds: "/legal/refunds",
  privacy: "/legal/privacy",
  cookies: "/legal/cookies",
  notice: "/legal/notice",
  accessibility: "/legal/accessibility",
};

export interface LegalContext {
  email: string;
  /** Whether Google Analytics 4 is configured (cookie policy wording). */
  ga4Configured: boolean;
}

/** Localised labels for the shared seller-information block. */
export interface LegalProfileText {
  heading: string;
  rows: Array<[label: string, value: string]>;
  note: string;
  translationNote: string;
}

export interface LegalLanguagePack {
  docs: Record<LegalDocKey, (ctx: LegalContext) => LegalDoc>;
  profile: (ctx: LegalContext) => LegalProfileText;
}
