import type { EditorialArticle } from "../types";

export const vietnamEsim: EditorialArticle = {
  slug: "vietnam-esim-plans-coverage",
  title: "Vietnam eSIM: Plans, Coverage and Travel Tips",
  seoTitle: "Vietnam eSIM Guide: Networks, Coverage & Travel Tips",
  description:
    "Get online in Vietnam with an eSIM: Viettel, Vinaphone and MobiFone coverage, choosing data for cities vs the north and Mekong, setup steps and practical tips.",
  excerpt:
    "From Hanoi and Ha Long Bay to Hoi An, Ho Chi Minh City and the Mekong Delta: how a Vietnam eSIM works, which networks it uses, and how to choose the right plan for your route.",
  category: "destination-guides",
  primaryKeyword: "Vietnam eSIM guide",
  secondaryKeywords: ["Vietnam eSIM", "eSIM for Vietnam", "Vietnam travel eSIM", "Vietnam data plan tourist", "Viettel eSIM"],
  intent: "commercial investigation",
  publishedAt: "2026-11-26",
  updatedAt: "2026-11-26",
  art: { theme: "vietnam", alt: "Illustration of limestone karsts rising from water with a signal arc, representing mobile data in Vietnam" },
  quickAnswer:
    "A Vietnam eSIM is a prepaid data plan you install before you travel and switch on when you land, with no SIM card to buy at the airport. Travel plans use Vietnam's main networks (Viettel, Vinaphone and MobiFone), which cover the cities and main tourist routes well. Choose by trip length and data use, and check the plan page for the network and when validity starts.",
  popular: true,
  destinations: ["vietnam"],
  related: ["thailand-esim-travel-guide", "how-much-data-do-i-need-travel", "whatsapp-with-esim-keep-number"],
  body: [
    "Vietnam is a long, narrow country, and most itineraries cover a lot of ground: Hanoi and the north, the central coast around Da Nang and Hoi An, and Ho Chi Minh City and the Mekong Delta in the south. Along the way you will book buses and sleeper trains, order ride-hailing cars, translate menus and share a lot of photos. Reliable mobile data makes all of that easier.",
    "This guide covers how a Vietnam eSIM works, which networks travel plans use, how to choose the right amount of data, and the practical details that catch visitors out.",

    { h2: "How does a Vietnam eSIM work?" },
    "A travel eSIM is a digital SIM profile. You buy a Vietnam plan online, install it on your phone by scanning a QR code before you leave, and switch it on when you arrive. Your phone then connects to a Vietnamese partner network. You do not need to queue at an airport kiosk or hand over your passport to register a local SIM card.",
    "ESIMPROVE plans are data only unless a plan page says otherwise: you get mobile internet but not a Vietnamese phone number. Zalo, WhatsApp, Grab and other apps work over the data connection.",
    { note: "You need an eSIM-capable phone that is carrier-unlocked. Check your exact model in the [compatibility guide](/compatibility) before buying." },

    { h2: "Which networks cover Vietnam?" },
    "Vietnam's three largest mobile operators are **Viettel**, **Vinaphone** and **MobiFone**. All three cover the major cities and the main tourist routes. Coverage becomes more variable in remote mountain areas in the far north, such as the Ha Giang loop, and in some rural and island areas, so the network your plan uses is worth checking if you are heading off the main routes.",
    "The summary below is generated live from our catalog, so prices, networks and plan counts are always current:",
    { catalog: "vietnam" },

    { h2: "How much data do you need in Vietnam?" },
    "Many hotels, cafés and restaurants in Vietnam offer free Wi-Fi, which reduces how much mobile data you need. Where you will rely on mobile data is on the move: ride-hailing, navigation, translation, and checking bus or train times. Use these profiles as a starting point:",
    {
      table: {
        caption: "Matching a Vietnam plan to your travel style",
        head: ["Travel style", "Typical use", "What to look for"],
        rows: [
          ["City break (Hanoi or Saigon)", "Ride-hailing, maps, messaging", "Small total-data plan for the trip length"],
          ["North-to-south route", "Navigation, bookings, photos", "Mid-sized total plan or a daily plan covering every day"],
          ["Remote work or heavy use", "Video calls, uploads, hotspot", "Large total plan; check hotspot rules on the plan page"],
        ],
      },
    },
    "For a more precise estimate based on your own phone's usage, see [How much mobile data do you need when travelling?](/blog/how-much-data-do-i-need-travel).",

    { h2: "Setting up your Vietnam eSIM" },
    { ol: [
      "Confirm your phone supports eSIM and is unlocked.",
      "Choose a plan on the [Vietnam eSIM page](/destinations/vietnam) and complete your order. The QR code and manual details appear on your order page once payment is confirmed.",
      "Install the eSIM at home on Wi-Fi. Our [installation guide for iPhone and Android](/blog/how-to-install-esim-iphone-android) shows every step.",
      "When you land, select the Vietnam eSIM for mobile data and turn on data roaming for that line.",
      "Turn data roaming off for your home SIM so your home carrier does not charge you.",
    ] },
    { tip: "Check on the plan page whether validity starts when you install the eSIM or when it first connects in Vietnam. If it starts on installation, install it close to your departure date." },

    { h2: "Practical tips for staying connected in Vietnam" },
    { ul: [
      "**Ride-hailing apps** such as Grab rely on mobile data to match you with drivers and show your route. Set them up and add a payment method before you travel.",
      "**Keep your home SIM active for SMS.** Banks and apps often send verification codes by text. With a dual-SIM phone, your home line can receive them while the eSIM handles data.",
      "**Download offline maps** for the cities and regions you will visit. They help on night buses and in areas with weaker signal.",
      "**Weather and coverage:** heavy rain can affect coverage in some areas. If you lose signal, toggle airplane mode once you are somewhere more open.",
      "**Messaging apps:** WhatsApp keeps working with your normal number while the eSIM provides data. Our guide to [keeping your WhatsApp number with an eSIM](/blog/whatsapp-with-esim-keep-number) explains why.",
    ] },

    { h2: "Travelling on from Vietnam" },
    "Many trips combine Vietnam with Cambodia, Laos or Thailand. If you are crossing borders, compare a multi-country Asia plan against separate single-country plans. The live list below shows current plans that include Vietnam together with other countries:",
    { catalogGroup: { title: "Multi-country plans that include Vietnam", match: "vietnam.*&|&.*vietnam" } },
    "If you are continuing to Thailand, our [Thailand eSIM guide](/blog/thailand-esim-travel-guide) covers the networks and plan choices there. You can also browse every destination in the [Asia region](/regions/asia).",


    { h2: "Planning connectivity along a typical route" },
    "Coverage expectations differ along the length of the country. These notes help you decide how much to rely on mobile data in each area and what to prepare in advance.",
    { h3: "Hanoi, Ninh Binh and Ha Long Bay" },
    "Hanoi and Ninh Binh are well covered. On Ha Long Bay and Lan Ha Bay cruises, signal depends on where the boat is anchored and can be intermittent among the karsts, so download boarding passes, tickets and anything you need for the next leg before you board.",
    { h3: "Sapa and the Ha Giang loop" },
    "Towns in the northern mountains have coverage, but stretches of mountain road can have weak or no signal. If you ride the Ha Giang loop, download offline maps of the whole route, share your itinerary with someone, and do not count on a connection between villages.",
    { h3: "Hue, Da Nang and Hoi An" },
    "The central coast cities are well connected. Cave systems in Phong Nha have no signal inside, which is normal underground anywhere.",
    { h3: "Ho Chi Minh City and the Mekong Delta" },
    "Ho Chi Minh City is densely covered. In the Mekong Delta, the main towns are covered, while boat trips along smaller channels may lose signal for short periods.",

    { h2: "Common mistakes to avoid" },
    { ul: [
      "**Deleting the eSIM to fix a connection problem.** Most eSIM QR codes can only be used once. Toggle airplane mode or restart the phone instead, and contact support if it still does not work.",
      "**Leaving data roaming on for your home SIM.** Your phone may use your home line for data in the background. Turn data roaming off on the home line.",
      "**Choosing a plan that ends before your flight home.** Count the days you will need data, including the airport transfer on your last day.",
      "**Installing too early on a plan whose validity starts on installation.** Check the rule on the plan page before installing weeks ahead.",
    ] },

    { cta: { title: "Get connected in Vietnam", body: "Compare every Vietnam eSIM plan by data, validity and price, and install it before you fly.", href: "/destinations/vietnam", label: "See Vietnam eSIM plans" } },
  ],
  faq: [
    { q: "Do I need to register a Vietnam eSIM with my passport?", a: "Travel eSIMs bought online from ESIMPROVE do not require you to register a passport at a shop in Vietnam. Buying a local Vietnamese SIM card in person typically involves subscriber registration with identification." },
    { q: "Which network is best in Vietnam?", a: "Viettel, Vinaphone and MobiFone all cover the main cities and tourist routes. Differences appear in remote mountain, rural and island areas. Each plan page lists the network it uses." },
    { q: "Will Grab work with a data-only eSIM?", a: "Yes. Grab and similar apps work over mobile data. Some apps may send an SMS code to your registered number, which your home SIM can still receive if it stays active on a dual-SIM phone." },
    { q: "Can I use one eSIM for Vietnam, Cambodia and Thailand?", a: "Only if the plan's coverage list includes all three countries. Check the multi-country plans and compare them with separate single-country plans." },
    { q: "When should I install my Vietnam eSIM?", a: "Install it before you travel, on a stable Wi-Fi connection. If the plan's validity starts on installation, install it close to your departure date." },
  ],
  references: [
    { label: "Set up eSIM on iPhone", publisher: "Apple Support", url: "https://support.apple.com/en-us/118669" },
    { label: "How to use an eSIM with your Galaxy phone", publisher: "Samsung Support", url: "https://www.samsung.com/ie/support/mobile-devices/how-to-use-an-esim-with-your-galaxy-phone/" },
    { label: "Download areas & navigate offline in Google Maps", publisher: "Google Maps Help", url: "https://support.google.com/maps/answer/6291838?hl=en" },
  ],
};
