/**
 * Editable marketing copy that is not owned by the catalogue/database layer.
 *
 * Promotions must stay disabled until a real coupon exists and has been
 * tested end to end. Never show a discount code that the checkout cannot
 * redeem.
 */
export const sitePromo = {
  enabled: false,
  text: "Get 10% off with code WELCOME10",
  href: "/plans",
} as const;

export const trustPoints = [
  { label: "Global coverage", detail: "Destinations across 8 regions" },
  { label: "Digital delivery", detail: "Installation details in your account" },
  { label: "No roaming surprise", detail: "Choose data and validity up front" },
  { label: "Secure checkout", detail: "Demo payments only — no card data stored" },
  { label: "Travel-ready", detail: "Install before you leave home" },
] as const;

export interface FaqItem {
  question: string;
  answer: string;
}

export const faqItems: FaqItem[] = [
  {
    question: "What is an eSIM?",
    answer:
      "An eSIM is a digital SIM built into a compatible device. Instead of inserting a plastic SIM, you install a mobile plan supplied as a QR code or manual activation code. The device can then use that plan for mobile data.",
  },
  {
    question: "Does my device support eSIM?",
    answer:
      "Support depends on the exact model, region, and carrier configuration. Look for “Add eSIM” or “Add mobile plan” in your device settings and confirm the device is carrier-unlocked. Use our compatibility checker as a starting point, then verify with the manufacturer.",
  },
  {
    question: "How do I choose a package?",
    answer:
      "Start with your destination, then compare data allowance, validity, coverage, and price. A short city break usually needs less data than a longer trip with hotspot use. Check the plan details before paying; displayed demo prices are illustrative and are not supplier quotes.",
  },
  {
    question: "When should I install my eSIM?",
    answer:
      "Install it before you travel while you have a reliable internet connection. Keep the QR code and manual activation details until the plan appears in your device’s SIM manager. Do not delete an eSIM unless you have confirmed it can be re-added.",
  },
  {
    question: "When does validity begin?",
    answer:
      "Validity rules differ by provider and product. Some plans start when the eSIM is first connected to a network; others start at purchase or installation. The final rule must be shown on the plan page before a live purchase. This demo does not sell live plans.",
  },
  {
    question: "Can I use my eSIM for hotspot?",
    answer:
      "Hotspot support depends on the specific plan and network. Check the plan’s capabilities before buying. A plan that allows hotspot use on one network may be restricted on another.",
  },
  {
    question: "Can I make calls or send SMS?",
    answer:
      "Many travel eSIMs are data-only. If calls or SMS matter for your trip, check the plan details and keep your primary SIM available for calls and messages where your device supports it.",
  },
  {
    question: "What should I do if activation fails?",
    answer:
      "Do not repeatedly scan or delete the eSIM. Check that the device is compatible and unlocked, confirm you are connected to the internet, and follow the installation guide for your platform. For a live order, contact the provider’s support channel with the order reference.",
  },
  {
    question: "How do I contact support?",
    answer:
      "The Contact page explains which support routes are available. Live email, chat, and telephone channels are not connected in this demo, so please use the installation and compatibility guides for now. Real support details will be published before launch.",
  },
  {
    question: "What is the refund policy?",
    answer:
      "Refund eligibility depends on whether the eSIM has been installed or used and on the final published terms. The legal pages in this build are drafts, not a live policy, and this demo does not take real payments. Review the final terms before purchasing a live plan.",
  },
];

export const testimonialPlaceholders = [
  {
    label: "Layout preview",
    text: "Reserved for an approved customer review. No review has been published or invented.",
  },
  {
    label: "Layout preview",
    text: "Reserved for an approved customer review. Ratings appear only when backed by a real review.",
  },
  {
    label: "Layout preview",
    text: "Reserved for an approved customer review. Customer names are never fabricated.",
  },
] as const;
