import type { EditorialArticle } from "../types";

export const whatsappEsim: EditorialArticle = {
  slug: "whatsapp-with-esim-keep-number",
  title: "Can You Keep Your WhatsApp Number When Using an eSIM?",
  seoTitle: "WhatsApp with an eSIM: Keep Your Number Abroad",
  description:
    "Yes: WhatsApp stays on your registered number when a travel eSIM provides data. How dual SIM works, the settings to change, and mistakes that lock people out.",
  excerpt:
    "WhatsApp is tied to your phone number, not to the SIM that provides your internet. Here is how to use a data-only travel eSIM while keeping WhatsApp, calls and SMS on your usual number.",
  category: "connectivity-technology",
  primaryKeyword: "WhatsApp with eSIM",
  secondaryKeywords: ["keep WhatsApp number abroad", "WhatsApp travel eSIM", "dual SIM WhatsApp", "will WhatsApp work with a data-only eSIM"],
  intent: "informational",
  publishedAt: "2026-11-26",
  updatedAt: "2026-11-26",
  art: { theme: "whatsapp", alt: "Illustration of two chat bubbles linked to a phone with two SIM lines, representing keeping your messaging number while using a travel eSIM" },
  quickAnswer:
    "Yes. WhatsApp is linked to the phone number you verified, not to the SIM that provides your internet connection. When a travel eSIM provides mobile data, WhatsApp keeps working with your usual number for messages and calls. Keep your home SIM in the phone (with data roaming switched off) so you can still receive verification SMS if WhatsApp ever asks you to re-verify.",
  popular: false,
  destinations: [],
  related: ["how-to-install-esim-iphone-android", "esim-vs-physical-sim-vs-roaming", "how-much-data-do-i-need-travel"],
  supersedes: ["whatsapp-and-dual-sim"],
  body: [
    "One of the most common worries about travel eSIMs is losing WhatsApp. If your new eSIM is data only and has no phone number, does WhatsApp stop working? Will your contacts see a new number? Do you need to change anything in the app?",
    "The short answer is that WhatsApp keeps working exactly as before. This guide explains why, how to set up your phone so everything behaves as expected, and the few mistakes that genuinely can cause problems.",

    { h2: "Why WhatsApp keeps working with a travel eSIM" },
    "WhatsApp identifies your account by the phone number you verified when you registered, not by which SIM card or eSIM is providing your internet connection. WhatsApp's own help centre explains that the app uses only the number you verified, and that removing, replacing or swapping a SIM or eSIM does not automatically sign you out.",
    "A data-only travel eSIM simply provides the internet connection. WhatsApp sends and receives messages and calls over that connection under your usual number, just as it does when you are on Wi-Fi. Your contacts see the same number and the same chats.",
    { note: "The same applies to most internet-based messaging and calling apps, such as Telegram, Signal, iMessage and FaceTime: they keep using your existing account while the eSIM provides data." },

    { h2: "How dual SIM works with a travel eSIM" },
    "Most modern phones support **dual SIM**: two lines active at once, for example a physical SIM and an eSIM, or two eSIMs. For travel, a typical setup is:",
    {
      table: {
        caption: "A typical dual-SIM setup for travel",
        head: ["Line", "Role", "Data roaming"],
        rows: [
          ["Home SIM (your usual number)", "Calls and SMS; WhatsApp number stays the same", "Off"],
          ["Travel eSIM (data only)", "Mobile data for all apps, including WhatsApp", "On"],
        ],
      },
    },
    "With this setup, WhatsApp uses the travel eSIM's data, while your home line can still receive SMS, such as one-time codes from your bank. Your home carrier's roaming rates apply to any regular calls and SMS on the home line, so check them if you expect to use them.",

    { h2: "Step-by-step: set up your phone" },
    { h3: "On iPhone" },
    { ol: [
      "Install the travel eSIM before you travel. Our [installation guide](/blog/how-to-install-esim-iphone-android) walks through it.",
      "On arrival, go to **Settings** > **Cellular** > **Cellular Data** and choose the travel eSIM.",
      "Tap the travel line and turn on **Data Roaming**.",
      "Tap your home line and turn **Data Roaming** off.",
      "Turn off **Allow Cellular Data Switching** if you want all data to go through the travel eSIM.",
      "Leave your home line turned on if you want to receive calls and SMS on it.",
    ] },
    { h3: "On Android" },
    { ol: [
      "Install the travel eSIM before you go.",
      "On arrival, open your SIM settings (for example **Settings** > **Network & internet** > **SIMs**, or **Settings** > **Connections** > **SIM manager** on Samsung).",
      "Set the travel eSIM as the **mobile data** SIM and turn on roaming for it.",
      "Turn off data roaming for your home SIM.",
      "Turn off any automatic data switching option if you want all data on the travel eSIM.",
    ] },
    "There is nothing to change inside WhatsApp itself.",

    { h2: "What not to do" },
    "A few actions can cause real problems, so avoid them:",
    { ul: [
      "**Do not use WhatsApp's \"Change number\" feature.** It moves your account to a different number. A data-only travel eSIM has no number to move to, and you do not need to change anything.",
      "**Do not remove your home SIM and leave it at home if you can avoid it.** If WhatsApp asks you to re-verify your number (for example after reinstalling the app or moving to a new phone), the code is sent by SMS or call to your registered number.",
      "**Do not reinstall WhatsApp or switch phones mid-trip** without making sure your registered number can receive the verification code.",
      "**Turn on two-step verification** in WhatsApp before you travel (Settings > Account > Two-step verification). It adds a PIN that protects your account if someone else tries to register your number.",
    ] },
    { tip: "If your phone has only one SIM slot and no eSIM support for a second line, you can still keep WhatsApp: verification is only needed when you register or re-verify, not for everyday use. Just avoid reinstalling the app while your home SIM is out of the phone." },

    { h2: "WhatsApp calls vs regular calls abroad" },
    "WhatsApp voice and video calls use mobile data, so with a travel eSIM they count against your plan's data allowance rather than your home carrier's roaming rates. Video calls use considerably more data than voice calls. If you expect to make many video calls, choose a plan with a larger allowance; our guide [How much mobile data do you need when travelling?](/blog/how-much-data-do-i-need-travel) shows how to estimate it.",
    "Regular phone calls and SMS on your home line are billed by your home carrier under its roaming terms. A data-only travel eSIM cannot make regular phone calls or emergency calls.",

    { h2: "What about a local phone number?" },
    "If you need a number in the country you are visiting, for example for local deliveries or businesses that only call local numbers, a data-only eSIM will not provide one. In that case, a local physical SIM or a plan that explicitly includes a number is the better choice. Our comparison of [eSIM vs physical SIM vs roaming](/blog/esim-vs-physical-sim-vs-roaming) covers when each makes sense.",


    { h2: "Troubleshooting: WhatsApp not working on eSIM data" },
    "If WhatsApp does not send or receive messages while you are using a travel eSIM, the cause is almost always the phone's data settings rather than WhatsApp itself. Work through these checks in order:",
    { ol: [
      "Open a web page in your browser. If it does not load either, the problem is the data connection, not WhatsApp.",
      "Check that the travel eSIM is selected as the **mobile data** line.",
      "Check that **data roaming** is turned on for the travel eSIM line.",
      "Make sure WhatsApp is allowed to use mobile data (on iPhone: Settings > Cellular, then find WhatsApp in the app list; on Android: the app's data usage settings).",
      "Toggle airplane mode on and off, or restart the phone, to make it register on the network again.",
      "If you still have no connection, contact support with your order number. Do not delete the eSIM, because it may not be possible to reinstall it.",
    ] },
    { h3: "iMessage and FaceTime on iPhone" },
    "On an iPhone with two lines, iMessage and FaceTime can show which number they use for conversations. Your existing conversations stay on your usual number. If a new conversation starts on the wrong line, you can choose the line in the conversation or in the Messages and FaceTime settings.",

    { cta: { title: "Keep your number, get local data", body: "Pick a data plan for your destination and keep WhatsApp, calls and SMS on your usual number.", href: "/destinations", label: "Browse eSIM plans" } },
  ],
  faq: [
    { q: "Will WhatsApp work with a data-only eSIM?", a: "Yes. WhatsApp uses the internet connection the eSIM provides and stays linked to your registered number. Your chats and contacts do not change." },
    { q: "Do I need to change my number in WhatsApp?", a: "No. Do not use the Change number feature. A data-only travel eSIM has no number, and WhatsApp keeps working with your existing one." },
    { q: "Can I receive SMS codes while using a travel eSIM?", a: "Yes, if your home SIM stays active in a dual-SIM phone. SMS to your home number arrives on that line; your home carrier's roaming rates may apply." },
    { q: "Do WhatsApp calls use my eSIM data?", a: "Yes. WhatsApp voice and video calls use mobile data. Video calls use much more data than voice calls." },
    { q: "What happens if WhatsApp asks me to verify my number abroad?", a: "The code is sent to your registered number by SMS or call, so you need that line to be able to receive it. Keeping your home SIM in the phone avoids problems." },
  ],
  references: [
    { label: "About using multiple phone numbers or accounts on WhatsApp", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/1068436057886812/" },
    { label: "How to change your phone number", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/498754122134583/" },
    { label: "How to use dual SIMs on your Google Pixel phone", publisher: "Google Pixel Help", url: "https://support.google.com/pixelphone/answer/9449293?hl=en" },
    { label: "Set up eSIM on iPhone", publisher: "Apple Support", url: "https://support.apple.com/en-us/118669" },
  ],
};
