/**
 * ESIMPROVE business profile used by every customer-facing legal document.
 *
 * These values are the single source of truth for the legal pages. ESIMPROVE
 * is an online digital services platform and brand — not a registered company.
 * No registration number, VAT number, telephone number, or registered office
 * is held or claimed, and none should be invented here.
 *
 * If a detail cannot be verified, keep this profile neutral and do not add it.
 */

export const LEGAL_BRAND = "ESIMPROVE";

export const LEGAL_BUSINESS_TYPE = "Online digital services platform";

/**
 * Provisional operating location only. ESIMPROVE is not a company registered
 * in Vietnam or in any other country, and must not be presented as one.
 */
export const LEGAL_BUSINESS_COUNTRY = "Vietnam";

export const LEGAL_PHYSICAL_OFFICE =
  "No public physical office; ESIMPROVE operates online";

/** Single public contact address for contact, support, and privacy. */
export const LEGAL_CONTACT_EMAIL = "contact@esimprove.com";

/**
 * Proposed governing jurisdiction, expressed as a preliminary choice. ESIMPROVE
 * does not hold a registered legal entity and offers no election of law beyond
 * what mandatory consumer protection and privacy laws allow.
 */
export const LEGAL_JURISDICTION =
  "Vietnam, subject to the mandatory consumer protection and privacy laws applicable to customers in their countries";

/** Short inline description used in headers and business-details sections. */
export const LEGAL_PLATFORM_LINE =
  "ESIMPROVE — online digital services platform · Vietnam";

/**
 * 2.0 (2026-11-26): full rewrite in four languages; separate eSIM service,
 * payment and legal-notice documents; immediate-supply acknowledgement.
 * 2.1 (2026-11-27): Privacy/Cookie updates: Whop card form data (email and
 * billing details), Apple Pay / Google Pay, optional Google/Apple sign-in,
 * Resend email, guest-order and sign-in cookies. Set the effective date to
 * the actual deployment day before publishing.
 */
export const LEGAL_DOCUMENT_VERSION = "2.1";

export const LEGAL_EFFECTIVE_DATE = "2026-11-27";

/** Display form of LEGAL_EFFECTIVE_DATE. */
export const LEGAL_EFFECTIVE_DATE_LABEL = "27 November 2026";

export const LEGAL_NOT_A_REGISTERED_ENTITY =
  "ESIMPROVE is an online platform and brand. It is not a registered company and does not hold or claim a company registration number or VAT number.";
