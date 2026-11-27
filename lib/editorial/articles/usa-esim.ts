import type { EditorialArticle } from "../types";

export const usaEsim: EditorialArticle = {
  slug: "usa-esim-compare-data-plans",
  title: "USA eSIM: Compare Data Plans for Your Trip",
  seoTitle: "USA eSIM Guide: How to Compare Plans for Your Trip",
  description:
    "Compare USA eSIM data plans for visitors: AT&T, Verizon and T-Mobile coverage, road trips and national parks, USA & Canada plans, and how to choose and install.",
  excerpt:
    "The United States is huge, and coverage varies far more than in most countries. How to compare USA eSIM plans by network, data and validity, and what to know for road trips and national parks.",
  category: "destination-guides",
  primaryKeyword: "USA eSIM guide",
  secondaryKeywords: ["USA eSIM", "eSIM for USA", "US travel eSIM", "United States eSIM for tourists", "USA and Canada eSIM"],
  intent: "commercial investigation",
  publishedAt: "2026-11-26",
  updatedAt: "2026-11-26",
  art: { theme: "usa", alt: "Illustration of a highway running toward mountains under stars with a signal arc, representing mobile data on a US road trip" },
  quickAnswer:
    "A USA eSIM is a prepaid, data-only plan that connects to a US network (such as AT&T, Verizon or T-Mobile, depending on the plan) as soon as you land. It is usually simpler and more predictable than roaming. Because the US is so large, the network matters: cities are well covered, but road trips, mountains and national parks can have gaps. Compare plans by network, data and validity on the plan pages.",
  popular: true,
  destinations: ["united-states"],
  related: ["how-much-data-do-i-need-travel", "esim-vs-physical-sim-vs-roaming", "how-to-install-esim-iphone-android"],
  body: [
    "A trip to the United States often means long distances: a city break in New York, a road trip down the West Coast, or a loop of national parks. Mobile data keeps you on track with navigation, ride-hailing, restaurant bookings and ticket apps. A travel eSIM gives you that data without paying daily roaming fees or finding a phone shop after a long-haul flight.",
    "This guide explains how a USA eSIM works, how to compare plans, why the network matters more in the US than in smaller countries, and what to know if Canada is also on your route.",

    { h2: "How does a USA eSIM work?" },
    "A USA eSIM is a prepaid data plan delivered as a digital SIM profile. You buy it online, install it before you travel by scanning a QR code, and switch it on when you land. Your phone then connects to a US partner network.",
    "Plans on ESIMPROVE are data only unless a plan page says otherwise. You get mobile internet, not a US phone number. That covers maps, ride-hailing, messaging and calls through apps.",
    { note: "Your phone must support eSIM and be carrier-unlocked. Note that iPhone models sold in the United States since the iPhone 14 have no SIM tray at all, so travellers with those phones already rely on eSIM. Check your model in our [compatibility guide](/compatibility)." },

    { h2: "Which US networks do travel eSIMs use?" },
    "The three national mobile networks in the United States are **AT&T**, **Verizon** and **T-Mobile**. All three cover major cities and interstate highways. The differences show up in rural areas, mountains, deserts and national parks, where one network may have signal and another may not.",
    "The live summary below shows the networks, prices and plan count in our current catalog:",
    { catalog: "united-states" },
    "Each plan page lists the network that plan uses. For a road trip through remote areas, compare the plan's network with the operator's own coverage map along your route.",

    { h2: "How to compare USA eSIM plans" },
    "With dozens of plans to choose from, it helps to compare them in a fixed order:",
    { ol: [
      "**Validity first.** Pick plans whose validity covers every day of your trip. A plan that expires two days early is no use however cheap it is.",
      "**Data allowance second.** Estimate your use (see below) and add a margin for travel days.",
      "**Network third.** For cities, any national network works. For road trips and parks, check coverage for your route.",
      "**Price per gigabyte last.** Larger plans usually cost less per GB, but only if you will actually use the data.",
    ] },
    {
      table: {
        caption: "Matching a USA plan to the trip",
        head: ["Trip", "What matters most", "Plan to look for"],
        rows: [
          ["City break (e.g. New York, Chicago)", "Validity and allowance", "Small or mid-sized total-data plan"],
          ["West Coast or Route 66 road trip", "Network coverage on highways", "Mid-sized or large plan; check the network"],
          ["National parks", "Coverage in remote areas", "Download offline maps; check network maps"],
          ["Work trip with video calls", "Allowance and hotspot rules", "Large plan; confirm hotspot on the plan page"],
        ],
      },
    },

    { h2: "How much data do you need in the USA?" },
    "Navigation is the biggest everyday use on a US trip, especially on road trips, along with streaming music in the car. Video streaming and hotspot use for a laptop consume far more. Netflix, for example, states that standard-definition streaming can use up to about 1 GB per hour and HD up to about 3 GB per hour on its higher quality setting, so one evening of streaming over mobile data can use as much as a week of maps and messaging.",
    "For a personal estimate based on your own phone, see [How much mobile data do you need when travelling?](/blog/how-much-data-do-i-need-travel).",
    { tip: "Download offline maps of national parks and remote stretches before you set off. Google Maps lets you save areas for offline navigation, which keeps directions working when signal drops." },

    { h2: "Visiting Canada too?" },
    "Many trips cross the border into Canada, for example Seattle to Vancouver or New York to Niagara Falls and Toronto. A single-country US plan will not cover Canada. A combined USA & Canada plan keeps you connected on both sides. Current plans covering both countries are listed live below:",
    { catalogGroup: { title: "Plans covering the USA and Canada", match: "usa.*canada|canada.*usa|united states.*canada" } },
    "You can also browse every plan in the [North America region](/regions/north-america).",

    { h2: "Setting up your USA eSIM" },
    { ol: [
      "Check your phone supports eSIM and is unlocked.",
      "Choose a plan on the [USA eSIM page](/destinations/united-states) and complete your order.",
      "Install the eSIM on Wi-Fi before you fly. Follow our [installation guide for iPhone and Android](/blog/how-to-install-esim-iphone-android).",
      "When you land, set the eSIM as your mobile data line and turn on data roaming for it.",
      "Turn data roaming off on your home SIM to avoid your carrier's roaming charges.",
    ] },

    { h2: "Tips for using data in the United States" },
    { ul: [
      "**SMS verification:** US apps and banks may text a code to your registered number. Keep your home SIM active on a dual-SIM phone so codes still reach you, subject to your carrier's roaming rates for SMS.",
      "**Emergency calls:** a data-only plan has no voice service of its own. Keep your home SIM active so your phone has a voice line available, and do not rely on the data-only eSIM for calls of any kind.",
      "**Wi-Fi calling:** if your home carrier supports Wi-Fi calling abroad, you may be able to make calls over the eSIM's data; check with your carrier.",
      "**Hotspot:** check the plan page before using your phone as a hotspot for a laptop.",
    ] },


    { h2: "Road trip checklist" },
    "Road trips are where US connectivity planning pays off most. Before you set off on a long drive:",
    { ul: [
      "Download offline maps for the whole route, including the areas around national parks and desert stretches.",
      "Save hotel, car-rental and park reservation confirmations to your phone so they are available without signal.",
      "Check the plan's validity covers every day of the drive, including the day you return the car.",
      "Look at the plan's network on the operator's coverage map for the remote parts of your route.",
      "Keep a car charger or power bank: navigation and searching for signal both drain the battery.",
    ] },

    { h2: "Common mistakes to avoid" },
    { ul: [
      "**Assuming coverage is the same everywhere.** Cities are well covered, but mountains, deserts and parks have gaps on every network.",
      "**Streaming in the car on a small plan.** Download playlists and podcasts on Wi-Fi before driving.",
      "**Forgetting about Canada.** If your route crosses the border, choose a plan that covers both countries.",
      "**Deleting the eSIM to fix a problem.** Restart the phone or toggle airplane mode first; most eSIM QR codes cannot be reused.",
    ] },

    { cta: { title: "Find your USA plan", body: "Compare every USA eSIM plan by network, data, validity and price, then install it before you fly.", href: "/destinations/united-states", label: "See USA eSIM plans" } },
  ],
  faq: [
    { q: "Does a USA eSIM include a US phone number?", a: "Plans on ESIMPROVE are data only unless a plan page says otherwise, so they do not include a US phone number, calls or SMS. Calls and messages work through internet apps." },
    { q: "Which network is best for a US road trip?", a: "AT&T, Verizon and T-Mobile all cover cities and interstates. In rural areas and national parks coverage varies, so compare the network on the plan page with the operator's coverage map for your route." },
    { q: "Will a USA eSIM work in Canada?", a: "A USA-only plan does not cover Canada. Choose a plan whose coverage includes both countries if you will cross the border." },
    { q: "My US iPhone has no SIM tray. Can I use a travel eSIM?", a: "Yes, if the phone is carrier-unlocked. US iPhone models from the iPhone 14 onwards are eSIM only, so they support eSIM by design." },
    { q: "When should I install my USA eSIM?", a: "Install it on Wi-Fi before you travel. If the plan's validity starts on installation, install it close to departure; the plan page says which rule applies." },
  ],
  references: [
    { label: "Learn which type of SIM your iPhone uses", publisher: "Apple Support", url: "https://support.apple.com/en-us/118569" },
    { label: "How to control how much data Netflix uses", publisher: "Netflix Help Center", url: "https://help.netflix.com/en/node/87" },
    { label: "Download areas & navigate offline in Google Maps", publisher: "Google Maps Help", url: "https://support.google.com/maps/answer/6291838?hl=en" },
  ],
};
