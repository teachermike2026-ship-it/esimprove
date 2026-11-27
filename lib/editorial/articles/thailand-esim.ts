import type { EditorialArticle } from "../types";

export const thailandEsim: EditorialArticle = {
  slug: "thailand-esim-travel-guide",
  title: "Thailand eSIM: Everything Travelers Need to Know",
  seoTitle: "Thailand eSIM: What Travelers Need to Know",
  description:
    "Thailand eSIM explained: AIS and True networks, island and Bangkok coverage, daily vs total-data plans, setup before you land, and tips for staying connected.",
  excerpt:
    "Bangkok, Chiang Mai, the islands and beyond: how a Thailand eSIM works, which networks travel plans use, and how to pick a plan that fits beach days and big-city navigation alike.",
  category: "destination-guides",
  primaryKeyword: "Thailand eSIM guide",
  secondaryKeywords: ["Thailand eSIM", "eSIM for Thailand", "Thailand travel eSIM", "Thailand tourist data plan", "AIS eSIM"],
  intent: "commercial investigation",
  publishedAt: "2026-11-26",
  updatedAt: "2026-11-26",
  art: { theme: "thailand", alt: "Illustration of a temple roofline over a sea horizon with a signal arc, representing mobile data in Thailand" },
  quickAnswer:
    "A Thailand eSIM is a prepaid, data-only plan you install before you fly and switch on when you land, instead of buying a tourist SIM at the airport. Travel plans use Thailand's main networks, AIS and True (TrueMove H), which cover Bangkok, the main islands and tourist areas well. Choose by trip length and how much you use maps, ride-hailing and social media, and check the plan page for the network and validity rules.",
  popular: true,
  destinations: ["thailand"],
  related: ["vietnam-esim-plans-coverage", "how-much-data-do-i-need-travel", "how-to-install-esim-iphone-android"],
  body: [
    "Thailand is one of the world's most visited countries, and staying connected there is straightforward. The question for most travellers is not whether they can get online, but how to do it with the least hassle: queue for a tourist SIM at the airport, rely on roaming from home, or arrive with an eSIM that is already installed.",
    "This guide explains how a Thailand eSIM works, which networks travel plans use, how to choose between the different plan types, and some practical tips for islands, long bus journeys and city life in Bangkok.",

    { h2: "What is a Thailand eSIM?" },
    "An eSIM is a digital SIM stored inside your phone. A Thailand eSIM is a prepaid data plan that you buy online and install by scanning a QR code before you travel. When you land, your phone connects to a Thai partner network and you have mobile internet straight away.",
    "ESIMPROVE plans are data only unless a plan page says otherwise. There is no Thai phone number, but messaging, ride-hailing, maps and calls through apps all work over the data connection.",
    { note: "Your phone must support eSIM and be carrier-unlocked. Check your exact model in our [compatibility guide](/compatibility) before you buy." },

    { h2: "Which networks do Thailand eSIMs use?" },
    "Thailand's main mobile operators are **AIS** and **True**. True merged with DTAC in 2023, and you may still see both names, along with **TrueMove H**, in network lists. Coverage in Bangkok, Chiang Mai, Phuket, Krabi, Koh Samui and the other main tourist areas is generally strong. As in any country, coverage can be weaker on remote islands, in national parks and on boats between islands.",
    "The summary below is generated live from our catalog, so it always shows current plans, prices and networks:",
    { catalog: "thailand" },

    { h2: "Daily plans vs total-data plans in Thailand" },
    "Thailand plans come in two main forms. **Total-data plans** give one allowance for the whole validity period, which suits trips where some days are spent on a beach with hotel Wi-Fi. **Daily plans** give a fixed allowance each day; once you use it, speed is reduced or service pauses until the next day, as described on the plan page. Daily plans suit travellers who use their phone steadily every day.",
    {
      table: {
        caption: "Which Thailand plan suits your trip",
        head: ["Trip type", "Suggested plan shape", "Reason"],
        rows: [
          ["Bangkok city break", "Small total-data plan", "Hotel and café Wi-Fi covers much of your use"],
          ["Island hopping", "Mid-sized total-data plan", "Uneven use; ferry days and beach days"],
          ["Long trip or digital nomad", "Large total plan or daily plan", "Steady daily use, video calls, uploads"],
        ],
      },
    },
    "For a structured estimate, see [How much mobile data do you need when travelling?](/blog/how-much-data-do-i-need-travel).",

    { h2: "eSIM vs airport tourist SIM vs roaming" },
    "Tourist SIM cards are widely sold at Thai airports and convenience stores. They work well, but you need to buy one after landing, show your passport for registration, and store your home SIM card safely. A travel eSIM is ready before you board, and your home SIM can stay in the phone for SMS codes.",
    "Roaming with your home carrier needs no setup, but costs depend entirely on your carrier's travel rates. Our neutral comparison of [eSIM vs physical SIM vs roaming](/blog/esim-vs-physical-sim-vs-roaming) sets out the trade-offs.",

    { h2: "How to set up your Thailand eSIM" },
    { ol: [
      "Check your phone is eSIM-capable and unlocked in the [compatibility guide](/compatibility).",
      "Choose a plan on the [Thailand eSIM page](/destinations/thailand) and complete your order.",
      "Install the eSIM at home on Wi-Fi using the QR code or manual details on your order page. Our [iPhone and Android installation guide](/blog/how-to-install-esim-iphone-android) shows each step.",
      "On arrival, choose the Thailand eSIM for mobile data and turn on data roaming for that line.",
      "Turn data roaming off for your home SIM to avoid roaming charges from your home carrier.",
    ] },
    { tip: "Check whether your plan's validity starts on installation or on first connection in Thailand. The plan page tells you. If it starts on installation, install it a day or two before you fly." },

    { h2: "Tips for staying connected in Thailand" },
    { ul: [
      "**Ride-hailing:** Grab and Bolt are widely used in Thai cities and rely on mobile data. Set up the app and payment before you travel.",
      "**Island ferries:** signal can drop between islands. Download tickets and boarding details before you leave the pier.",
      "**Offline maps:** download maps of the islands and national parks you plan to visit for areas with patchy coverage.",
      "**SMS codes:** keep your home SIM active on a dual-SIM phone so banking and app verification texts still reach you.",
      "**Hotspot:** if you want to share data with a laptop or a travel companion, check the plan page; hotspot support depends on the plan and network.",
    ] },

    { h2: "Combining Thailand with neighbouring countries" },
    "Thailand is often one stop on a wider South-East Asia route. If you are also visiting Malaysia, Singapore, Vietnam or Indonesia, a multi-country plan may be simpler. Current plans that include Thailand alongside other countries are listed live below:",
    { catalogGroup: { title: "Multi-country plans that include Thailand", match: "thailand.*&|&.*thailand" } },
    "Planning Vietnam too? Read our [Vietnam eSIM guide](/blog/vietnam-esim-plans-coverage), or browse all destinations in the [Asia region](/regions/asia).",


    { h2: "Coverage notes by region" },
    { h3: "Bangkok" },
    "Bangkok is one of the best-connected cities in the region. You will mostly use data for ride-hailing, the BTS and MRT transit apps, maps and restaurant searches. Signal inside some large malls and underground stations can vary, as in any big city.",
    { h3: "Chiang Mai and the north" },
    "Chiang Mai city is well covered. Mountain roads towards Pai and national parks such as Doi Inthanon can have patchy signal on some stretches, so download offline maps before setting off on a scooter or a day trip.",
    { h3: "Andaman coast: Phuket, Krabi and Phi Phi" },
    "Main resort areas are well covered. On long-tail boats and speedboat tours to smaller islands and snorkelling spots, expect signal to come and go.",
    { h3: "Gulf islands: Koh Samui, Koh Phangan and Koh Tao" },
    "The main towns and beaches on the larger islands are covered. Remote beaches, viewpoints and dive sites can have weaker signal. Carry the details of your next ferry offline.",

    { h2: "Common mistakes to avoid" },
    { ul: [
      "**Buying a plan shorter than the trip.** Count your days from arrival to departure, including travel days.",
      "**Relying on a daily allowance for heavy days.** If you plan long video calls or uploads on certain days, a total-data plan may serve you better.",
      "**Forgetting to switch the data line.** After landing, make sure the Thailand eSIM, not your home SIM, is selected for mobile data.",
      "**Deleting the eSIM when it does not connect immediately.** Restart the phone or toggle airplane mode first; most eSIM QR codes cannot be reused.",
    ] },

    { cta: { title: "Arrive in Thailand connected", body: "Compare every Thailand eSIM plan by data, validity and price. Each plan page shows its network and rules.", href: "/destinations/thailand", label: "See Thailand eSIM plans" } },
  ],
  faq: [
    { q: "Is AIS or True better for tourists in Thailand?", a: "Both cover Bangkok and the main tourist areas well. Differences appear on remote islands and in national parks. Each ESIMPROVE plan page lists the network it uses." },
    { q: "Do I need a Thai phone number?", a: "Most visitors do not. Travel eSIMs are usually data only; apps such as WhatsApp, LINE and Grab work over mobile data, and your home SIM can stay active for SMS." },
    { q: "Can I buy a Thailand eSIM after I arrive?", a: "Yes, as long as you have an internet connection to buy and install it, for example on airport or hotel Wi-Fi. Installing before you travel means you are connected as soon as you land." },
    { q: "Will my Thailand eSIM work on ferries to the islands?", a: "It works wherever the partner network has coverage. Coverage can drop at sea between islands, so download tickets and maps before boarding." },
    { q: "What happens when my daily allowance runs out?", a: "On daily plans, speed is reduced or service pauses until the next day, as described on the plan page. On total-data plans, you can buy another plan if you run out." },
  ],
  references: [
    { label: "Set up eSIM on iPhone", publisher: "Apple Support", url: "https://support.apple.com/en-us/118669" },
    { label: "Set up a new eSIM (Pixel)", publisher: "Google Pixel Help", url: "https://support.google.com/pixelphone/answer/16115470?hl=en" },
    { label: "Download areas & navigate offline in Google Maps", publisher: "Google Maps Help", url: "https://support.google.com/maps/answer/6291838?hl=en" },
  ],
};
