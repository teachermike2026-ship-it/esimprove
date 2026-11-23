export interface GuideSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  summary: string;
  readingTime: string;
  sections: GuideSection[];
}

export const guides: Guide[] = [
  {
    slug: "before-you-travel",
    title: "Before you travel: eSIM checklist",
    summary:
      "A short, provider-neutral checklist for checking your device, installing a plan, and avoiding common travel-data mistakes.",
    readingTime: "4 min read",
    sections: [
      {
        heading: "Confirm the device supports eSIM",
        paragraphs: [
          "eSIM support depends on the exact model, region, and carrier configuration. Check the manufacturer's specification and look for an option to add a mobile plan in the device settings.",
          "A phone that supports eSIM in one market may not support it in another. Do not rely on a series name alone.",
        ],
        bullets: [
          "Check the exact model number, not just the marketing name.",
          "Confirm the device is carrier-unlocked.",
          "Look for “Add eSIM” or “Add mobile plan” in settings.",
        ],
      },
      {
        heading: "Install before you leave",
        paragraphs: [
          "Install the eSIM while you have a reliable internet connection. Keep the QR code or manual activation details until the installation is complete and the plan appears in the device's SIM manager.",
          "Do not delete the eSIM unless you have confirmed whether it can be re-added. Some providers do not allow reinstalling the same activation.",
        ],
      },
      {
        heading: "Plan your data use",
        paragraphs: [
          "Turn off automatic updates, background app refresh, and high-bandwidth sync until you understand the plan. A travel plan may be data-only and may not include calls or SMS.",
          "Keep your primary SIM active for calls and messages if you need them, and choose which line handles mobile data.",
        ],
      },
      {
        heading: "Keep your activation details safe",
        paragraphs: [
          "Your QR code and activation code are personal to your order. Keep them private and do not share them — anyone with the code can install your eSIM.",
        ],
      },
    ],
  },
  {
    slug: "install-ios",
    title: "Install an eSIM on iPhone",
    summary:
      "General iOS steps for adding an eSIM with a QR code or manual details. Exact labels vary by iOS version and region.",
    readingTime: "3 min read",
    sections: [
      {
        heading: "Prepare",
        paragraphs: [
          "Connect the iPhone to Wi-Fi and make sure the device is carrier-unlocked. Have the QR code or manual activation details ready.",
        ],
      },
      {
        heading: "Add the eSIM",
        paragraphs: [
          "Open Settings and find the cellular or mobile data section. Choose the option to add an eSIM or add a mobile plan, then follow the on-screen instructions.",
        ],
        bullets: [
          "Scan the QR code with the camera when prompted.",
          "If scanning fails, choose the manual option and enter the SM-DP+ address and activation code.",
          "Label the new line so you can tell it apart from your primary SIM.",
        ],
      },
      {
        heading: "Choose the data line",
        paragraphs: [
          "After installation, set the new line as the mobile data line if that is what you want. Keep the primary line available for calls and messages if needed.",
          "Turn on data roaming only if the plan instructions require it. Roaming settings vary by provider.",
        ],
      },
      {
        heading: "If installation fails",
        paragraphs: [
          "Check the QR code, confirm the device is unlocked, and restart the phone. If the plan still does not install, contact the provider that issued the activation. Do not repeatedly scan a code that may have already been consumed.",
        ],
      },
    ],
  },
  {
    slug: "install-android",
    title: "Install an eSIM on Android",
    summary:
      "General Android steps for adding an eSIM. Menu names differ across Samsung, Google, Motorola, and other manufacturers.",
    readingTime: "3 min read",
    sections: [
      {
        heading: "Prepare",
        paragraphs: [
          "Connect to Wi-Fi and confirm the phone supports eSIM. The option is usually in Settings under Network & internet, Connections, or SIMs.",
        ],
      },
      {
        heading: "Add the eSIM",
        paragraphs: [
          "Open the SIM manager and choose Add eSIM or Add mobile plan. Scan the QR code or enter the manual activation details when prompted.",
        ],
        bullets: [
          "Some devices require a download over Wi-Fi before the plan appears.",
          "Label the eSIM so it is easy to identify.",
          "Set the new line for mobile data if appropriate.",
        ],
      },
      {
        heading: "Check connectivity",
        paragraphs: [
          "After installation, confirm the eSIM is enabled and selected for data. If the device has a dual-SIM manager, make sure the correct line is active.",
          "If the plan does not connect, check the provider's activation status before changing device settings.",
        ],
      },
      {
        heading: "If installation fails",
        paragraphs: [
          "Restart the device, confirm it is carrier-unlocked, and check that the QR code has not expired. Manufacturer support or the plan provider can confirm whether the activation is still valid.",
        ],
      },
    ],
  },
  {
    slug: "qr-or-manual",
    title: "QR code or manual activation?",
    summary:
      "Understand the two common eSIM activation paths and how to keep the activation details safe.",
    readingTime: "2 min read",
    sections: [
      {
        heading: "QR activation",
        paragraphs: [
          "A QR code encodes the provider's activation details. Scanning it in the device's eSIM setup screen starts the installation. Treat the QR code like a password: anyone who scans it may be able to install the plan.",
        ],
      },
      {
        heading: "Manual activation",
        paragraphs: [
          "Manual activation usually requires an SM-DP+ address and an activation code. It is useful when a camera cannot scan the code or when the device is being set up remotely.",
        ],
      },
      {
        heading: "One activation, one installation",
        paragraphs: [
          "Do not share activation details or scan the same code on multiple devices unless the provider explicitly supports it. If installation fails, stop and check the status before trying again.",
        ],
      },
      {
        heading: "Keep activation details private",
        paragraphs: [
          "Your activation details are unique to your order. Store them securely and only scan or enter them on the device you intend to use. If you lose them or suspect they have been shared, contact support with your order number.",
        ],
      },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting an eSIM installation",
    summary:
      "A safe checklist for common installation problems.",
    readingTime: "4 min read",
    sections: [
      {
        heading: "Start with the basics",
        paragraphs: [
          "Confirm the device supports eSIM, is carrier-unlocked, and has a stable internet connection. Check that the activation details have not expired or already been used.",
        ],
      },
      {
        heading: "Check the line settings",
        paragraphs: [
          "Make sure the eSIM is enabled and selected for mobile data if needed. If you are using dual SIM, confirm which line is handling calls, messages, and data.",
        ],
      },
      {
        heading: "Do not guess at coverage",
        paragraphs: [
          "A plan appearing in the device does not prove that coverage, speed, or network access will work. Those details must come from the provider and the local network operator.",
        ],
      },
      {
        heading: "When to contact support",
        paragraphs: [
          "If the activation is rejected, the QR code is unreadable, or the plan never appears, contact support with your order number.",
        ],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}
