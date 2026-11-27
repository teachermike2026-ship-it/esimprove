/**
 * Country-flag logic shared by every page that shows a destination or plan.
 *
 * Flags are derived only from catalog data:
 * - a single-country destination's ISO 3166-1 alpha-2 `countryCode`
 *   (for example "JP"), never from a package or destination name;
 * - for multi-country packages, the ISO codes the supplier lists in
 *   `plans.supplier_metadata.countries`.
 * Multi-country destinations carry a group code such as "EU-42" or "GL-139";
 * "GL-" codes are global packages and get a globe, not a country flag.
 *
 * Flag artwork: public/flags/*.svg from flag-icons (MIT, see
 * public/flags/LICENSE-flag-icons.txt). FLAG_CODES lists the files present.
 */

export const FLAG_CODES: ReadonlySet<string> = new Set(["AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ","BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ","CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CP","CR","CU","CV","CW","CX","CY","CZ","DE","DG","DJ","DK","DM","DO","DZ","EC","EE","EG","EH","ER","ES","ET","EU","FI","FJ","FK","FM","FO","FR","GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY","HK","HM","HN","HR","HT","HU","IC","ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT","JE","JM","JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ","NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ","OM","PA","PC","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY","QA","RE","RO","RS","RU","RW","SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ","TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA","UG","UM","UN","US","UY","UZ","VA","VC","VE","VG","VI","VN","VU","WF","WS","XK","XX","YE","YT","ZA","ZM","ZW"]);

const ISO_ALPHA2 = /^[A-Z]{2}$/;

/** True for an ISO 3166-1 alpha-2 code (a single-country destination). */
export function isCountryCode(code: string): boolean {
  return ISO_ALPHA2.test(code.trim().toUpperCase());
}

/** True for the supplier's global package group codes ("GL-120", "GL-139"). */
export function isGlobalCode(code: string): boolean {
  return /^GL-/i.test(code.trim());
}

export function hasFlag(code: string): boolean {
  return FLAG_CODES.has(code.trim().toUpperCase());
}

export function flagSrc(code: string): string {
  return `/flags/${code.trim().toLowerCase()}.svg`;
}

/** Normalises a supplier country list: uppercase ISO codes, de-duplicated, order kept. */
export function normalizeCoverage(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const code = item.trim().toUpperCase();
    if (ISO_ALPHA2.test(code)) seen.add(code);
  }
  return [...seen];
}

export type FlagScope =
  | { kind: "country"; code: string }
  | { kind: "region"; codes: string[] }
  | { kind: "global"; count: number };

/**
 * How a destination or plan should be flagged.
 * `coverage` is only consulted for multi-country destinations.
 */
export function flagScope(countryCode: string, coverage: readonly string[] = []): FlagScope {
  const code = countryCode.trim().toUpperCase();
  if (ISO_ALPHA2.test(code)) return { kind: "country", code };
  if (isGlobalCode(code)) return { kind: "global", count: coverage.length };
  return { kind: "region", codes: [...coverage] };
}

