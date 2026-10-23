import { calculateSalePrice } from "@/lib/pricing";

export interface DemoRegion {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent: string;
  sortOrder: number;
}

export interface DemoDestination {
  id: string;
  regionId: string;
  slug: string;
  countryCode: string;
  name: string;
  summary: string;
  description: string;
  popular: boolean;
}

export interface DemoPlan {
  id: string;
  destinationId: string;
  slug: string;
  name: string;
  supplierKey: string;
  supplierProductId: string;
  dataMb: number;
  validityDays: number;
  costMinor: number;
  markupBps: number;
  priceMinor: number;
  currency: string;
  taxBps: number;
  coverageSummary: string;
  networkSummary: string;
  description: string;
  features: string[];
  status: string;
  isDemo: boolean;
}

export const demoRegions: DemoRegion[] = [
  {
    id: "region-europe",
    slug: "europe",
    name: "Europe",
    description: "City breaks, rail trips, and multi-country holidays across Europe.",
    accent: "teal",
    sortOrder: 10,
  },
  {
    id: "region-north-america",
    slug: "north-america",
    name: "North America",
    description: "Road trips and city stays across the United States, Canada, and Mexico.",
    accent: "blue",
    sortOrder: 20,
  },
  {
    id: "region-asia",
    slug: "asia",
    name: "Asia",
    description: "Short hops and longer stays across East and Southeast Asia.",
    accent: "coral",
    sortOrder: 30,
  },
  {
    id: "region-oceania",
    slug: "oceania",
    name: "Oceania",
    description: "Connectivity for Australia, New Zealand, and island stops.",
    accent: "gold",
    sortOrder: 40,
  },
  {
    id: "region-middle-east",
    slug: "middle-east",
    name: "Middle East",
    description: "Layovers, city breaks, and regional travel in the Middle East.",
    accent: "violet",
    sortOrder: 50,
  },
  {
    id: "region-africa",
    slug: "africa",
    name: "Africa",
    description: "Connectivity for selected African destinations.",
    accent: "orange",
    sortOrder: 60,
  },
  {
    id: "region-south-america",
    slug: "south-america",
    name: "South America",
    description: "City stays and longer trips across South America.",
    accent: "green",
    sortOrder: 70,
  },
  {
    id: "region-global",
    slug: "global",
    name: "Global",
    description: "One demo plan for multi-region trips. Real global coverage requires supplier verification.",
    accent: "slate",
    sortOrder: 80,
  },
];

interface DestinationSeed {
  slug: string;
  countryCode: string;
  name: string;
  regionId: string;
  popular?: boolean;
}

const destinationSeeds: DestinationSeed[] = [
  { slug: "france", countryCode: "FR", name: "France", regionId: "region-europe", popular: true },
  { slug: "spain", countryCode: "ES", name: "Spain", regionId: "region-europe", popular: true },
  { slug: "italy", countryCode: "IT", name: "Italy", regionId: "region-europe", popular: true },
  { slug: "portugal", countryCode: "PT", name: "Portugal", regionId: "region-europe" },
  { slug: "germany", countryCode: "DE", name: "Germany", regionId: "region-europe" },
  { slug: "netherlands", countryCode: "NL", name: "Netherlands", regionId: "region-europe" },
  { slug: "greece", countryCode: "GR", name: "Greece", regionId: "region-europe" },
  { slug: "united-kingdom", countryCode: "GB", name: "United Kingdom", regionId: "region-europe", popular: true },
  { slug: "switzerland", countryCode: "CH", name: "Switzerland", regionId: "region-europe" },
  { slug: "iceland", countryCode: "IS", name: "Iceland", regionId: "region-europe" },
  { slug: "croatia", countryCode: "HR", name: "Croatia", regionId: "region-europe" },
  { slug: "turkey", countryCode: "TR", name: "Türkiye", regionId: "region-europe" },
  { slug: "united-states", countryCode: "US", name: "United States", regionId: "region-north-america", popular: true },
  { slug: "canada", countryCode: "CA", name: "Canada", regionId: "region-north-america" },
  { slug: "mexico", countryCode: "MX", name: "Mexico", regionId: "region-north-america" },
  { slug: "costa-rica", countryCode: "CR", name: "Costa Rica", regionId: "region-north-america" },
  { slug: "japan", countryCode: "JP", name: "Japan", regionId: "region-asia", popular: true },
  { slug: "south-korea", countryCode: "KR", name: "South Korea", regionId: "region-asia" },
  { slug: "thailand", countryCode: "TH", name: "Thailand", regionId: "region-asia", popular: true },
  { slug: "vietnam", countryCode: "VN", name: "Vietnam", regionId: "region-asia" },
  { slug: "singapore", countryCode: "SG", name: "Singapore", regionId: "region-asia" },
  { slug: "australia", countryCode: "AU", name: "Australia", regionId: "region-oceania", popular: true },
  { slug: "new-zealand", countryCode: "NZ", name: "New Zealand", regionId: "region-oceania" },
  { slug: "united-arab-emirates", countryCode: "AE", name: "United Arab Emirates", regionId: "region-middle-east" },
  { slug: "qatar", countryCode: "QA", name: "Qatar", regionId: "region-middle-east" },
  { slug: "south-africa", countryCode: "ZA", name: "South Africa", regionId: "region-africa" },
  { slug: "morocco", countryCode: "MA", name: "Morocco", regionId: "region-africa" },
  { slug: "egypt", countryCode: "EG", name: "Egypt", regionId: "region-africa" },
  { slug: "brazil", countryCode: "BR", name: "Brazil", regionId: "region-south-america" },
  { slug: "argentina", countryCode: "AR", name: "Argentina", regionId: "region-south-america" },
  { slug: "colombia", countryCode: "CO", name: "Colombia", regionId: "region-south-america" },
  { slug: "peru", countryCode: "PE", name: "Peru", regionId: "region-south-america" },
  { slug: "global", countryCode: "WW", name: "Worldwide", regionId: "region-global" },
];

