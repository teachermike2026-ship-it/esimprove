import type { LegalLanguagePack } from "./types";

/**
 * English legal documents (version 2.0). The French, Spanish and Arabic files
 * mirror these sections one-for-one. Keep them in step when anything changes.
 */
export const en: LegalLanguagePack = {
  profile: () => ({
    heading: "Seller information",
    rows: [
      ["Trading name", "ESIMPROVE"],
      ["Who operates it", "ESIMPROVE is an online brand run by an individual operator. It is not a registered company."],
      ["Operator's legal name", "Not yet published. It will be added here before card payments are enabled."],
      ["Operating country", "Vietnam (provisional operating location)"],
      ["Postal address", "Not yet published. There is no public office; the service runs online."],
      ["Company / VAT number", "None. ESIMPROVE does not hold or claim a company registration or VAT number."],
      ["Email (support, complaints, privacy)", "{email}"],
      ["Telephone", "No telephone line. Support is provided by email."],
    ],
    note: "We publish only details we can verify. Missing details are marked as not yet published rather than invented.",
    translationNote:
      "This document is available in English, French, Spanish and Arabic. The versions have the same meaning. If they differ, the English version applies unless the law of your country says otherwise, and any genuine ambiguity is read in your favour.",
  }),

  docs: {
    terms: () => ({
      title: "Terms of Service",
      description: "The contract between you and ESIMPROVE: orders, delivery, payment, your rights, acceptable use and liability.",
      intro:
        "These terms are the agreement between you and ESIMPROVE when you use this website or buy an eSIM plan. Please read them with the eSIM service, payment, refund and privacy documents they refer to. Nothing in these terms removes rights you have under the mandatory consumer protection or data protection laws of the country where you live.",
      sections: [
        {
          id: "who",
          heading: "1. Who we are and how to reach us",
          blocks: [
            "ESIMPROVE is an online store for prepaid travel eSIM data plans. It is an online brand run by an individual operator from Vietnam, and it is not a registered company. The seller details we can currently publish are in the [legal notice](/legal/notice).",
            "You can contact us at {email}. We answer by email; there is no telephone line.",
          ],
        },
        {
          id: "documents",
          heading: "2. Documents that form our agreement",
          blocks: [
            "When you place an order, the following documents apply in the version shown at checkout:",
            {
              ul: [
                "these Terms of Service;",
                "the [eSIM service and delivery terms](/legal/esim-service) (compatibility, coverage, activation and validity);",
                "the [payment terms](/legal/payments) (card and USDT payments);",
                "the [refund, cancellation and withdrawal policy](/legal/refunds).",
              ],
            },
            "The [privacy policy](/legal/privacy) and [cookie policy](/legal/cookies) explain how we handle personal data. They are information notices, not contract terms you agree to.",
            "The version you accepted is recorded with your order. Later changes apply only to later orders, unless the law requires otherwise.",
          ],
        },
        {
          id: "eligibility",
          heading: "3. Who can buy",
          blocks: [
            "You must be legally able to enter into a contract where you live, which normally means having reached the age of majority. The service is not directed at children.",
            "You must not buy or use the service if the law, or international sanctions that apply to you or to us, forbid it.",
          ],
        },
        {
          id: "service",
          heading: "4. What we sell",
          blocks: [
            "We sell prepaid eSIM data plans for travel. A plan gives a data allowance for a stated period in the countries listed on the plan page. Unless the plan page says otherwise, plans are **data only**: they do not include a phone number, calls or SMS, and they **cannot be used to call emergency services**.",
            "The mobile data is supplied by a wholesale eSIM provider and carried by local mobile networks. ESIMPROVE is the seller you contract with. We are not a mobile network operator. The [eSIM service terms](/legal/esim-service) explain what this means for coverage, speed and availability.",
            "Before you buy, check that your device supports eSIM and is not locked to a carrier. Use the [compatibility guide](/compatibility) and the plan details.",
          ],
        },
        {
          id: "prices",
          heading: "5. Prices",
          blocks: [
            "Prices are shown in US dollars (USD). The total at checkout is the total you pay ESIMPROVE. We do not add charges after you order, and we do not add a surcharge for the payment method you choose.",
            "For USDT payments, the order total is converted at 1 USDT = 1 USD. To identify your transfer, a unique amount of at most 0.0099 USDT (less than one US cent) is added. See the [payment terms](/legal/payments).",
            "Your bank, card issuer, wallet or exchange may charge its own fees, such as currency conversion or blockchain network (gas) fees. Those fees are between you and that provider.",
            "If an obvious pricing error happens, we will tell you before the eSIM is delivered. You can then confirm the order at the correct price or cancel it for a full refund.",
          ],
        },
        {
          id: "order",
          heading: "6. How an order becomes a contract",
          blocks: [
            {
              ol: [
                "You choose a plan, review the order summary and total, and accept these terms.",
                "You ask us to supply the eSIM immediately and acknowledge how this affects your withdrawal right (see section 9).",
                "You press **Buy now**. This is an order with an obligation to pay.",
                "The contract is formed when your payment is confirmed: for cards, when the payment provider approves the payment; for USDT, when the transfer is verified on BNB Smart Chain.",
              ],
            },
            "We may refuse an order before payment is confirmed. For example, a plan may be temporarily unavailable or the order may look fraudulent. If we refuse an order after you have paid, we refund you in full.",
            "Checkout is switched off for a plan when our supplier cannot fulfil it at that moment. This is so we never take payment for an eSIM we cannot deliver.",
          ],
        },
        {
          id: "delivery",
          heading: "7. Delivery",
          blocks: [
            "Once payment is confirmed, we order your eSIM from our supplier automatically. Your eSIM details are usually available within a few minutes. They are shown on your order page (through the secure link shown after checkout) and in your account if you have one. They include the QR code and the manual installation details.",
            "If the supplier cannot issue the eSIM, your payment stays safe and the order is reviewed by a person. We then either deliver the eSIM or refund you in full. We never show an order as delivered unless the supplier has actually issued the eSIM.",
          ],
        },
        {
          id: "your-responsibilities",
          heading: "8. Your responsibilities",
          blocks: [
            {
              ul: [
                "Give a correct email address and keep your order link and account secure. Anyone with the link or QR code can try to install the eSIM.",
                "Check device compatibility and the plan details (countries, data, validity, activation deadline) before you buy.",
                "Follow the installation instructions, and do not delete the eSIM from your device until your plan has ended. Many eSIMs can be installed only once.",
                "Comply with the laws of the countries you travel to and with the [acceptable use rules](#acceptable-use).",
              ],
            },
          ],
        },
        {
          id: "withdrawal",
          heading: "9. Your right to cancel (withdrawal)",
          blocks: [
            "Consumers in the European Union, the United Kingdom and some other countries normally have a 14-day right to cancel online purchases. For digital content and services, the law allows supply to begin straight away if you ask for it and acknowledge that you will lose the right to cancel once the content or service has been supplied.",
            "At checkout we ask you to confirm that you want your eSIM delivered immediately. You also acknowledge that you lose the right to cancel for a change of mind once the eSIM has been **installed or activated**. Until then, you can cancel and get a full refund (see the [refund policy](/legal/refunds)).",
            "If your local law treats an eSIM plan as a service that you may cancel within 14 days even after it has started, we will honour that. You then pay only for the part of the plan already used, as explained in the refund policy.",
          ],
        },
        {
          id: "faults",
          heading: "10. If something goes wrong",
          blocks: [
            "If your eSIM does not work as described because of a fault on our side or our supplier's, contact us. We will help you troubleshoot, then provide a working replacement, or give a full or partial refund, depending on what was supplied. This does not limit any remedy your local law gives you for faulty or misdescribed digital products or services.",
          ],
        },
        {
          id: "acceptable-use",
          heading: "11. Acceptable use",
          blocks: [
            "You must not use the website or an eSIM:",
            {
              ul: [
                "for anything illegal, including fraud, money laundering, or evading sanctions;",
                "to send spam, attack networks or systems, or disrupt other users;",
                "to resell or redistribute eSIMs commercially without our written agreement;",
                "in a way that breaks the fair-use limits shown on the plan page or that the network applies, for example running servers or automated traffic, or using SIM boxes;",
                "with stolen payment methods, someone else's wallet without permission, or false information;",
                "to probe, scrape or overload the website, or to get around its security.",
              ],
            },
            "Networks may slow, restrict or stop service that breaks their rules. We may refuse or cancel orders linked to fraud or abuse.",
          ],
        },
        {
          id: "suspension",
          heading: "12. Suspension and account closure",
          blocks: [
            "We may suspend an account or refuse service where there is a serious breach of these terms, suspected fraud, or a legal requirement. Where we can, we will tell you why and give you a chance to respond. If we stop a service you have paid for and you are not at fault, we refund the unused part.",
            "You can close your account at any time by contacting us or using the [privacy request form](/privacy/request).",
          ],
        },
        {
          id: "liability",
          heading: "13. Our responsibility to you",
          blocks: [
            "We are responsible for supplying the eSIM plan as described and with reasonable care and skill.",
            "Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot legally be limited.",
            "Mobile coverage depends on local networks. We are not responsible for losses that we could not reasonably foresee when you ordered, for business losses (a consumer plan is for personal use), or for interruptions caused by events beyond our reasonable control (section 14). Subject to the previous paragraph, if we are responsible for a loss, our liability is limited to the price you paid for the affected order. This limit does not reduce any statutory remedy you have as a consumer.",
          ],
        },
        {
          id: "force-majeure",
          heading: "14. Events beyond our control",
          blocks: [
            "We are not responsible for delays or failures caused by events we could not reasonably prevent. Examples are network outages, government restrictions on mobile services, natural disasters, war, or a failure of the blockchain network. If such an event prevents us from delivering a plan you paid for, we refund you.",
          ],
        },
        {
          id: "complaints",
          heading: "15. Complaints and disputes",
          blocks: [
            "Please contact us first at {email}; most problems can be solved quickly. Our complaint process and response times are in the [legal notice](/legal/notice#complaints).",
            "You can also contact the consumer protection authority or an alternative dispute resolution body in your country. The European Commission's online dispute resolution platform closed on 20 July 2025, so we do not link to it.",
          ],
        },
        {
          id: "law",
          heading: "16. Applicable law and courts",
          blocks: [
            "These terms are governed by the law of Vietnam, where ESIMPROVE is operated. If you are a consumer, you keep the protection of the mandatory rules of the country where you live, and you can bring a claim in the courts there where the law allows it.",
          ],
        },
        {
          id: "changes",
          heading: "17. Changes to these terms",
          blocks: [
            "We may update these terms, for example to reflect changes in the law or in our service. The new version will show a new version number and date. It applies only to orders placed after it is published. We will not change the terms of an order you have already placed without your agreement.",
          ],
        },
      ],
    }),

    esim: () => ({
      title: "eSIM service and delivery terms",
      description: "Compatibility, coverage, activation, validity, delivery and what happens if an eSIM cannot be delivered.",
      intro:
        "This page explains how ESIMPROVE eSIM plans work and their limits, so you can decide whether a plan is right for your trip. It forms part of our [Terms of Service](/legal/terms).",
      sections: [
        {
          id: "what",
          heading: "1. What an eSIM plan is",
          blocks: [
            "An eSIM is a digital SIM that you install on a compatible phone, tablet or other device by scanning a QR code or entering details by hand. Our plans are prepaid mobile data plans for travel. Each plan page shows the countries covered, the data allowance, the validity period, the networks, the activation rule and the activation deadline.",
            "Unless the plan page says otherwise, plans are **data only**. There is no phone number, calls or SMS, and you **cannot call emergency numbers** with them. Keep another way to reach emergency services.",
          ],
        },
        {
          id: "compatibility",
          heading: "2. Device compatibility and unlocking",
          blocks: [
            "Your device must:",
            {
              ul: [
                "support eSIM (some models sold in certain regions do not, even if the same model elsewhere does);",
                "be **carrier-unlocked**, meaning not locked to one mobile operator;",
                "support the mobile network bands used in your destination.",
              ],
            },
            "Check the [compatibility guide](/compatibility) and your device settings before buying. Our compatibility information is guidance; the device manufacturer and your carrier have the final word. If you discover your device is incompatible **before** installing the eSIM, we refund you in full.",
          ],
        },
        {
          id: "coverage",
          heading: "3. Coverage, networks and speed",
          blocks: [
            {
              ul: [
                "Plans use partner networks in each country. Which networks are used and whether 4G/5G is available depend on the local network and the location. Coverage can be weaker indoors, underground, at sea, in the air and in remote areas.",
                "Speeds are not guaranteed. They depend on the network, congestion, your device and the plan's fair-use rules. Some plans reduce speed after a daily allowance (the plan page says so).",
                "Your internet traffic may be routed through another country. Websites may then see a different country than the one you are in.",
                "Some countries restrict certain apps or services (for example voice-over-internet calls). We cannot control local restrictions.",
              ],
            },
          ],
        },
        {
          id: "validity",
          heading: "4. Activation, validity and data",
          blocks: [
            {
              ul: [
                "**When validity starts.** The plan page tells you whether the validity period starts when the eSIM is installed, or when it first connects to a supported network in a covered country.",
                "**Activation deadline.** Most plans must be activated within a set number of days after purchase (often 180). The plan page shows the deadline. An unused plan expires after it.",
                "**Data.** Total-data plans end when the data or the validity runs out, whichever comes first. Daily plans give an allowance per day; after it, speed is reduced or service pauses until the next day, as stated on the plan page. Unused data does not carry over and is not refunded pro rata.",
                "**Top-ups.** ESIMPROVE does not sell top-ups at the moment. If you need more data, buy a new plan.",
              ],
            },
          ],
        },
        {
          id: "install",
          heading: "5. Installing your eSIM",
          blocks: [
            {
              ol: [
                "Install the eSIM before you travel, while connected to Wi-Fi, by scanning the QR code on your order page or entering the SM-DP+ address and activation code by hand.",
                "Do not delete the eSIM after installing it. Many eSIMs can be installed only once, and a deleted eSIM may not be recoverable.",
                "When you arrive, select the eSIM for mobile data and turn on **data roaming** for that line.",
                "Keep your QR code private. Anyone who has it may be able to install the eSIM first.",
              ],
            },
          ],
        },
        {
          id: "delivery",
          heading: "6. Delivery times",
          blocks: [
            "We order your eSIM from our supplier as soon as your payment is confirmed. The eSIM details usually appear on your order page within a few minutes. Card payments are confirmed when the payment provider approves them. USDT payments are confirmed after 15 confirmations on BNB Smart Chain, which normally takes less than a minute after your transfer.",
            "We do not currently send the eSIM by email. Keep the secure order link shown after checkout, or create an account and find your eSIMs under **My eSIMs**.",
          ],
        },
        {
          id: "failure",
          heading: "7. If an eSIM cannot be delivered or activated",
          blocks: [
            {
              ul: [
                "If our supplier cannot issue your eSIM (for example because a package is out of stock), your order is put on hold for a person to review, and your payment stays safe. We will then deliver the eSIM or refund you in full. We never mark an order as delivered without real eSIM details from the supplier.",
                "If the eSIM is issued but does not connect, contact us with your order number. We will check the eSIM's status with our supplier, help you troubleshoot, and replace or refund it when the problem is on our side or the supplier's.",
                "If activation fails because the device is incompatible or locked, or because the eSIM was deleted, a refund may not be possible once the eSIM has been installed. See the [refund policy](/legal/refunds).",
              ],
            },
          ],
        },
        {
          id: "supplier",
          heading: "8. Supplier and network dependency",
          blocks: [
            "eSIM profiles are issued by our wholesale supplier, and service is carried by local networks. Their maintenance, outages or changes can interrupt service. Where an interruption means a plan you paid for cannot be used as described, we will offer a replacement or a refund for the affected part.",
          ],
        },
      ],
    }),

    payments: () => ({
      title: "Payment terms",
      description: "How card and USDT (BEP-20) payments work, when an order counts as paid, and what happens with wrong, late or partial payments.",
      intro:
        "This page explains the payment methods ESIMPROVE accepts, when your order counts as paid, and how payment problems are handled. It forms part of our [Terms of Service](/legal/terms).",
      sections: [
        {
          id: "methods",
          heading: "1. Payment methods",
          blocks: [
            {
              ul: [
                "**Card payments.** When available, card payments are processed by our payment provider, Whop, in its secure payment form. Your card details go directly to the provider and are never seen or stored by ESIMPROVE. Card payment is shown as \"coming soon\" at checkout until it is switched on.",
                "**USDT (BEP-20) on BNB Smart Chain.** The only cryptocurrency we accept is Tether USD (USDT) as the BEP-20 token on BNB Smart Chain (chain ID 56). The token contract is 0x55d398326f99059fF775485246999027B3197955.",
              ],
            },
            "We do not charge extra for either payment method.",
          ],
        },
        {
          id: "usdt-amount",
          heading: "2. How the USDT amount is set",
          blocks: [
            "Prices are in US dollars. For USDT we use a fixed rate of **1 USDT = 1 USD**; we do not apply a market exchange rate or a spread.",
            "To match your transfer to your order automatically, we add a unique amount of **at most 0.0099 USDT** (less than one US cent) to the order total. The exact amount to send is shown on the payment page before you send anything.",
            "You pay any network (gas) fee charged by BNB Smart Chain, which your wallet shows before you confirm. The amount that reaches our address must equal the exact amount shown. If you send from an exchange, make sure its withdrawal fee is not deducted from that amount.",
          ],
        },
        {
          id: "usdt-how",
          heading: "3. How to pay with USDT",
          blocks: [
            {
              ol: [
                "After you press **Buy now**, the payment page shows the receiving address, the network (BNB Smart Chain, BEP-20) and the exact USDT amount.",
                "Send exactly that amount, in one transfer, on BNB Smart Chain, within **30 minutes**.",
                "We detect the transfer automatically. You can also paste the transaction hash on the payment page.",
                "Your order is marked **paid** after the transfer has **15 block confirmations** and has been checked independently: right token, right network, right address and exact amount.",
              ],
            },
            {
              callout:
                "Blockchain transfers cannot be reversed. Check the network (BNB Smart Chain / BEP-20), the token (USDT) and the address before you send. We never ask you to send to any other address or network, and we never ask for your private key or recovery phrase.",
            },
          ],
        },
        {
          id: "paid",
          heading: "4. When an order counts as paid",
          blocks: [
            {
              ul: [
                "**Card:** when the payment provider confirms a successful payment to us.",
                "**USDT:** when an exact-amount transfer to our address has 15 confirmations on BNB Smart Chain within the payment window.",
              ],
            },
            "Seeing a transaction in your wallet as \"sent\" does not by itself mean the order is paid. The order page shows the current status.",
          ],
        },
        {
          id: "problems",
          heading: "5. Wrong, late, partial or duplicate USDT payments",
          blocks: [
            {
              table: {
                caption: "What happens in each case",
                head: ["Situation", "What we do"],
                rows: [
                  ["**Underpayment** (less than the exact amount)", "The order is not paid automatically. Your transfer is recorded and reviewed by a person. Contact us: you can send the remaining amount or ask for a refund of what you sent."],
                  ["**Overpayment** (more than the exact amount)", "The order is reviewed by a person. We deliver the order and refund the excess to you, or refund everything if you prefer."],
                  ["**Late payment** (after the 30-minute window)", "We keep watching for late transfers for 24 hours. A late transfer is never lost: it is recorded and reviewed, and we deliver the order or refund you."],
                  ["**Duplicate payment** (paid twice)", "We refund the extra payment in full."],
                  ["**Wrong network or token** (for example USDT on another chain, or another coin)", "These transfers are not detected. Contact us with the transaction hash. If the funds reached an address we control and we can recover them safely, we return them. Funds sent to an address we do not control, or on a network we cannot access, may be permanently lost; we cannot reverse blockchain transfers."],
                  ["**Wrong address**", "Funds sent to any address other than the one on your payment page do not reach us, and we cannot recover them."],
                ],
              },
            },
          ],
        },
        {
          id: "crypto-refunds",
          heading: "6. How USDT refunds work",
          blocks: [
            {
              ul: [
                "USDT refunds are paid in USDT (BEP-20) on BNB Smart Chain. We calculate them in US dollars at the same 1 USDT = 1 USD rate, so the value you get back is not affected by market movements.",
                "We send refunds to the wallet the payment came from, unless you give us a different address on BNB Smart Chain that you control. Refunds to exchange deposit addresses can fail; tell us if you paid from an exchange.",
                "We pay the network fee for refunds we send.",
                "Because blockchain transfers are irreversible, we may ask you to confirm the refund address from the email used for the order.",
              ],
            },
          ],
        },
        {
          id: "crypto-notes",
          heading: "7. Important information about cryptocurrency",
          blocks: [
            {
              ul: [
                "USDT is a stablecoin issued by a private company. It is not legal tender, and its value can differ from one US dollar.",
                "We accept USDT only as a way to pay for eSIM plans. We do not exchange, hold or invest cryptocurrency for customers, and nothing on this site is financial advice.",
                "Blockchain transactions are public. Your sending address and the transaction are visible on the blockchain permanently (see the [privacy policy](/legal/privacy)).",
                "You are responsible for following the cryptocurrency and tax rules of your own country.",
              ],
            },
          ],
        },
        {
          id: "disputes",
          heading: "8. Card chargebacks and payment disputes",
          blocks: [
            "If there is a problem with a card payment, please contact us first; we can usually fix it faster than a chargeback. You keep any right you have to dispute a card payment with your bank. If a dispute is opened, we may share order, delivery and support records with the payment provider to respond to it.",
            "Crypto payments cannot be charged back. Payment problems with USDT are handled directly with us as described above.",
          ],
        },
      ],
    }),

    refunds: () => ({
      title: "Refund, cancellation and withdrawal policy",
      description: "When you can cancel and get money back, how partial refunds are calculated, and how refunds are paid.",
      intro:
        "This policy explains when you can cancel an eSIM order and get your money back, and how we process refunds. It forms part of our [Terms of Service](/legal/terms). Where the law of your country gives you more rights, those rights apply.",
      sections: [
        {
          id: "summary",
          heading: "1. Summary",
          blocks: [
            {
              table: {
                caption: "When you get a refund",
                head: ["Situation", "Refund"],
                rows: [
                  ["eSIM not yet installed or activated (any reason, including change of mind), and the activation deadline has not passed", "Full refund"],
                  ["We could not deliver the eSIM, or delivered it late and you no longer want it", "Full refund"],
                  ["The eSIM does not work because of a fault on our side or our supplier's, and we cannot fix or replace it", "Full or partial refund (section 4)"],
                  ["Plan materially different from its description (wrong country, data or validity)", "Replacement, or full or partial refund"],
                  ["Charged twice, or paid more than the exact amount", "Refund of the extra amount"],
                  ["Change of mind after the eSIM was installed or activated", "Not normally refundable (but see section 3)"],
                  ["Device incompatible or locked, found only after installation", "Not normally refundable"],
                ],
              },
            },
          ],
        },
        {
          id: "before",
          heading: "2. Cancelling before installation or activation",
          blocks: [
            "You can cancel for any reason and get a full refund as long as the eSIM has **not been installed or activated** and its activation deadline has not passed. We check the eSIM's status with our supplier before refunding. Once a refund is approved, we cancel the eSIM, and it can no longer be used.",
            "This is more generous than the minimum 14-day withdrawal right that applies in the EU and UK, because it is not limited to 14 days.",
          ],
        },
        {
          id: "withdrawal",
          heading: "3. The statutory 14-day withdrawal right",
          blocks: [
            "At checkout you ask us to deliver the eSIM immediately. You also acknowledge that you lose the right to withdraw for a change of mind once the eSIM is installed or activated. This is how the law allows digital products to be supplied straight away.",
            "If you live in a country whose law lets you withdraw within 14 days even after an eSIM plan has started (because the plan is treated as a service), you can still do so. You then pay only for what has already been supplied. We calculate this as the larger of the share of the data used and the share of the validity period that has passed, and refund the rest.",
            "To withdraw, send us a clear statement by email ({email}) or use the contact form, with your order number. You do not have to give a reason.",
          ],
        },
        {
          id: "faults",
          heading: "4. Faulty or misdescribed eSIMs",
          blocks: [
            "If an eSIM does not work as described because of a fault on our side or our supplier's, we will first try to fix it or provide a replacement. If that is not possible within a reasonable time:",
            {
              ul: [
                "if you could not use the plan at all, we refund you in full;",
                "if you could use part of it, we refund the unused part, calculated as in section 3.",
              ],
            },
            "Problems caused by local network coverage that is in line with what the plan page described, by an incompatible or locked device, or by deleting the eSIM are not faults of the eSIM. We will still help you as far as we can.",
          ],
        },
        {
          id: "how",
          heading: "5. How to ask for a refund",
          blocks: [
            "Email {email} or use the [contact page](/contact), and include:",
            {
              ul: [
                "your order number and the email address used for the order;",
                "what went wrong and when, with any error messages or screenshots;",
                "whether the eSIM was installed or used;",
                "for USDT refunds: the wallet address to refund, if it is different from the one you paid from.",
              ],
            },
            "Never send us your password, one-time codes, card number, private key or recovery phrase.",
          ],
        },
        {
          id: "processing",
          heading: "6. How and when refunds are paid",
          blocks: [
            {
              ul: [
                "We reply to refund requests within 5 business days, and pay approved refunds within 14 days.",
                "Card payments are refunded to the same card through the payment provider. Your bank may take a few more days to show it.",
                "USDT payments are refunded in USDT (BEP-20) as described in the [payment terms](/legal/payments#crypto-refunds). We pay the refund network fee.",
                "If we refuse a request, we explain why and tell you how to complain. A refusal never removes a right you have under mandatory law.",
              ],
            },
          ],
        },
      ],
    }),

    privacy: (ctx) => ({
      title: "Privacy policy",
      description: "What personal data ESIMPROVE collects, why, who receives it, how long it is kept, and your rights.",
      intro:
        "This policy explains how ESIMPROVE handles your personal data when you use the website, buy an eSIM, pay, or contact us. We collect as little as we need to sell and deliver eSIMs and to keep the service secure.",
      sections: [
        {
          id: "controller",
          heading: "1. Who is responsible",
          blocks: [
            "The data controller is the individual operator of ESIMPROVE, an online brand operated from Vietnam (see the [legal notice](/legal/notice)). For any privacy question or request, contact {email} or use the [privacy request form](/privacy/request).",
            "ESIMPROVE has not appointed a representative in the European Union or the United Kingdom. You can contact us directly by email from anywhere.",
          ],
        },
        {
          id: "data",
          heading: "2. What we collect",
          blocks: [
            {
              table: {
                caption: "Personal data we process",
                head: ["Category", "Examples", "Source"],
                rows: [
                  ["Order data", "email, name, country of residence, plan, quantity, prices, order status, terms version accepted, your request for immediate supply", "You, at checkout"],
                  ["eSIM data", "ICCID, activation code / QR code, eSIM status, expiry date", "Our eSIM supplier"],
                  ["Card payment data", "payment amount, status and the provider's payment reference. **We never receive your card number.**", "Payment provider"],
                  ["USDT payment data", "the wallet address you paid from, transaction hash, amount and confirmations", "BNB Smart Chain (public)"],
                  ["Account data", "name, email, password (stored only as a secure hash), sign-in sessions", "You"],
                  ["Support and privacy requests", "your messages and our replies, request status", "You"],
                  ["Consent records", "your cookie and marketing choices and the terms version you accepted, with a timestamp", "You"],
                  ["Security data", "hashed session tokens, a keyed hash of your network address for rate limiting, audit logs", "Your device / our systems"],
                  ["Analytics (only with consent)", "pseudonymous visitor and session IDs (stored hashed), pages viewed, device and browser type, approximate country", "Your device"],
                ],
              },
            },
            "We do not ask for identity documents, date of birth, precise location or contacts.",
          ],
        },
        {
          id: "purposes",
          heading: "3. Why we use it and our legal basis",
          blocks: [
            {
              table: {
                caption: "Purposes and legal bases",
                head: ["Purpose", "Legal basis (where EU/UK data protection law applies)"],
                rows: [
                  ["Take and deliver your order, provide your eSIM, support and refunds", "Performance of a contract"],
                  ["Verify payments and prevent fraud and abuse", "Legitimate interests (protecting customers and the business); contract"],
                  ["Keep order, payment and refund records", "Legal obligation (tax and accounting); legitimate interests (handling disputes)"],
                  ["Run your account and keep it secure", "Contract; legitimate interests (security)"],
                  ["Optional analytics", "Consent, which you can withdraw at any time"],
                  ["Optional marketing emails", "Consent; you can unsubscribe at any time"],
                  ["Respond to privacy requests and legal claims", "Legal obligation; legitimate interests"],
                ],
              },
            },
            "Where the law of your country requires your consent for a particular use, we ask for it, and you can withdraw it at any time. Withdrawing consent does not affect processing that took place before.",
          ],
        },
        {
          id: "recipients",
          heading: "4. Who receives your data",
          blocks: [
            "We share data only with providers that help us run the service, and only what each one needs:",
            {
              table: {
                caption: "Service providers",
                head: ["Provider", "Role", "Data"],
                rows: [
                  ["Netlify (United States)", "Website hosting", "Technical request data needed to serve the site"],
                  ["Neon (database hosted on Amazon Web Services, United States)", "Database", "The data described in section 2"],
                  ["eSIM Access (our wholesale eSIM supplier)", "Issues eSIM profiles", "The package ordered and an anonymous transaction reference. **We do not send your name or email to the supplier.**"],
                  ["NodeReal (blockchain data provider)", "Reads BNB Smart Chain to verify USDT payments", "Queries about our receiving address and transaction hashes (public blockchain data)"],
                  ["Whop (card payment provider, when enabled)", "Processes card payments", "Data you enter in its payment form, plus the order reference and amount. Whop's own privacy policy also applies."],
                  ...(ctx.ga4Configured
                    ? [["Google (Google Analytics 4)", "Optional analytics, only with consent", "Analytics cookies and usage data"]]
                    : []),
                ],
              },
            },
            "We do not sell your personal data and do not use it for advertising profiles. We may disclose data if the law requires it, to establish or defend legal claims, or to prevent fraud.",
            "**Public blockchain.** If you pay with USDT, your transaction (including your sending address and the amount) is recorded permanently on BNB Smart Chain, which is public. Nobody, including us, can delete it.",
          ],
        },
        {
          id: "transfers",
          heading: "5. International transfers",
          blocks: [
            "ESIMPROVE is operated from Vietnam, and our main providers store data in the United States. Your data is therefore transferred outside your country. Where the law requires safeguards for such transfers, we rely on the data-processing terms our providers offer, including standard contractual clauses where available. Contact us for more information.",
          ],
        },
        {
          id: "retention",
          heading: "6. How long we keep data",
          blocks: [
            {
              ul: [
                "Orders, payments, refunds and invoices: as long as tax and accounting law requires, and while a dispute is possible.",
                "eSIM details: for as long as the related order is kept, so we can support you and handle refunds.",
                "Account data: while your account exists. When you ask us to delete it, we delete or anonymise it, except records we must keep by law.",
                "Support messages: while needed to resolve your request, plus a reasonable period for follow-up questions.",
                "Analytics: pseudonymous; analytics consent expires after at most 180 days.",
                "Sessions and rate-limit data: only until they expire.",
              ],
            },
          ],
        },
        {
          id: "rights",
          heading: "7. Your rights",
          blocks: [
            "Depending on where you live, you can ask to access, correct, delete or restrict your data, to receive a copy of it, to object to processing based on legitimate interests, and to withdraw consent. Use the [privacy request form](/privacy/request) or email {email}. We may need to verify your identity. We reply within one month, or sooner if your local law requires it.",
            "You can also complain to the data protection authority in your country. We would appreciate the chance to resolve your concern first.",
            "We do not make decisions about you based solely on automated processing that have legal or similarly significant effects. Automatic checks such as payment verification and rate limiting only decide whether a payment matches or a request is allowed. A person reviews any problem case.",
          ],
        },
        {
          id: "security",
          heading: "8. Security and data breaches",
          blocks: [
            "We protect data with measures such as encrypted connections, hashed passwords and session tokens, encrypted administrator secrets, access controls, signed payment notifications and audit logs. We never collect card numbers, private keys or recovery phrases.",
            "If a personal data breach happens, we will investigate it and limit its impact. We will notify the authorities and the people affected when and as the law requires.",
          ],
        },
        {
          id: "children",
          heading: "9. Children",
          blocks: [
            "The service is not directed at children, and we do not knowingly collect data from them. If you believe a child has given us data, contact us and we will delete it.",
          ],
        },
        {
          id: "changes",
          heading: "10. Changes",
          blocks: [
            "We will update this policy when our processing changes and show a new version number and date. Significant changes will be highlighted on the website.",
          ],
        },
      ],
    }),

    cookies: (ctx) => ({
      title: "Cookie policy",
      description: "The cookies and browser storage ESIMPROVE uses, and how to accept, refuse or withdraw consent.",
      intro:
        "This policy lists the cookies and similar browser storage used on ESIMPROVE and how you control them. We use only what is needed to run the site, plus optional analytics if you agree.",
      sections: [
        {
          id: "consent",
          heading: "1. How consent works",
          blocks: [
            "On your first visit, a banner lets you **reject** optional storage, **accept** it, or **choose** categories. All three options are equally easy. Optional analytics does not load until you agree. Refusing it does not affect the cart, checkout or your account. You can change your choice at any time with **Cookie settings** in the footer.",
            "Your choice is stored in your browser with the policy version. We also keep a pseudonymous server-side record of it so we can honour it. A missing or outdated choice is never treated as consent. Analytics consent expires after 180 days.",
          ],
        },
        {
          id: "necessary",
          heading: "2. Strictly necessary storage",
          blocks: [
            "These items are needed for features you ask for (sign-in, cart, language, remembering your consent choice). They do not need consent.",
            {
              table: {
                caption: "Strictly necessary cookies and storage",
                head: ["Name", "Type", "Purpose", "Duration"],
                rows: [
                  ["esimprove_session", "Cookie (HTTP-only)", "Keeps you signed in securely", "Up to 30 days (10 minutes during two-step sign-in)"],
                  ["cart_token", "Cookie (HTTP-only)", "Keeps the items in your cart", "30 days"],
                  ["esimprove_locale", "Cookie", "Remembers the language you chose", "1 year"],
                  ["es_consent_v1", "Local storage", "Remembers your cookie choice and its version", "Until you change it or clear site data"],
                  ["es_consent_id", "Local storage", "Random ID linking your browser to your consent record (stored by us only as a hash)", "Until you clear site data"],
                ],
              },
            },
          ],
        },
        {
          id: "analytics",
          heading: "3. Optional analytics (only with consent)",
          blocks: [
            {
              table: {
                caption: "Optional analytics storage",
                head: ["Name", "Type", "Purpose", "Duration"],
                rows: [
                  ["es_analytics_visitor", "Local storage", "Random pseudonymous visitor ID for our own analytics (stored by us only as a hash)", "Until you clear site data"],
                  ["es_analytics_session", "Session storage", "Groups page views within one visit", "Until you close the tab"],
                  ...(ctx.ga4Configured
                    ? [["_ga, _ga_*", "Cookies (Google)", "Google Analytics 4 measurement, with advertising features turned off", "Up to 2 years"]]
                    : []),
                ],
              },
            },
            ctx.ga4Configured
              ? "Google Analytics 4 loads only after you accept analytics."
              : "Google Analytics is not currently used on this site.",
            "We do not use advertising, remarketing or social media tracking cookies. If that ever changes, we will update this policy first and ask for your consent.",
          ],
        },
        {
          id: "third-party",
          heading: "4. Payment pages",
          blocks: [
            "When card payment is available and you choose it, the payment form is provided by our payment provider (Whop). It may use its own cookies, needed for security and fraud prevention, under its own policies.",
          ],
        },
        {
          id: "control",
          heading: "5. Changing your choice",
          blocks: [
            "Use **Cookie settings** in the footer to change or withdraw consent. Withdrawing stops analytics from then on. You can also delete cookies and site data in your browser settings; you may then need to sign in again and choose again. We also respect the Do Not Track and Global Privacy Control signals by not collecting analytics.",
          ],
        },
      ],
    }),

    notice: () => ({
      title: "Legal notice, contact and complaints",
      description: "Who operates ESIMPROVE, how to contact us, and how complaints are handled.",
      intro:
        "This page gives the seller information we can currently publish and explains how to contact us and make a complaint.",
      sections: [
        {
          id: "seller",
          heading: "1. Seller",
          blocks: [
            "ESIMPROVE is an online brand selling prepaid travel eSIM data plans. It is run by an individual operator from Vietnam, and it is not a registered company. It has no company registration or VAT number. The full seller details are in the box below. Details we have not yet published are marked as such rather than invented.",
          ],
        },
        {
          id: "contact",
          heading: "2. Contact",
          blocks: [
            "Email: {email}. This one address handles support, refunds, complaints and privacy requests. We do not offer telephone support. You can also use the [contact page](/contact) or the [privacy request form](/privacy/request).",
          ],
        },
        {
          id: "complaints",
          heading: "3. How we handle complaints",
          blocks: [
            {
              ol: [
                "Send your complaint to {email} with your order number, what happened, and what you would like us to do.",
                "We acknowledge it within 3 business days.",
                "We give you a full answer within 14 days. If we need more time, for example to get information from our supplier, we tell you why and when to expect an answer.",
                "If you are not satisfied, you can ask for your complaint to be reviewed again, or contact the consumer protection authority or an alternative dispute resolution body in your country.",
              ],
            },
            "Complaining to us does not affect your legal rights, including your right to go to court.",
          ],
        },
        {
          id: "content",
          heading: "4. Website content",
          blocks: [
            "We take care that plan descriptions, coverage and prices are accurate. They are based on information from our supplier, and networks can change. If you find an error, please tell us. Trademarks such as device and network names belong to their owners and are used only to describe compatibility and coverage.",
          ],
        },
      ],
    }),

    accessibility: () => ({
      title: "Accessibility statement",
      description: "How ESIMPROVE works to be usable by everyone, known limitations, and how to report a barrier.",
      intro:
        "We want everyone to be able to buy and use an eSIM through ESIMPROVE, including people who use assistive technology.",
      sections: [
        {
          id: "measures",
          heading: "1. What we do",
          blocks: [
            {
              ul: [
                "We use semantic page structure, labelled forms and visible focus indicators, and the site can be used with a keyboard.",
                "We use text alternatives for meaningful images, and colours chosen for readable contrast.",
                "The site supports right-to-left reading in Arabic and adapts to phone screens.",
                "eSIM details can be installed by hand as well as by QR code.",
              ],
            },
            "Our goal is to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. We have not had an independent accessibility audit, so we do not claim full conformance.",
          ],
        },
        {
          id: "limits",
          heading: "2. Known limitations",
          blocks: [
            "Some content comes from third parties, such as supplier plan descriptions and the card payment form, and may not meet the same standard. Plan feature text from our supplier is currently shown in English.",
          ],
        },
        {
          id: "feedback",
          heading: "3. Report a barrier",
          blocks: [
            "If you have trouble using any part of the site, email {email} and tell us the page and the problem. We will reply within 5 business days and help you complete your purchase another way if needed.",
          ],
        },
      ],
    }),
  },
};
