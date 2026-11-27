import type { EditorialArticle } from "../types";

export const installEsim: EditorialArticle = {
  slug: "how-to-install-esim-iphone-android",
  title: "How to Install and Activate an eSIM on iPhone and Android",
  seoTitle: "How to Install an eSIM on iPhone and Android",
  description:
    "Step-by-step: install and activate a travel eSIM on iPhone, Google Pixel and Samsung Galaxy, by QR code or manual details, plus fixes for common problems.",
  excerpt:
    "Clear, step-by-step instructions for installing a travel eSIM on iPhone, Pixel and Samsung Galaxy phones, switching it on when you land, and fixing the most common activation problems.",
  category: "esim-tips-tutorials",
  primaryKeyword: "how to install eSIM",
  secondaryKeywords: ["install eSIM iPhone", "install eSIM Android", "activate travel eSIM", "eSIM QR code not working"],
  intent: "how-to",
  publishedAt: "2026-11-26",
  updatedAt: "2026-11-26",
  art: { theme: "install", alt: "Illustration of a phone scanning a QR code with a check mark, representing installing an eSIM" },
  quickAnswer:
    "To install a travel eSIM, connect to Wi-Fi, open your phone's mobile or cellular settings, choose the option to add an eSIM, and scan the QR code from your order (or enter the manual activation details). On iPhone that is Settings > Cellular > Add eSIM; on Pixel, Settings > Network & internet > SIMs > Add SIM; on Samsung, Settings > Connections > SIM manager > Add eSIM. When you arrive, set the eSIM as your data line and turn on data roaming for it.",
  featured: false,
  popular: true,
  destinations: [],
  expands: ["install-ios", "install-android", "qr-or-manual", "troubleshooting"],
  related: ["whatsapp-with-esim-keep-number", "how-much-data-do-i-need-travel", "esim-vs-physical-sim-vs-roaming"],
  body: [
    "Installing an eSIM takes a few minutes, but doing it in the right order avoids almost every problem travellers run into. This guide covers iPhone, Google Pixel and Samsung Galaxy phones, explains the difference between installing and activating, and lists fixes for the most common issues.",
    "Menu names vary slightly between phone models, operating-system versions and regions. If a label on your phone is different, look for the closest equivalent, or check your manufacturer's support pages linked at the end.",

    { h2: "Before you start: four checks" },
    { ol: [
      "**Your phone supports eSIM.** Support depends on the exact model and where it was sold. Check our [device compatibility guide](/compatibility).",
      "**Your phone is carrier-unlocked.** A phone locked to one carrier may reject another provider's eSIM.",
      "**You have a stable internet connection.** Installation downloads the profile, so use reliable Wi-Fi.",
      "**You have your QR code or manual details.** For ESIMPROVE orders, they are on your order page once payment is confirmed.",
    ] },
    { note: "Install the eSIM before you travel, at home on Wi-Fi. If you install it after landing, you need Wi-Fi at the airport or hotel to download it." },

    { h2: "Installing vs activating: what is the difference?" },
    "**Installing** downloads the eSIM profile onto your phone. It appears as a new line in your settings. **Activating** happens when the plan first connects to a network, usually when you switch it on in the destination. Some plans start their validity period on installation and others on first connection; each ESIMPROVE plan page states which rule applies. That is why the timing of installation can matter.",

    { h2: "How to install an eSIM on iPhone" },
    "eSIM is supported on iPhone XS, iPhone XS Max, iPhone XR and later models. iPhone models sold in the United States from the iPhone 14 onwards are eSIM only.",
    { h3: "With a QR code" },
    { ol: [
      "Connect to Wi-Fi.",
      "Open **Settings** > **Cellular** (or **Mobile Data**) > **Add eSIM** (on some versions, **Add Cellular Plan**).",
      "Choose **Use QR Code** and scan the QR code from your order page. If the code is on the same phone, you can usually tap and hold the QR image or use the option to enter details manually.",
      "Follow the prompts. When asked, label the new line, for example \"Travel\".",
      "When asked about the default line, keep your **home line** as the default for calls and messages for now.",
    ] },
    { h3: "Entering details manually" },
    "If you cannot scan the code, go to **Settings** > **Cellular** > **Add eSIM** > **Use QR Code** > **Enter Details Manually**, and enter the details from your order page. ESIMPROVE shows them as one activation string that begins with `LPA:1$`: the part after the first `$` is the SM-DP+ address, and the part after the second `$` is the activation code. Some phones let you paste the whole string.",
    { h3: "When you arrive" },
    { ol: [
      "Open **Settings** > **Cellular** and make sure the travel line is turned on.",
      "Tap **Cellular Data** and select the travel line.",
      "Tap the travel line and turn on **Data Roaming**.",
      "Tap your home line and turn **Data Roaming** off, so your home carrier does not charge you.",
      "Consider turning off **Allow Cellular Data Switching**, so the phone does not move data back to your home line when signal is weak.",
    ] },

    { h2: "How to install an eSIM on Google Pixel" },
    { ol: [
      "Connect to Wi-Fi.",
      "Open **Settings** > **Network & internet** > **SIMs** > **Add SIM** (some versions show **+** next to SIMs).",
      "Choose the option to set up or download an eSIM, then scan the QR code. If you cannot scan it, look for an option such as **Need help?** or **Enter it manually** to type the activation details.",
      "Follow the prompts and give the new SIM a name.",
    ] },
    "When you arrive, go back to **Settings** > **Network & internet** > **SIMs**, select the travel eSIM, make sure it is turned on, set it as the **mobile data** SIM, and turn on **Roaming** for it. Turn roaming off for your home SIM.",

    { h2: "How to install an eSIM on Samsung Galaxy" },
    { ol: [
      "Connect to Wi-Fi.",
      "Open **Settings** > **Connections** > **SIM manager** (or **SIM card manager**) > **Add eSIM** (some regions show **Add mobile plan**).",
      "Choose **Scan QR code** and scan the code from your order page, or choose the option to enter an activation code.",
      "Confirm, then name the new line.",
    ] },
    "When you arrive, open **Settings** > **Connections** > **SIM manager**, set **Mobile data** to the travel eSIM, then go to **Settings** > **Connections** > **Mobile networks** and turn on **Data roaming** for the travel line. Samsung recommends restarting the phone after adding an eSIM if it does not connect straight away.",

    { h2: "Other Android phones" },
    "On other Android phones the path is similar: look in **Settings** under **Network**, **Connections** or **Mobile network** for **SIM manager**, **SIMs** or **Add mobile plan**. eSIM support on Android depends on the phone model, Android version and region.",

    { h2: "Troubleshooting common problems" },
    {
      table: {
        caption: "Common eSIM problems and fixes",
        head: ["Problem", "What to try"],
        rows: [
          ["QR code will not scan", "Increase screen brightness on the device showing the code, or enter the details manually"],
          ["\"This code is no longer valid\"", "The code may already have been used. Do not scan it again; contact support with your order number"],
          ["Installed but no signal on arrival", "Check the line is on, set as the data line, and data roaming is enabled for it; toggle airplane mode; restart"],
          ["Signal but no internet", "Confirm data roaming is on for the eSIM line; check APN settings if the plan page lists one"],
          ["Phone uses home SIM for data", "Select the eSIM as the mobile data line and turn off automatic data switching"],
          ["Cannot add eSIM option", "The phone may not support eSIM or may be carrier-locked; check compatibility"],
        ],
      },
    },
    { note: "Most travel eSIM QR codes can only be used once. Do not delete an installed eSIM to \"try again\"; it may not be possible to reinstall it. Contact support with your order number instead." },
    "Our help centre has shorter, device-specific checklists too: [install on iPhone](/guides/install-ios), [install on Android](/guides/install-android) and [troubleshooting an installation](/guides/troubleshooting).",

    { h2: "After your trip" },
    "When your plan expires, you can delete the eSIM from your phone's settings, or keep it if you think you may buy another plan for that line later. Before deleting, make sure the plan has no remaining data or validity you want to use.",

    { cta: { title: "Get your eSIM ready before you fly", body: "Choose a plan for your destination. The QR code and manual details appear on your order page once payment is confirmed.", href: "/destinations", label: "Browse destinations" } },
  ],
  faq: [
    { q: "Should I install my eSIM before or after I travel?", a: "Before, on reliable Wi-Fi. Then switch it on for data when you arrive. If your plan's validity starts on installation, install it close to your departure date; the plan page says which rule applies." },
    { q: "Do I need to turn on data roaming for a travel eSIM?", a: "Usually yes. The travel eSIM connects to a partner network in the destination, which your phone treats as roaming. Turn data roaming on for the eSIM line and off for your home SIM." },
    { q: "Can I scan the same QR code twice?", a: "Usually not. Most eSIM QR codes are single-use. Do not delete an installed eSIM expecting to reinstall it; contact support if you have a problem." },
    { q: "Where do I find the manual activation details?", a: "For ESIMPROVE orders, the order page shows a copyable activation string (starting LPA:1$) next to the QR code. It contains the SM-DP+ address and the activation code, separated by $ signs." },
    { q: "Why can't I see an Add eSIM option?", a: "Your phone may not support eSIM, may be carrier-locked, or may use a different menu name. Check the compatibility guide and your manufacturer's support pages." },
  ],
  references: [
    { label: "Set up eSIM on iPhone", publisher: "Apple Support", url: "https://support.apple.com/en-us/118669" },
    { label: "If you can't set up an eSIM on your iPhone", publisher: "Apple Support", url: "https://support.apple.com/en-us/102478" },
    { label: "Set up a new eSIM (Pixel)", publisher: "Google Pixel Help", url: "https://support.google.com/pixelphone/answer/16115470?hl=en" },
    { label: "SIM cards for your Galaxy phone or tablet", publisher: "Samsung US Support", url: "https://www.samsung.com/us/support/answer/ANS10001619/" },
  ],
};
