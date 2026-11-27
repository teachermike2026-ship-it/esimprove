# ESIMPROVE — Legal Compliance Audit & Documentation Report (2026-11-26)

Scope: every legal document and customer-facing disclosure in `C:\Users\hp\esimprove`. **Not deployed, not committed** (owner instruction: "no deployment"). This report is a compliance and documentation exercise, **not legal advice**. Items marked *requires professional confirmation* need a qualified lawyer in the relevant country.

Labels used throughout:
- **[CONFIRMED]** confirmed legal requirement, with the official text read during this audit;
- **[BEST PRACTICE]** recommended, not mandatory;
- **[UNCERTAIN]** applicability unclear;
- **[COUNSEL]** requires professional legal confirmation.

---

## 1. Existing documents audited

| Document / surface | Finding |
|---|---|
| `/legal/terms` (v1.0, English only) | Solid base (statutory-rights savings clause, business status). Missing: USDT payment rules, eSIM-specific limits (no emergency calls, IP routing, activation deadline), withdrawal-right mechanics, complaint procedure, ODR status. Hard-coded English. |
| `/legal/privacy` (v1.0) | Accurate about the site's own processing. Missing: named processors (Netlify, Neon, NodeReal, eSIM Access, Whop), public-blockchain permanence of USDT data, EU/UK representative status, breach handling. English only. |
| `/legal/refunds` (v1.0) | Fair (refund before activation). Missing: USDT refunds (address, network fee, rate), withdrawal right after activation where local law treats the plan as a service, proportional-refund formula, response times. |
| `/legal/cookies` (v1.0) | Accurate and detailed. Missing the `esimprove_locale` cookie (1 year). English only. |
| `/legal/accessibility`, `/legal/faq` | Accessibility statement English only. FAQ already translated. |
| Footer / legal menu | No payment, eSIM-service or legal-notice pages. |
| Checkout | Unticked, required terms checkbox (good). **No** express request / acknowledgement for immediate supply. Buttons read "Place order — pay with crypto". No links to refund, payment or eSIM terms before paying. |
| Order page | No record of the customer's acknowledgement (durable-medium confirmation). |
| Plan pages | **Misleading claim:** "Top-up available" was shown, but ESIMPROVE does not sell top-ups. **Removed.** |
| USDT amount | **Hidden-charge issue:** a random unique suffix of up to **0.9999 USDT** was added to the price and shown only after ordering. **Capped at 0.0099 USDT (< 1 US cent) and disclosed before ordering.** |
| Seller identity (`lib/legal-profile.ts`) | Honest: online brand, not a registered company, operated from Vietnam, contact@esimprove.com, no phone. The operator's legal name and geographic address are not recorded anywhere. |

## 2. Missing documents identified (now created)
- **Payment terms** (`/legal/payments`): card and USDT BEP-20, when an order counts as paid, wrong/late/partial/duplicate payments, crypto refunds, crypto disclosures, chargebacks.
- **eSIM service & delivery terms** (`/legal/esim-service`): compatibility and unlocking, coverage/speed/routing, activation and validity, installation, delivery times, failed delivery, supplier dependency. This is the digital version of a "shipping policy".
- **Legal notice, contact & complaints** (`/legal/notice`): seller information, single contact channel, complaint procedure with response times.
- **Acceptable use**: kept as section 11 of the Terms instead of a separate page, to avoid duplication.

## 3. Jurisdictions researched
- **Vietnam**: seller's operating country (from project configuration; the database timezone is also +07).
- **European Union**: targeted through the French and Spanish site versions and "country of residence" choices that include EU states.
- **United Kingdom**: English-language worldwide sales.
- **Customers' countries generally**: mandatory consumer-law savings clauses only.

## 4. Official sources consulted

| Source | Status |
|---|---|
| Directive 2011/83/EU (Consumer Rights), consolidated 28/05/2022, EUR-Lex: Art. 2(6), 6(1), 8(2), 8(7), 8(8), 9, 13(1), 14(3), 14(4)(b), 16(a), 16(m), 19, 22 | **Read, verified** |
| Directive (EU) 2019/770 (digital content): Art. 2, 3 | Partly verified (tool summary) |
| Regulation (EU) 2016/679 (GDPR): Art. 3(2), 13, 27; Recital 23 | Partly verified (summary). Art. 33-34 and 44-49 **not verified** |
| Directive 2002/58/EC (ePrivacy) Art. 5(3) | Verified in the 2002 text; the 2009 consolidated wording not read |
| Directive 93/13/EEC (unfair terms) Art. 3, 5, 6, 7, Annex 1(a)(b) | Verified |
| European Commission ODR site: platform **discontinued 20 July 2025** (Regulation (EU) 2024/3228) | Verified |
| UK Consumer Contracts Regulations 2013, **reg. 36** (services) and **reg. 37** (digital content), legislation.gov.uk | **Read verbatim, verified** |
| EU VAT Directive 2006/112/EC: place of supply, non-Union OSS | **Not verified** (consolidated text would not load) |
| Vietnam: Consumer Protection Law 19/2023/QH15; Personal Data Protection Law 2025 / Decree 13/2023; Decree 52/2013 and 85/2021 (e-commerce); Decree 101/2012 and 80/2016 (non-cash payments / crypto); 2025 digital-asset rules; individual-seller tax | **Not verified.** Official sites blocked automated access, and the government portal search returned no result. |

