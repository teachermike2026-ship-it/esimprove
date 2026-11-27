import type { EditorialCategory } from "./types";

export const EDITORIAL_CATEGORIES: EditorialCategory[] = [
  {
    slug: "destination-guides",
    name: "Destination Guides",
    description:
      "Country and region guides: which networks travel eSIMs use there, how to choose a plan for your trip, and practical tips for arriving connected.",
  },
  {
    slug: "travel-esim-guides",
    name: "Travel eSIM Guides",
    description:
      "How travel eSIMs work, how they compare with roaming and local SIM cards, and what to check before you buy one.",
  },
  {
    slug: "esim-tips-tutorials",
    name: "eSIM Tips & Tutorials",
    description:
      "Step-by-step help for installing, activating and troubleshooting an eSIM on iPhone and Android.",
  },
  {
    slug: "connectivity-technology",
    name: "Connectivity & Technology",
    description:
      "Dual SIM, messaging apps, phone numbers and the technology behind staying online abroad, explained in plain language.",
  },
  {
    slug: "travel-data-planning",
    name: "Travel Data & Planning",
    description:
      "How much mobile data you really need, how to make it last, and how to match a plan's allowance and validity to your trip.",
  },
];

export function getEditorialCategory(slug: string): EditorialCategory | undefined {
  return EDITORIAL_CATEGORIES.find((category) => category.slug === slug);
}
