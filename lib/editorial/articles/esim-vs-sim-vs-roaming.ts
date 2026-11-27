import type { EditorialArticle } from "../types";

export const esimVsSimVsRoaming: EditorialArticle = {
  slug: "esim-vs-physical-sim-vs-roaming",
  title: "eSIM vs Physical SIM vs Roaming: Which Is Better for Travel?",
  seoTitle: "eSIM vs Physical SIM vs Roaming: Which Is Better?",
  description:
    "A neutral comparison of travel eSIMs, local physical SIM cards and roaming: cost control, convenience, phone numbers, device needs, and which suits your trip.",
  excerpt:
    "Three ways to get mobile data abroad, compared honestly: what each costs you in money and hassle, what you keep and lose, and how to decide for your next trip.",
  category: "travel-esim-guides",
  primaryKeyword: "eSIM vs physical SIM vs roaming",
  secondaryKeywords: ["eSIM vs roaming", "eSIM vs local SIM", "travel SIM or eSIM", "is an eSIM better than roaming"],
  intent: "commercial investigation",
  publishedAt: "2026-11-26",
  updatedAt: "2026-11-26",
  art: { theme: "compare", alt: "Illustration of an eSIM chip, a physical SIM card and a roaming signal side by side for comparison" },
  quickAnswer:
    "Roaming is the easiest option but its cost depends entirely on your home carrier's travel rates. A local physical SIM can be good value but you need to buy it on arrival, often register it with ID, and swap cards. A travel eSIM is bought and installed before you leave and works on arrival, while your home SIM stays in the phone; it needs an eSIM-capable, unlocked phone and is usually data only.",
  featured: false,
  popular: true,
  destinations: [],
  expands: ["what-is-an-esim"],
  related: ["how-much-data-do-i-need-travel", "whatsapp-with-esim-keep-number", "how-to-install-esim-iphone-android"],
  supersedes: ["esim-vs-physical-sim"],
  body: [
    "When you travel abroad, you have three realistic ways to get mobile data: use your home carrier's roaming, buy a local SIM card when you arrive, or install a travel eSIM before you leave. Each has real strengths and real drawbacks, and the right one depends on your phone, your destination and what you need your phone to do.",
    "This comparison is written to help you decide, not to sell you one option. Where an eSIM is not the best fit, we say so.",

    { h2: "The three options in one minute" },
    {
      table: {
        caption: "Roaming, local SIM and travel eSIM compared",
        head: ["", "Home roaming", "Local physical SIM", "Travel eSIM"],
        rows: [
          ["Setup", "None, or opt into a travel pass", "Buy in a shop or kiosk on arrival", "Buy online, install before you travel"],
          ["Cost control", "Depends on your carrier's rates", "Usually local prices", "Fixed price paid in advance"],
          ["Your own number", "Yes, calls and SMS as normal", "No; you get a local number", "Kept on your home SIM; eSIM is usually data only"],
          ["Local phone number", "No", "Usually yes", "Usually no"],
          ["ID needed", "No", "Often, for registration", "No shop visit"],
          ["Swapping cards", "No", "Yes", "No"],
          ["Device requirement", "Any phone", "Unlocked phone with a SIM slot", "Unlocked, eSIM-capable phone"],
          ["Ready on landing", "Yes", "After you buy it", "Yes"],
        ],
      },
    },

    { h2: "Roaming with your home carrier" },
    "Roaming means using your normal SIM abroad. Your phone connects to a partner network in the destination and your home carrier bills you under its roaming terms.",
    { h3: "Strengths" },
    { ul: [
      "No setup and no new SIM: it simply works if roaming is enabled on your plan.",
      "You keep your number for calls and SMS, including bank verification codes.",
      "Works on any phone your carrier supports.",
    ] },
    { h3: "Drawbacks" },
    { ul: [
      "Cost varies widely. Some carriers include certain countries or sell daily travel passes; others charge per megabyte, which can become expensive quickly.",
      "It is easy to lose track of usage and get a surprise bill.",
      "Allowances on travel passes may be small or throttled.",
    ] },
    "If you live in the EU or EEA, the EU's \"Roam like at home\" rules mean you can use your home allowance in other EU and EEA countries without extra roaming charges, within fair-use limits. Those rules do not cover travel outside that area, and they do not apply to visitors with non-European plans.",

    { h2: "A local physical SIM card" },
    "A local SIM is a prepaid card from a mobile operator in the country you are visiting, bought at the airport, a shop or a convenience store.",
    { h3: "Strengths" },
    { ul: [
      "Often good value, at local prices.",
      "Usually includes a local phone number, which helps if you need to call local businesses or receive local SMS.",
      "Works in phones that do not support eSIM, as long as they are unlocked.",
    ] },
    { h3: "Drawbacks" },
    { ul: [
      "You need to find a seller after landing, sometimes with queues or limited opening hours.",
      "Many countries require registration with your passport.",
      "You remove your home SIM and must keep it safe, and you lose SMS on your home number while it is out (unless your phone has two slots).",
      "Language barriers and unfamiliar top-up systems can make it harder to manage.",
    ] },

    { h2: "A travel eSIM" },
    "A travel eSIM is a digital prepaid plan for a country or region, bought online and installed by scanning a QR code. Our explainer [What is an eSIM?](/guides/what-is-an-esim) covers the basics.",
    { h3: "Strengths" },
    { ul: [
      "Installed before you leave, so you have data the moment you land.",
      "Fixed, prepaid price with no roaming surprises.",
      "Your home SIM stays in the phone for calls and SMS on your usual number.",
      "Regional plans can cover several countries with one installation.",
    ] },
    { h3: "Drawbacks" },
    { ul: [
      "Your phone must support eSIM and be carrier-unlocked. Check your model in our [compatibility guide](/compatibility).",
      "Most travel eSIMs, including ESIMPROVE plans unless a plan page says otherwise, are data only: no local number, no calls or SMS, and no emergency calls.",
      "Some plans cannot be reinstalled once deleted, so you should not remove the eSIM until your trip is over.",
      "Hotspot support and speeds vary by plan and network; each plan page states the details.",
    ] },

    { h2: "Which one should you choose?" },
    "Use these rules of thumb:",
    { ul: [
      "**Choose roaming** if your carrier's travel rates for that country are reasonable, you need your own number for frequent calls, or you are only abroad for a few hours.",
      "**Choose a local SIM** if you need a local phone number, your phone does not support eSIM, or you are staying long enough to make a local contract worthwhile.",
      "**Choose a travel eSIM** if you want data ready on arrival, a fixed price, your home number kept for SMS, and no shop visit, and your phone supports eSIM.",
    ] },
    { tip: "Many travellers combine options: a travel eSIM for data, with the home SIM kept active (with data roaming switched off) for SMS codes. Our guide to [keeping your WhatsApp number with an eSIM](/blog/whatsapp-with-esim-keep-number) explains how dual SIM works." },

    { h2: "Before you decide: three checks" },
    { ol: [
      "**Look up your carrier's roaming rates** for your destination, including any travel pass and its allowance.",
      "**Check that your phone is unlocked and eSIM-capable** using the [compatibility guide](/compatibility).",
      "**Estimate your data needs** with our guide [How much mobile data do you need when travelling?](/blog/how-much-data-do-i-need-travel).",
    ] },


    { h2: "How to compare costs like for like" },
    "Prices are hard to compare because each option is sold differently: roaming per day or per megabyte, local SIMs as bundles, and travel eSIMs by data and validity. Bring them to the same basis before you decide:",
    { ol: [
      "**Estimate the total data you need** for the trip (see our guide to [how much data you need](/blog/how-much-data-do-i-need-travel)).",
      "**Roaming:** multiply your carrier's daily pass price by the number of days, and check the daily allowance. If the carrier charges per megabyte, multiply by your estimate.",
      "**Local SIM:** take the bundle price that covers your estimate and add anything you must buy on top, such as a separate top-up.",
      "**Travel eSIM:** pick the plan whose data and validity cover your trip on the destination page, and use the total shown at checkout.",
      "**Compare the totals**, then weigh in the non-price factors: keeping your number, setup time, and whether you need a local number.",
    ] },

    { h2: "Common myths" },
    { ul: [
      "**\"An eSIM replaces my phone number.\"** A data-only travel eSIM adds a data line; your number stays on your home SIM.",
      "**\"I need to remove my SIM card to use an eSIM.\"** On dual-SIM phones, both can be active at once.",
      "**\"Roaming is always expensive.\"** Not always: some carriers include certain countries or sell reasonable passes. Check before you decide.",
      "**\"Local SIMs are always cheapest.\"** Often good value, but once you add time, registration and the risk of losing your home SIM card, the difference may be small for a short trip.",
    ] },

    { cta: { title: "Compare travel eSIM plans", body: "See what a travel eSIM would cost for your destination, with data, validity and network on every plan page.", href: "/destinations", label: "Browse destinations" } },
  ],
  faq: [
    { q: "Is an eSIM cheaper than roaming?", a: "It depends on your carrier's roaming rates for the country. Some carriers include certain countries or sell reasonable travel passes; others charge per megabyte. Compare your carrier's price for the same amount of data with a travel eSIM plan." },
    { q: "Can I use an eSIM and a physical SIM at the same time?", a: "On most dual-SIM phones, yes. A common setup is the travel eSIM for data and the home SIM for calls and SMS." },
    { q: "Will I lose my phone number with a travel eSIM?", a: "No. Your number stays on your home SIM, which can remain in the phone. The travel eSIM only provides data unless the plan page says otherwise." },
    { q: "Do local SIM cards need ID?", a: "Many countries require SIM registration with a passport or ID. Requirements differ by country." },
    { q: "What if my phone does not support eSIM?", a: "Then roaming or a local physical SIM are your options. Check the compatibility guide to be sure; support depends on the exact model and where it was sold." },
  ],
  references: [
    { label: "Roaming: what you pay to use your smartphone in another EU country", publisher: "Your Europe (European Union)", url: "https://europa.eu/youreurope/citizens/consumers/internet-telecoms/mobile-roaming-costs/index_en.htm" },
    { label: "What is an eSIM?", publisher: "GSMA", url: "https://www.gsma.com/solutions-and-impact/technologies/esim/" },
    { label: "Set up eSIM on iPhone", publisher: "Apple Support", url: "https://support.apple.com/en-us/118669" },
  ],
};