## 5. Documents created or revised (all v2.0, effective 26 Nov 2026)
Content is in `lib/legal-content/{en,fr,es,ar}.ts`, rendered by `components/legal-page.tsx`. All four languages share the same section ids and structure, enforced by a test.

- Terms of Service (17 sections, including acceptable use, suspension, liability carve-outs, force majeure, complaints, law and courts)
- eSIM service & delivery terms (new)
- Payment terms (new)
- Refund, cancellation & withdrawal policy (rewritten)
- Privacy policy (rewritten, with named processors)
- Cookie policy (rewritten; adds `esimprove_locale`)
- Legal notice, contact & complaints (new)
- Accessibility statement (rewritten, translated)

## 6. Languages completed
English, French, Spanish and Arabic for all eight documents, the seller-information block, navigation labels, checkout consent text and the order-page record.
- Arabic renders right-to-left; verified in the browser.
- French uses the statutory button wording "Commande avec obligation de paiement".
- Translation clause: English prevails unless local law says otherwise, and genuine ambiguity is read in the consumer's favour (consistent with Directive 93/13 Art. 5).

## 7. Checkout and consent improvements
1. **New required, unticked checkbox** asking for immediate supply and acknowledging loss of the change-of-mind withdrawal right once the eSIM is installed or activated. It is validated on the server (`lib/validation.ts`) and recorded per order as a consent event (`immediate_supply_withdrawal_ack`, v2.0). **[CONFIRMED]** CRD Art. 8(8), 14(4)(b), 16(a)/(m); UK CCR reg. 36-37.
2. **Buttons:** "Buy now — pay with USDT / by card" (FR: "Commande avec obligation de paiement — …"). **[CONFIRMED]** CRD Art. 8(2).
3. **Links before payment** to the eSIM service, payment and refund documents (terms and privacy were already linked). **[CONFIRMED]** CRD Art. 6(1).
4. **USDT unique suffix capped below one cent and disclosed before ordering.** **[CONFIRMED]** CRD Art. 6(1)(e), 22. Total price must be known, and there may be no extra payment without express consent.
5. **Order page** now shows the terms version and the acknowledgement as an order confirmation. **[UNCERTAIN]** whether a web page counts as a "durable medium" (Art. 8(7)); see risk 4.
6. **Checkout already blocks payment when the supplier cannot fulfil**, so no payment is taken for an undeliverable eSIM.

## 8. Seller protections implemented
- Clear customer responsibilities: compatibility, unlocking, keeping the QR code private, not deleting the eSIM.
- An acceptable-use section covering fraud, sanctions, resale, SIM boxes and network abuse.
- Suspension rules with due process.
- Liability limit (price of the affected order), with lawful carve-outs (death/injury, fraud, non-excludable liability, statutory remedies). **[COUNSEL]** whether a price-paid cap is enforceable against consumers in every target country.
- Force majeure, including blockchain-network failure.
- Wrong-network and wrong-address payments: clearly at the sender's risk, with a best-effort recovery promise.
- Chargeback cooperation clause.
- The immediate-supply acknowledgement, so change-of-mind refunds after activation are not owed (where the law allows).
- Incompatible devices discovered after installation are not refundable.

## 9. Consumer protections implemented
- **Refunds and withdrawal:**
  - full refund any time before installation or activation, with no 14-day limit;
  - honours a services-style 14-day withdrawal after activation where local law grants it, with a transparent proportional formula (the larger of the data-used share and the time-elapsed share);
  - full refund for non-delivery or supplier failure, and the order is never marked delivered without real eSIM data.
- **Clear statements on the product:**
  - data-only, **no emergency calls**;
  - speeds not guaranteed, traffic may route via another country;
  - local service restrictions.
- **USDT payments:**
  - fixed 1:1 rate with no spread;
  - refunds at the same rate, network fee paid by ESIMPROVE (consistent with CRD Art. 13(1): no refund costs to the consumer);
  - late payments are never lost, and under- or overpayments are reviewed by a person.
