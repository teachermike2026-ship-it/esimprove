/**
 * Storefront region for each ISO 3166-1 alpha-2 code used by the eSIM Access
 * catalog, and for its multi-country location codes (EU-42, AS-12, GL-120…).
 * Region slugs match the existing `regions` table. Unknown codes fall back to
 * "global" rather than being guessed.
 */

const COUNTRY_REGIONS: Record<string, string[]> = {
  europe: [
    "AD", "AL", "AT", "AX", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES",
    "FI", "FO", "FR", "GB", "GG", "GI", "GL", "GR", "HR", "HU", "IE", "IM", "IS", "IT", "JE",
    "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS",
    "RU", "SE", "SI", "SK", "SM", "TR", "UA", "VA", "XK",
  ],
  "north-america": [
    "AG", "AI", "AW", "BB", "BL", "BM", "BQ", "BS", "BZ", "CA", "CR", "CW", "DM", "DO", "GD",
    "GP", "GT", "HN", "HT", "JM", "KN", "KY", "LC", "MF", "MQ", "MS", "MX", "NI", "PA", "PR",
    "SV", "TC", "TT", "US", "VC", "VG", "VI",
  ],
  "south-america": ["AR", "BO", "BR", "CL", "CO", "EC", "GF", "GY", "PE", "PY", "SR", "UY", "VE"],
  asia: [
    "AF", "AM", "AZ", "BD", "BN", "BT", "CN", "GE", "HK", "ID", "IN", "JP", "KG", "KH", "KR",
    "KZ", "LA", "LK", "MM", "MN", "MO", "MV", "MY", "NP", "PH", "PK", "SG", "TH", "TJ", "TL",
    "TM", "TW", "UZ", "VN",
  ],
  "middle-east": ["AE", "BH", "IL", "IQ", "IR", "JO", "KW", "LB", "OM", "PS", "QA", "SA", "SY", "YE"],
  africa: [
    "AO", "BF", "BI", "BJ", "BW", "CD", "CF", "CG", "CI", "CM", "CV", "DJ", "DZ", "EG", "ER",
    "ET", "GA", "GH", "GM", "GN", "GQ", "GW", "KE", "KM", "LR", "LS", "LY", "MA", "MG", "ML",
    "MR", "MU", "MW", "MZ", "NA", "NE", "NG", "RE", "RW", "SC", "SD", "SL", "SN", "SO", "SS",
    "ST", "SZ", "TD", "TG", "TN", "TZ", "UG", "YT", "ZA", "ZM", "ZW",
  ],
  oceania: ["AS", "AU", "CK", "FJ", "FM", "GU", "KI", "MH", "MP", "NC", "NR", "NZ", "PF", "PG", "PW", "SB", "TO", "TV", "VU", "WS"],
};

const REGION_BY_COUNTRY = new Map<string, string>();
for (const [region, codes] of Object.entries(COUNTRY_REGIONS)) {
  for (const code of codes) REGION_BY_COUNTRY.set(code, region);
}

export function regionSlugForCountry(code: string): string {
  return REGION_BY_COUNTRY.get(code.toUpperCase()) ?? "global";
}

/** Region for a multi-country location code such as "EU-42" or "SGMYTH-3". */
export function regionSlugForMultiCode(locationCode: string, countries: string[]): string {
  const prefix = locationCode.split("-")[0]!.toUpperCase();
  const byPrefix: Record<string, string> = {
    EU: "europe",
    BI: "europe",
    IESI: "europe",
    NA: "north-america",
    USCA: "north-america",
    CB: "north-america",
    SA: "south-america",
    AF: "africa",
    ME: "middle-east",
    AS: "asia",
    SEA: "asia",
    SAS: "asia",
    CA: "asia",
    CN: "asia",
    CNHK: "asia",
    JPKR: "asia",
    CNJPKR: "asia",
    SGMY: "asia",
    SGMYTH: "asia",
    SGMYVNTHID: "asia",
    OCE: "oceania",
    AUNZ: "oceania",
    GL: "global",
  };
  if (byPrefix[prefix]) return byPrefix[prefix]!;
  // Otherwise: the single region all covered countries share, else global.
  const regionsCovered = new Set(countries.map(regionSlugForCountry));
  return regionsCovered.size === 1 ? [...regionsCovered][0]! : "global";
}