const regionMultipliers: Record<string, number> = {
  "region-europe": 1,
  "region-north-america": 1.1,
  "region-asia": 0.9,
  "region-oceania": 1.3,
  "region-middle-east": 1.2,
  "region-africa": 1.4,
  "region-south-america": 1.2,
  "region-global": 2.2,
};

const planTemplates = [
  { dataMb: 1000, validityDays: 7, costMinor: 250, markupBps: 9000 },
  { dataMb: 5000, validityDays: 15, costMinor: 750, markupBps: 10000 },
  { dataMb: 10000, validityDays: 30, costMinor: 1200, markupBps: 10000 },
];

export const demoDestinations: DemoDestination[] = destinationSeeds.map((seed) => ({
  id: `dest-${seed.slug}`,
  regionId: seed.regionId,
  slug: seed.slug,
  countryCode: seed.countryCode,
  name: seed.name,
  summary: `Demo eSIM plans for ${seed.name}. Coverage and network details are illustrative only.`,
  description: `This is a clearly labelled demo destination page for ${seed.name}. It shows how destination, search, filter, and plan pages work. Real coverage, speed, network, and fair-use terms must come from an approved supplier and legal review before launch.`,
  popular: Boolean(seed.popular),
}));

function planName(dataMb: number, validityDays: number): string {
  const data = dataMb >= 1000 ? `${dataMb / 1000} GB` : `${dataMb} MB`;
  return `${data} · ${validityDays} days`;
}

export const demoPlans: DemoPlan[] = demoDestinations.flatMap((destination) => {
  const multiplier = regionMultipliers[destination.regionId] ?? 1;
  return planTemplates.map((template) => {
    const costMinor = Math.round(template.costMinor * multiplier);
    return {
      id: `plan-${destination.slug}-${template.dataMb}-${template.validityDays}`,
      destinationId: destination.id,
      slug: `${destination.slug}-${template.dataMb}mb-${template.validityDays}d`,
      name: planName(template.dataMb, template.validityDays),
      supplierKey: "mock",
      supplierProductId: `mock-${destination.countryCode.toLowerCase()}-${template.dataMb}-${template.validityDays}`,
      dataMb: template.dataMb,
      validityDays: template.validityDays,
      costMinor,
      markupBps: template.markupBps,
      priceMinor: calculateSalePrice(costMinor, template.markupBps),
      currency: "USD",
      taxBps: 0,
      coverageSummary: `${destination.name} · demo coverage`,
      networkSummary: "Demo network · no live carrier connection",
      description: `Illustrative demo plan for ${destination.name}. This is not a real supplier offer, price, coverage promise, or speed claim.`,
      features: [
        "Demo catalogue",
        "Data-only plan",
        "QR or manual activation",
        "Install before travel",
      ],
      status: "published",
      isDemo: true,
    };
  });
});

export const demoCatalogSummary = {
  regions: demoRegions.length,
  destinations: demoDestinations.length,
  plans: demoPlans.length,
  label: "DEMO CATALOGUE — NOT REAL SUPPLIER DATA",
};
