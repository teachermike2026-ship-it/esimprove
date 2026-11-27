import type { EditorialArticle } from "../types";

export const howMuchData: EditorialArticle = {
  slug: "how-much-data-do-i-need-travel",
  title: "How Much Mobile Data Do You Need When Travelling?",
  seoTitle: "How Much Data Do I Need for Travel? A Practical Guide",
  description:
    "Work out how much mobile data you need for a trip using your own phone's usage, what uses the most data, daily vs total plans, and how to make data last.",
  excerpt:
    "A practical, honest method for choosing the right data allowance for a trip: measure your real usage, understand what eats data, and match allowance and validity to your itinerary.",
  category: "travel-data-planning",
  primaryKeyword: "how much data do I need for travel",
  secondaryKeywords: ["how much data do I need for my trip", "travel data usage", "how many GB for a week abroad", "eSIM data calculator"],
  intent: "informational",
  publishedAt: "2026-11-26",
  updatedAt: "2026-11-26",
  art: { theme: "data", alt: "Illustration of a phone with a data gauge and bar chart, representing measuring mobile data use for a trip" },
  quickAnswer:
    "The most reliable way to know how much data you need is to check your own phone's mobile-data statistics for a normal week, divide by seven to get a daily figure, and multiply by the number of days you will rely on mobile data abroad. Add a margin for travel days. Maps and messaging use little data; video streaming, video calls, photo backup and hotspot use account for most of it.",
  featured: false,
  popular: true,
  destinations: [],
  expands: ["before-you-travel"],
  related: ["esim-vs-physical-sim-vs-roaming", "japan-esim-travel-guide", "europe-esim-multiple-countries"],
  supersedes: ["how-much-data"],
  body: [
    "\"How much data do I need?\" is the question almost every traveller asks before buying an eSIM, and most answers online give a single number that ignores how differently people use their phones. A business traveller on video calls and a backpacker who mostly uses maps and messaging can differ by a factor of ten.",
    "This guide gives you a method rather than a guess. It takes about five minutes and uses data your phone already collects.",

    { h2: "Step 1: Measure what you actually use" },
    "Your phone keeps track of how much mobile data each app uses. That is the best starting point, because it reflects your own habits.",
    { h3: "On iPhone" },
    "Open **Settings**, tap **Cellular** (or **Mobile Data**), and scroll to see the data used in the current period, with a breakdown by app. Apple notes that the period runs from when the statistics were last reset, so check the date shown at the bottom of the screen. If you want a clean measurement, tap **Reset Statistics** at the bottom, use your phone normally for a week, and check again.",
    { h3: "On Android" },
    "Open **Settings**, then **Network & internet** (or **Connections** on Samsung), then **Data usage** or **SIMs**, and look for app data usage. You can usually choose the date range. Menu names vary by manufacturer and Android version.",
    { h3: "Turn it into a daily figure" },
    "Divide the total for the period by the number of days. If your phone shows 14 GB used over 28 days, your daily average is 0.5 GB. That is your baseline.",
    { tip: "If you use Wi-Fi most of the time at home, your mobile-data figure will understate what you need abroad, where you will use mobile data more. Think about how many hours a day you will be away from Wi-Fi on the trip." },

    { h2: "Step 2: Adjust for how you travel" },
    "Travel changes your phone use. You navigate more, translate more, book more on the go, and take more photos. On the other hand, you may stream less and spend evenings on hotel Wi-Fi. Adjust your baseline with these questions:",
    { ul: [
      "**Will you navigate a lot?** City walking and road trips mean frequent map use.",
      "**Will you share photos and videos?** Uploading video is far heavier than sending messages.",
      "**Will you make video calls?** Video calling is one of the heaviest everyday uses.",
      "**Will you stream on mobile data?** One evening of video can use more than a week of maps and messaging.",
      "**Will you use your phone as a hotspot?** A laptop on your hotspot can use data very quickly, and not all plans allow hotspot use.",
    ] },

    { h2: "What uses the most data?" },
    "It helps to know which activities matter. Video is by far the biggest. Netflix, for example, states in its help centre that streaming can use up to about 1 GB per hour in standard definition and up to about 3 GB per hour in HD on its higher quality settings, with lower data-saver settings using much less. Other video services are in the same broad range and also offer data-saving modes.",
    {
      table: {
        caption: "Relative data use of common travel activities",
        head: ["Activity", "Relative data use", "How to reduce it"],
        rows: [
          ["Text messaging, email without attachments", "Very low", "Nothing needed"],
          ["Navigation with maps", "Low", "Download offline maps on Wi-Fi"],
          ["Web browsing and booking", "Low to moderate", "Use app data-saver modes"],
          ["Social media with images", "Moderate", "Turn off video autoplay"],
          ["Voice calls over apps", "Low to moderate", "Prefer voice over video"],
          ["Video calls", "High", "Lower the video quality or use voice"],
          ["Video streaming", "High to very high", "Download on Wi-Fi; use data-saver"],
          ["Photo and video cloud backup", "High", "Back up on Wi-Fi only"],
          ["Hotspot for a laptop", "Very high", "Check plan rules; pause updates"],
        ],
      },
    },
    { note: "Actual figures depend on the app, its settings and the network. Your own phone's statistics, from Step 1, are always more reliable than any generic table." },

    { h2: "Step 3: Turn it into a plan" },
    "Multiply your adjusted daily figure by the number of days you will rely on mobile data, then add a margin of around 20–30% for travel days, delays and unexpected use. Then look at two things on the plan page:",
    { h3: "Total-data or daily allowance?" },
    "A **total-data plan** gives one allowance for the whole validity period. It suits uneven use, such as heavy sightseeing days and quiet days by the pool. A **daily plan** gives a fixed allowance per day; once used, the speed drops or service pauses until the next day, as the plan page explains. It suits steady, predictable use. Some plans are sold as unlimited; they are still subject to fair use and some are speed-capped, as shown in the plan name and on the plan page.",
    { h3: "Does the validity cover your trip?" },
    "Validity is just as important as the allowance. Check whether it starts when the eSIM is installed or when it first connects in the destination; each ESIMPROVE plan page states which rule applies.",
    {
      table: {
        caption: "Worked examples (illustrative, based on the method above)",
        head: ["Traveller", "Measured daily use", "Trip", "Estimate with margin"],
        rows: [
          ["Light user: maps and messaging", "0.2 GB", "7 days", "About 2 GB"],
          ["Moderate user: plus social media", "0.5 GB", "10 days", "About 6–7 GB"],
          ["Heavy user: video calls and uploads", "1.5 GB", "14 days", "About 25–27 GB, or a daily/unlimited plan"],
        ],
      },
    },

    { h2: "How to make your data last longer" },
    { ul: [
      "**Download offline maps** of the cities and regions you are visiting while on Wi-Fi. Google Maps and other map apps support this.",
      "**Download entertainment** such as playlists, podcasts and shows before you leave.",
      "**Turn off automatic updates** and set cloud photo backup to Wi-Fi only.",
      "**Turn off video autoplay** in social media apps.",
      "**Use Wi-Fi where it is safe**, such as at your accommodation, and keep mobile data for when you are out.",
      "**Check background usage** in your phone's data settings during the first day and switch off anything unexpected.",
    ] },

    { h2: "What if you run out?" },
    "If you run out of data on a total-data plan, you can buy another plan for the same destination and install it the same way. ESIMPROVE does not sell top-ups for existing eSIMs at the moment, so a new plan is the way to add data. On daily plans, the allowance renews each day as the plan page describes.",

    { cta: { title: "Find a plan with the right allowance", body: "Every plan page shows the data allowance, validity, network and when validity starts, so you can match a plan to your estimate.", href: "/destinations", label: "Browse eSIM plans by destination" } },
  ],
  faq: [
    { q: "How much data do I need for a week abroad?", a: "It depends on how you use your phone. Check your phone's mobile-data statistics for a normal week; if you use maps and messaging only, a few gigabytes is often enough, while video calls and streaming can need much more. Add a 20–30% margin." },
    { q: "Is 1 GB enough for a trip?", a: "For a short trip with mostly maps, messaging and email, and Wi-Fi at your accommodation, it can be. If you share photos, use social media heavily or make video calls, you will likely need more." },
    { q: "Do maps use a lot of data?", a: "Navigation uses relatively little data compared with video. Downloading offline maps on Wi-Fi before you travel reduces it further and keeps navigation working without signal." },
    { q: "Should I choose a daily plan or a total-data plan?", a: "Choose a daily plan if you use about the same amount every day. Choose a total-data plan if your use is uneven, with some heavy days and some light days." },
    { q: "Can I add data to my ESIMPROVE eSIM?", a: "Top-ups are not sold at the moment. If you run out, buy another plan for the same destination." },
  ],
  references: [
    { label: "View or change cellular data settings on iPhone", publisher: "Apple Support", url: "https://support.apple.com/guide/iphone/view-or-change-cellular-data-settings-iph3dd5f213/ios" },
    { label: "How to control how much data Netflix uses", publisher: "Netflix Help Center", url: "https://help.netflix.com/en/node/87" },
    { label: "Download areas & navigate offline in Google Maps", publisher: "Google Maps Help", url: "https://support.google.com/maps/answer/6291838?hl=en" },
  ],
};
