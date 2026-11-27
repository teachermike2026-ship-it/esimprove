import type { EditorialArticle } from "../types";

export const turkeyEsim: EditorialArticle = {
  slug: "turkey-esim-data-plans",
  title: "Turkey eSIM: Data Plans, Coverage and Activation Guide",
  seoTitle: "Turkey eSIM Guide: Networks, Coverage & Activation",
  description:
    "Turkey eSIM guide for visitors: Turkcell, Vodafone and Türk Telekom coverage, plans for Istanbul and Cappadocia, activation steps, and IMEI rules to know.",
  excerpt:
    "Istanbul, Cappadocia, the Aegean and Mediterranean coasts: how a Turkey eSIM works, which networks travel plans use, how to activate it, and what visitors should know about Turkey's device rules.",
  category: "destination-guides",
  primaryKeyword: "Turkey eSIM guide",
  secondaryKeywords: ["Turkey eSIM", "eSIM for Turkey", "Türkiye eSIM", "Turkey travel eSIM", "Istanbul eSIM"],
  intent: "commercial investigation",
  publishedAt: "2026-11-26",
  updatedAt: "2026-11-26",
  art: { theme: "turkey", alt: "Illustration of hot-air balloons over rock formations with a signal arc, representing mobile data in Turkey" },
  quickAnswer:
    "A Turkey eSIM is a prepaid, data-only plan you install before you travel and switch on when you land in Türkiye. Travel plans use Turkish networks such as Turkcell, Vodafone and Türk Telekom, which cover Istanbul, the coasts and the main tourist regions. Turkey is often not included in EU-focused Europe plans, so check coverage carefully, then choose by trip length and data use.",
  destinations: ["turkey"],
  related: ["europe-esim-multiple-countries", "how-to-install-esim-iphone-android", "how-much-data-do-i-need-travel"],
  body: [
    "Türkiye (Turkey) combines big-city sightseeing in Istanbul, early-morning balloon flights in Cappadocia, and long stretches of Aegean and Mediterranean coast. Getting around involves ride-hailing, ferries, domestic flights and a lot of map checking, so mobile data is worth sorting before you go.",
    "This guide explains how a Turkey eSIM works, which networks travel plans use, how to activate it, why many Europe plans do not include Turkey, and what visitors should know about Turkey's device registration rules.",

    { h2: "How does a Turkey eSIM work?" },
    "A travel eSIM is a digital SIM profile stored on your phone. You buy a Turkey plan online, install it before you leave by scanning a QR code, and switch it on when you land. Your phone connects to a Turkish partner network and you have mobile data immediately.",
    "ESIMPROVE plans are data only unless the plan page says otherwise: no Turkish phone number, but full mobile internet for maps, messaging, ride-hailing and calls through apps.",

    { h2: "Which networks cover Turkey?" },
    "Turkey has three mobile operators: **Turkcell**, **Vodafone Türkiye** and **Türk Telekom** (formerly Avea, a name you may still see in network lists). All three cover Istanbul, Ankara, Izmir, Antalya and the main tourist regions. Coverage varies more in mountainous eastern regions and remote rural areas.",
    "The summary below is generated live from our catalog, so the plans, prices and networks are always current:",
    { catalog: "turkey" },

    { h2: "Is Turkey included in a Europe eSIM?" },
    "Often not. Many regional Europe plans focus on EU countries, and Turkey is not an EU member state. Some larger regional plans do include it, so the only reliable check is the coverage list on the plan page. If Turkey is the main destination of your trip, a Turkey-specific plan is usually the simpler and better-value choice. If you are combining Turkey with several European countries, our [Europe eSIM guide](/blog/europe-esim-multiple-countries) explains how to compare regional coverage.",

    { h2: "A note on Turkey's IMEI registration rules" },
    "Turkey requires mobile phones brought into the country to be registered (by their IMEI number) if they are used with a **Turkish-issued SIM card** beyond a limited period. These rules are aimed mainly at phones used long-term on local Turkish lines. Visitors on a short trip typically use their phone on a foreign line or travel eSIM, which works on Turkish networks as a roaming connection.",
    { note: "Rules can change, and they depend on how long you stay and what kind of SIM you use. If you plan a long stay or intend to buy a Turkish SIM card, check the current requirements with a Turkish operator or the Turkish telecoms regulator (BTK) before you travel." },

    { h2: "How much data do you need in Turkey?" },
    "Most accommodation in Turkish cities and resorts offers Wi-Fi, so mobile data is mainly for when you are out: navigation through Istanbul's neighbourhoods, ride-hailing, translating menus, and sharing photos from Cappadocia or the coast.",
    {
      table: {
        caption: "Matching a Turkey plan to your itinerary",
        head: ["Itinerary", "Typical use", "What to look for"],
        rows: [
          ["Istanbul city break", "Maps, transport, messaging", "Small or mid-sized total-data plan"],
          ["Istanbul + Cappadocia + coast", "Navigation, bookings, photo sharing", "Mid-sized plan covering every travel day"],
          ["Long stay or remote work", "Video calls, uploads", "Large plan; check hotspot rules on the plan page"],
        ],
      },
    },
    "For a method based on your own usage, read [How much mobile data do you need when travelling?](/blog/how-much-data-do-i-need-travel).",

    { h2: "How to activate a Turkey eSIM" },
    { ol: [
      "Check your phone supports eSIM and is carrier-unlocked in our [compatibility guide](/compatibility).",
      "Choose a plan on the [Turkey eSIM page](/destinations/turkey) and complete your order. Your QR code and manual details appear on your order page once payment is confirmed.",
      "Install the eSIM on Wi-Fi before you travel. Our [installation guide for iPhone and Android](/blog/how-to-install-esim-iphone-android) covers every step.",
      "When you land, set the Turkey eSIM as your mobile data line and turn on data roaming for that line.",
      "Turn data roaming off for your home SIM.",
      "If the phone does not connect within a few minutes, toggle airplane mode or restart it.",
    ] },
    { tip: "The plan page tells you whether validity starts when you install the eSIM or when it first connects in Turkey. If it starts on installation, install it close to your departure date." },

    { h2: "Practical tips for Turkey" },
    { ul: [
      "**Ferries:** Istanbul's Bosphorus ferries generally stay within coverage, but longer sea crossings can lose signal. Download tickets in advance.",
      "**Balloon flights and early starts:** pick-up times for Cappadocia tours are often confirmed by message the evening before, so make sure your messaging app works over the eSIM's data.",
      "**SMS codes:** keep your home SIM active on a dual-SIM phone for banking and app verification texts.",
      "**Offline maps:** useful for coastal drives and rural areas with weaker coverage.",
    ] },


    { h2: "Coverage notes by region" },
    { h3: "Istanbul" },
    "Istanbul is densely covered on both the European and Asian sides. You will mostly use data for navigation through the old city, ride-hailing, transport apps and ferry times.",
    { h3: "Cappadocia" },
    "Towns such as Göreme, Ürgüp and Uçhisar are covered. In valleys and on hikes between rock formations, signal can be weaker, so download offline maps before setting out.",
    { h3: "Aegean coast" },
    "Izmir, Kuşadası and Bodrum, and visits to sites such as Ephesus, are generally well covered. Boat trips along the coast can lose signal for periods.",
    { h3: "Mediterranean coast" },
    "Antalya, Kemer, Fethiye and Kaş are covered in town. Coastal hiking routes and secluded bays can have patchy signal.",
    { h3: "Eastern Türkiye" },
    "Cities are covered, but mountainous and rural areas in the east have more variable coverage than the west. Plan offline maps and accommodation details in advance.",

    { h2: "Common mistakes to avoid" },
    { ul: [
      "**Assuming a Europe plan includes Turkey.** Check the coverage list on the plan page.",
      "**Leaving data roaming on for your home SIM.** Turn it off so only the travel eSIM uses data.",
      "**Choosing a plan that ends too early.** Count every day you need data, including your departure day.",
      "**Deleting the eSIM to fix a connection problem.** Restart or toggle airplane mode first; most eSIM QR codes cannot be reused.",
    ] },

    { cta: { title: "Get connected in Türkiye", body: "Compare every Turkey eSIM plan by data, validity and price, and install it before you fly.", href: "/destinations/turkey", label: "See Turkey eSIM plans" } },
  ],
  faq: [
    { q: "Which network is best in Turkey?", a: "Turkcell, Vodafone Türkiye and Türk Telekom all cover the major cities and tourist regions. Differences appear in remote and mountainous areas. Each plan page lists the network the plan uses." },
    { q: "Do I need to register my phone's IMEI to use a travel eSIM in Turkey?", a: "Turkey's IMEI registration rules apply mainly to phones used with Turkish-issued SIM cards beyond a limited period. Short-stay visitors usually connect through a foreign line or travel eSIM. If you will stay long or buy a Turkish SIM, check the current rules with an operator or the regulator." },
    { q: "Is Turkey covered by Europe eSIM plans?", a: "Sometimes. Many Europe plans cover only EU countries. Check the coverage list on the plan page, or choose a Turkey-specific plan." },
    { q: "Does a Turkey eSIM include a phone number?", a: "ESIMPROVE plans are data only unless the plan page says otherwise, so there is no Turkish number, calls or SMS." },
    { q: "Can I use my Turkey eSIM for WhatsApp?", a: "Yes. WhatsApp keeps working with your usual number while the eSIM provides the data connection." },
  ],
  references: [
    { label: "Set up eSIM on iPhone", publisher: "Apple Support", url: "https://support.apple.com/en-us/118669" },
    { label: "Set up a new eSIM (Pixel)", publisher: "Google Pixel Help", url: "https://support.google.com/pixelphone/answer/16115470?hl=en" },
    { label: "About using multiple phone numbers or accounts on WhatsApp", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/1068436057886812/" },
  ],
};