- **Response times:**
  - complaints acknowledged within 3 business days and answered within 14 days;
  - refunds answered within 5 business days and paid within 14 days.
- **Privacy:**
  - no name or email sent to the supplier;
  - named processors;
  - rights and complaint routes;
  - honest note that no EU/UK representative has been appointed.
- **Accuracy:** "Top-up available" removed. The ODR link is not offered, since the platform closed.

## 10. Remaining missing business information (needed from the owner)

| Item | Why it matters | Where it shows now |
|---|---|---|
| Operator's **full legal name** | CRD Art. 6(1)(b) identity of the trader; GDPR Art. 13 controller identity | "Not yet published", seller box in all languages |
| **Geographic (postal) address** | CRD Art. 6(1)(c) requires the trader's geographic address | "Not yet published" |
| Business registration (Vietnam household business or company), if any | Vietnamese e-commerce and tax rules; credibility | "None" (accurate today) |
| Tax status (VAT/OSS, Vietnamese tax) | Invoicing and price-inclusive-of-tax claims | Prices say "total you pay"; no tax claim made |
| Telephone (optional) | CRD Art. 6(1)(c) lists phone "where available" (consolidated text) | "No telephone line" |
| Whop's role (merchant of record or processor) | Who the card contract is with, and refund flows | Described neutrally as "payment provider" |
| Signed data-processing agreements with Netlify, Neon, NodeReal, Whop | GDPR Art. 28 and transfers | Policy says "we rely on providers' data-processing terms where available" |

## 11. Legal risks requiring qualified local advice
1. **[COUNSEL] HIGH — Is accepting USDT lawful for a Vietnam-based seller?** The official Vietnamese texts on non-cash payment instruments and digital assets could not be read during this audit. **Get a Vietnamese lawyer's written opinion before accepting live USDT payments.**
2. **[COUNSEL] Vietnam e-commerce obligations:** whether the website must be notified or registered with the Ministry of Industry and Trade, and the obligations for individual sellers under the 2023 Consumer Protection Law and the 2025 data-protection law. Not verified.
3. **[UNCERTAIN] EU/UK targeting:** French/Spanish pages and EU country choices likely mean ESIMPROVE "offers services" to EU consumers (GDPR Art. 3(2), Recital 23). If so, **GDPR Art. 27 requires an EU representative** unless the occasional-processing exemption applies, and likewise a UK representative. None is appointed (the policy states this honestly).
4. **[CONFIRMED gap] Durable-medium confirmation (CRD Art. 8(7); UK reg. 12(5)/16(3)):** the trader must confirm the contract, including the immediate-supply acknowledgement, on a durable medium. Today confirmation is a web page only, because **no email provider is configured**. If confirmation is missing, an EU/UK consumer may withdraw and **bear no cost** (Art. 14(4)(b)(iii); reg. 37(4)(c)). Fix: send a confirmation email or downloadable PDF with the order.
5. **[UNCERTAIN] Classification of an eSIM plan** as "digital content" (withdrawal lost once supply begins, with consent) or a "service" (lost only when fully performed). The policy takes the consumer-favourable position in both cases.
6. **[COUNSEL] EU VAT / non-Union OSS:** B2C telecom and electronic services are generally taxed where the customer is, and non-EU sellers may need to register. Not verified; prices currently include no VAT.
7. **[COUNSEL] Liability cap and governing-law clause** (Vietnam law) against EU/UK consumers. Mandatory consumer protections are preserved in the text, but enforceability should be reviewed.
8. **[BEST PRACTICE] Stablecoin and depeg risk** is disclosed. Refunds are fixed in USD value.

## 12. Tests and build results
| Check | Result |
|---|---|
| TypeScript | clean |
| ESLint (app, components, lib, tests) | clean |
| Automated tests | **406 / 406 passed** (42 files) |
| New tests (`tests/legal-content.test.ts`) | identical sections and block structure in EN/FR/ES/AR; internal links resolve to real pages; all documents routed and in the sitemap; no template placeholders; no invented identifiers; USDT disclosure consistent; checkout requires the acknowledgement |
| USDT suffix test | updated: maximum payable is price + 0.0099 USDT |
| Browser (local) | `/ar/legal/payments`: right-to-left, localized navigation and table of contents, version 2.0, localized date, no raw keys. `/fr/checkout`: both consent boxes required and unticked, policy links localized. Mobile 375 px: no horizontal overflow, tables fit |
| Production build (Turbopack, isolated copy) | **OK**: all 8 legal routes plus /legal and /legal/faq built |
