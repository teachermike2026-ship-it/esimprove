import type { EditorialArticle } from "../types";

export const japanEsim: EditorialArticle = {
  slug: "japan-esim-travel-guide",
  title: "Japan eSIM: Complete Travel Guide (2026)",
  seoTitle: "Japan eSIM Guide 2026: Plans, Networks & Setup",
  description:
    "How a Japan eSIM works for visitors: networks, daily vs total-data plans, speed limits in plan names, setup before you fly, and how to pick the right plan.",
  excerpt:
    "Everything a visitor needs to get mobile data in Japan with an eSIM: which networks travel plans use, how to read daily and unlimited plans, and how to set it up before you land.",
  category: "destination-guides",
  primaryKeyword: "Japan eSIM guide",
  secondaryKeywords: ["Japan eSIM", "eSIM for Japan", "Japan travel eSIM", "best eSIM for Japan", "Japan data plan for tourists"],
  intent: "commercial investigation",
  publishedAt: "2026-11-26",
  updatedAt: "2026-11-26",
  art: { theme: "japan", alt: "Illustration of a rising sun over mountain ridges with a phone signal icon, representing mobile data in Japan" },
  quickAnswer:
    "A Japan eSIM is a prepaid, data-only plan you install on an unlocked, eSIM-capable phone before you fly. On arrival it connects to a Japanese partner network, so you can use maps, translation and messaging without renting a pocket Wi-Fi or buying a SIM card at the airport. Choose the plan by trip length and how heavily you use data, and check the plan page for the network, when validity starts and any speed limit.",
  featured: true,
  popular: true,
  destinations: ["japan"],
  related: ["how-much-data-do-i-need-travel", "how-to-install-esim-iphone-android", "esim-vs-physical-sim-vs-roaming"],
  body: [
    "Japan is one of the easiest countries in the world to travel around, but it is also a country where you lean on your phone constantly: train transfers, restaurant queues, translation apps, ticket QR codes and maps of stations that have a dozen exits. Getting mobile data sorted before you leave makes the first day far less stressful.",
    "This guide explains how a travel eSIM works in Japan, how it compares with the other options visitors use, how to read the different plan types (including daily and \"unlimited\" plans), and how to set everything up so it works the moment you land.",

    { h2: "What is a Japan eSIM?" },
    "An eSIM is a digital SIM profile stored on a chip inside your phone. A Japan eSIM is a prepaid data plan that you buy online, install by scanning a QR code (or entering the details manually), and switch on when you arrive. It connects to a Japanese mobile network as a roaming partner, so you do not need to visit a shop, show documents or swap a plastic card.",
    "Most travel eSIMs, including the plans sold on ESIMPROVE unless a plan page says otherwise, are **data only**. You get mobile internet, not a Japanese phone number. That suits most visitors: messaging, calls over apps, maps and bookings all run over data, while your usual SIM can stay in the phone for SMS codes from your bank.",
    { note: "Your phone must support eSIM and be carrier-unlocked. Check the exact model in our [device compatibility guide](/compatibility) before buying. If your phone turns out to be incompatible before you install the eSIM, you get a full refund under our [refund policy](/legal/refunds)." },

    { h2: "Which networks do Japan eSIMs use?" },
    "Japan has four nationwide mobile operators: NTT docomo, KDDI (au), SoftBank and Rakuten Mobile. Travel eSIMs do not create a new network; they use one or more of these as a partner. Which one a plan uses matters more in the countryside and the mountains than in central Tokyo or Osaka, where all of them are strong.",
    "The live summary below is generated from our current catalog, so the networks, prices and plan counts are always up to date:",
    { catalog: "japan" },
    "Each individual plan page lists its own network, whether 5G is available where the network offers it, and the exact rules for that plan. If you are heading to rural areas, hiking routes or small islands, it is worth choosing a plan on a network known for wide coverage there and checking the operator's own coverage map before you go.",

    { h2: "Daily plans, total-data plans and \"unlimited\" plans" },
    "Japan plans come in three broad shapes. Understanding the difference is the single most useful thing you can do before choosing.",
    { h3: "Total-data plans" },
    "A total-data plan gives one allowance (for example 5 GB) to use at any pace across the validity period (for example 30 days). It suits trips with uneven use: a few heavy days of navigation and photo uploads, and some quieter days on hotel Wi-Fi.",
    { h3: "Daily plans" },
    "A daily plan gives a fixed allowance per day, such as 1 GB or 2 GB, for a set number of days. When you use the day's allowance, the plan either slows down or pauses until the next day, as the plan page describes. Some plan names include a term such as **FUP1Mbps**, which indicates that after the fair-use allowance the speed is reduced (in that example, to about 1 Mbps) rather than cut off. Daily plans suit steady, predictable use.",
    { h3: "Unlimited plans and speed caps" },
    "Some Japan plans are sold as unlimited. Unlimited plans are still subject to fair use, and some are speed-capped: a name such as **Unlimited-10Mbps** indicates a maximum speed of around 10 Mbps for the whole plan. That is enough for maps, messaging and standard-quality video for most people, but not the same as an uncapped connection. Our site shows these plans as \"Unlimited\" rather than as a large number of gigabytes, and the plan page explains the limits that apply.",
    {
      table: {
        caption: "Which plan type suits which traveller",
        head: ["Plan type", "Best for", "Watch out for"],
        rows: [
          ["Total data", "Uneven use; trips with Wi-Fi at the hotel", "Running out early if you stream or hotspot"],
          ["Daily allowance", "Steady daily use; navigation-heavy itineraries", "Reduced speed after the daily allowance"],
          ["Unlimited (capped)", "Heavy users who want predictable cost", "Speed cap in the plan name; fair use"],
        ],
      },
    },

    { h2: "How much data do you need in Japan?" },
    "Japan is a data-hungry trip for most visitors because of how often you check transit routes and translate menus. A practical way to estimate is to look at your phone's mobile-data statistics for a normal week at home, then adjust for travel. Our guide [How much mobile data do you need when travelling?](/blog/how-much-data-do-i-need-travel) walks through the method step by step.",
    { ul: [
      "**Light use** (maps, messaging, email, occasional browsing): a small total-data plan or a low daily allowance usually works.",
      "**Moderate use** (all of the above plus social media and photo sharing): a mid-sized total plan or a 1–2 GB daily plan.",
      "**Heavy use** (video calls, streaming, hotspot for a laptop): a large total plan or an unlimited plan, checking any speed cap.",
    ] },
    { tip: "Download an offline map of the cities you are visiting on Wi-Fi before you leave. It saves data and keeps navigation working in underground stations where signal can drop." },

    { h2: "eSIM vs pocket Wi-Fi vs SIM card in Japan" },
    "Visitors to Japan traditionally rented a pocket Wi-Fi router at the airport. It is still a reasonable choice for a group sharing one connection, but it is another device to charge, carry and return. A travel eSIM lives inside your phone, so there is nothing to collect or return, and each traveller has their own connection.",
    "Physical prepaid data SIMs are also sold to visitors in Japan. They work well if your phone does not support eSIM, but you need to buy one on arrival and keep track of your home SIM card while it is out of the phone. Roaming with your home carrier is the simplest option of all but can be expensive, depending on your carrier's travel rates. For a neutral comparison of all three approaches, read [eSIM vs physical SIM vs roaming](/blog/esim-vs-physical-sim-vs-roaming).",

    { h2: "How to set up your Japan eSIM before you fly" },
    { ol: [
      "Check your phone is eSIM-capable and unlocked using the [compatibility guide](/compatibility).",
      "Choose a plan on the [Japan eSIM page](/destinations/japan) and complete your order. The QR code and manual installation details appear on your order page once payment is confirmed.",
      "At home, on a stable Wi-Fi connection, install the eSIM. Our step-by-step guide covers [installing an eSIM on iPhone and Android](/blog/how-to-install-esim-iphone-android).",
      "Label the new line (for example \"Japan\") so it is easy to find in settings.",
      "Leave the eSIM line switched off for data until you arrive if your plan's validity starts on installation or first connection. The plan page tells you which rule applies.",
      "When you land, set the Japan eSIM as your mobile data line and turn on data roaming for that line.",
    ] },
    "Turning on data roaming for the travel eSIM is normal: your phone sees the Japanese network as a roaming partner. To avoid charges from your home carrier, turn data roaming **off** for your home SIM.",

    { h2: "Tips for using mobile data in Japan" },
    { ul: [
      "**Keep your home SIM on for SMS.** Banks and booking sites may text you one-time codes. With dual SIM, you can receive SMS on your home line while the eSIM handles data, subject to your carrier's roaming rates for SMS.",
      "**Stop automatic background usage.** Turn off automatic app updates and cloud photo backup over mobile data.",
      "**Check hotspot rules first.** Whether you can share data with a laptop or another phone depends on the plan and network; check the plan page before relying on it.",
      "**Restart if the network does not register.** After landing, toggling airplane mode or restarting the phone usually makes it register on the partner network.",
    ] },

    { h2: "Multi-country trips: Japan with South Korea or China" },
    "If Japan is one stop on a longer trip, a multi-country plan can be simpler than buying one plan per country. The live list below shows our current plans that include Japan alongside other destinations:",
    { catalogGroup: { title: "Plans that include Japan and other countries", match: "japan.*&|&.*japan" } },
    "Compare the price per gigabyte against separate single-country plans, and check that the validity covers your whole trip.",

    { cta: { title: "Ready for Japan?", body: "Compare every Japan eSIM plan by data, validity and price. Each plan page shows the network, speed rules and when validity starts.", href: "/destinations/japan", label: "See Japan eSIM plans" } },
  ],
  faq: [
    { q: "Do I need a Japanese phone number with a travel eSIM?", a: "No. Travel eSIMs for Japan are usually data only. Messaging and calling apps work over the data connection, and your home SIM can stay active for SMS if your phone supports dual SIM." },
    { q: "Can I install a Japan eSIM before I travel?", a: "Yes, and it is the recommended approach. Install it at home on Wi-Fi, then switch it on for data when you arrive. Check the plan page to see whether validity starts on installation or on first connection in Japan." },
    { q: "Are unlimited Japan eSIM plans really unlimited?", a: "They are not capped by a gigabyte allowance, but fair use applies and some plans have a maximum speed shown in the plan name, such as 10 Mbps. Read the plan page before buying." },
    { q: "Which network is best in Japan?", a: "NTT docomo, KDDI (au), SoftBank and Rakuten Mobile all cover the main cities well. Differences show up in rural and mountain areas, so check the network listed on the plan page and the operator's coverage map for the places you will visit." },
    { q: "What if my phone is not compatible?", a: "Check the compatibility guide before buying. If your device turns out to be incompatible before you install the eSIM, you are entitled to a full refund under the refund policy." },
  ],
  references: [
    { label: "Set up eSIM on iPhone", publisher: "Apple Support", url: "https://support.apple.com/en-us/118669" },
    { label: "Set up a new eSIM (Pixel)", publisher: "Google Pixel Help", url: "https://support.google.com/pixelphone/answer/16115470?hl=en" },
    { label: "Download areas & navigate offline in Google Maps", publisher: "Google Maps Help", url: "https://support.google.com/maps/answer/6291838?hl=en" },
  ],
};
