/**
 * Card checkout stays on esimprove.com: Whop's form is embedded on our own
 * payment page, customers are never redirected or linked to whop.com, and the
 * wallets Whop supports (Apple Pay / Google Pay) are allowed only there.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { redirectUrlForPayment } from "@/lib/checkout";
import {
  buildContentSecurityPolicy,
  CHECKOUT_PAYMENT_PERMISSIONS_POLICY,
} from "@/lib/security-headers";
import { dictionaries } from "@/lib/i18n/dictionaries";
import nextConfig from "../next.config";

describe("card checkout never leaves esimprove.com", () => {
  it("sends a Whop card payment to our own payment page, never to whop.com", () => {
    const url = redirectUrlForPayment({
      paymentId: "pay_local1",
      paymentStatus: "pending",
      provider: "whop",
      isMock: false,
      checkoutUrl: "https://whop.com/checkout/ch_abc123",
      orderNumber: "ES-261127-ABC123",
      accessToken: "A".repeat(43),
    });
    expect(url.startsWith("/checkout/pay/pay_local1?token=")).toBe(true);
    expect(url).not.toMatch(/whop\.com/);
  });

  it("the payment page and embedded form contain no link or redirect to Whop's hosted checkout", () => {
    const page = readFileSync("app/checkout/pay/[paymentId]/page.tsx", "utf8");
    const component = readFileSync("components/whop-embedded-checkout.tsx", "utf8");
    for (const source of [page, component]) {
      expect(source).not.toMatch(/href=\{[^}]*checkoutUrl/);
      expect(source).not.toMatch(/hostedCheckoutUrl|openHosted|securePay/);
      expect(source).not.toMatch(/window\.location(\.href)?\s*=\s*[^;]*checkout/i);
    }
    // The embedded Whop element is rendered on our page.
    expect(component).toMatch(/<CheckoutElement[ >/]/);
    expect(page).toContain("<WhopEmbeddedCheckout");
    // Whop returns the customer to our own confirmation page.
    expect(page).toMatch(/returnUrl: `\$\{appUrl\}\/checkout\/success\?/);
  });

  it("has no 'open the Whop checkout page instead' text in any language", () => {
    for (const dictionary of Object.values(dictionaries)) {
      expect(Object.keys(dictionary)).not.toContain("payment.openHosted");
    }
  });
});

describe("wallets on the payment step only", () => {
  it("allows the Payment Request API (Apple Pay / Google Pay) only on /checkout/pay", async () => {
    const rules = await nextConfig.headers!();
    const policyFor = (source: string) =>
      rules
        .filter((rule) => rule.source === source)
        .flatMap((rule) => rule.headers)
        .filter((header) => header.key === "Permissions-Policy")
        .at(-1)?.value;
    expect(policyFor("/(.*)")).toContain("payment=()");
    expect(policyFor("/checkout/pay/:path*")).toBe(CHECKOUT_PAYMENT_PERMISSIONS_POLICY);
    expect(policyFor("/:locale(fr|es|ar)/checkout/pay/:path*")).toBe(CHECKOUT_PAYMENT_PERMISSIONS_POLICY);
    expect(CHECKOUT_PAYMENT_PERMISSIONS_POLICY).toContain('payment=(self "https://cdn.whop.com")');
    // The checkout rules come last so they override the site-wide rule.
    const lastSources = rules.slice(-2).map((rule) => rule.source);
    expect(lastSources).toEqual(["/checkout/pay/:path*", "/:locale(fr|es|ar)/checkout/pay/:path*"]);
  });

  it("lets Google Pay and Apple Pay load inside the live payment form", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc", whopElements: "production" });
    expect(csp).toContain("https://pay.google.com");
    expect(csp).toContain("https://applepay.cdn-apple.com");
    expect(csp).toContain("frame-src https://cdn.whop.com");
    expect(csp).toContain("https://www.paypalobjects.com");
    expect(csp).toContain("font-src 'self' https://applepay.cdn-apple.com");
    // Other pages keep fonts first-party only.
    expect(buildContentSecurityPolicy({ nonce: "abc" })).toContain("font-src 'self';");
  });
});
