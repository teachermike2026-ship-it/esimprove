import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHECKOUT_CARD_NETWORKS,
  CHECKOUT_PAYMENT_METHODS,
  DEFAULT_CHECKOUT_PAYMENT_METHOD,
  isCheckoutPaymentMethod,
} from "@/lib/checkout-payment";
import {
  PREVIEW_USDT_PER_USD,
  USDT_BEP20_PAYMENT,
  formatPreviewUsdtAmount,
} from "@/lib/crypto-payment";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { en, type TranslationKey } from "@/lib/i18n/dictionaries/en";

const localeCodes = ["en", "es", "ar", "fr"] as const;

const requiredCheckoutKeys: TranslationKey[] = [
  "checkout.cryptoTitle",
  "checkout.cryptoLead",
  "checkout.cryptoProviderNote",
  "checkout.cryptoHeading",
  "checkout.cryptoAmountLabel",
  "checkout.cryptoPayLine",
  "checkout.cryptoSourceTotal",
  "checkout.cryptoConversionNote",
  "checkout.cryptocurrencyLabel",
  "checkout.networkLabel",
  "checkout.networkStandardLabel",
  "checkout.receivingWalletLabel",
  "checkout.receivingWalletNote",
  "checkout.copyAddress",
  "checkout.copyContract",
  "checkout.copied",
  "checkout.copyFailed",
  "checkout.tokenContractLabel",
  "checkout.tokenContractNote",
  "checkout.qrPreviewTitle",
  "checkout.qrPreviewBody",
  "checkout.addressUnverifiedTitle",
  "checkout.addressUnverifiedBody",
  "checkout.cryptoNetworkWarning",
  "checkout.paymentInstructionsTitle",
  "checkout.cryptoInstruction1",
  "checkout.cryptoInstruction2",
  "checkout.cryptoInstruction3",
  "checkout.cryptoInstruction4",
  "checkout.walletOptionsTitle",
  "checkout.walletMetaMaskTrustTitle",
  "checkout.walletMetaMaskStep1",
  "checkout.walletMetaMaskStep2",
  "checkout.walletMetaMaskStep3",
  "checkout.walletMetaMaskStep4",
  "checkout.walletBinanceTitle",
  "checkout.walletBinanceStep1",
  "checkout.walletBinanceStep2",
  "checkout.walletBinanceStep3",
  "checkout.walletBinanceStep4",
  "checkout.statusAwaiting",
  "checkout.statusVerifying",
  "checkout.statusConfirmed",
  "checkout.statusConfirmedNote",
  "checkout.statusPreviewNote",
  "checkout.verificationDisabled",
  "checkout.previewBadge",
  "checkout.cryptoPreviewBody",
  "checkout.cardPreviewBody",
];

describe("USDT BEP-20 checkout preview", () => {
  it("offers card first and selects it by default", () => {
    expect(CHECKOUT_PAYMENT_METHODS).toEqual(["card", "crypto"]);
    expect(DEFAULT_CHECKOUT_PAYMENT_METHOD).toBe("card");
    expect(isCheckoutPaymentMethod("crypto")).toBe(true);
    expect(isCheckoutPaymentMethod("card")).toBe(true);
    expect(isCheckoutPaymentMethod("wallet")).toBe(false);
    expect(isCheckoutPaymentMethod(null)).toBe(false);
  });

  it("shows only the card networks requested for the intended Whop preview", () => {
    expect(CHECKOUT_CARD_NETWORKS).toEqual(["Visa", "Mastercard"]);
  });

  it("keeps the supplied receiving address and public USDT contract exact", () => {
    expect(USDT_BEP20_PAYMENT.receivingAddress).toBe(
      "0xBF93e7123FfEf0973d469F6Ce39D201dC2e5Aa5E",
    );
    expect(USDT_BEP20_PAYMENT.receivingAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(USDT_BEP20_PAYMENT.tokenContract).toBe(
      "0x55d398326f99059fF775485246999027B3197955",
    );
    expect(USDT_BEP20_PAYMENT.tokenContract).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(USDT_BEP20_PAYMENT.asset).toBe("USDT");
    expect(USDT_BEP20_PAYMENT.network).toBe("BNB Smart Chain");
    expect(USDT_BEP20_PAYMENT.standard).toBe("BEP-20");
    expect(USDT_BEP20_PAYMENT.tokenDecimals).toBe(18);
  });

  it("derives the displayed USDT amount from the order total", () => {
    expect(PREVIEW_USDT_PER_USD).toBe(1);
    expect(formatPreviewUsdtAmount(100, "USD", "en")).toBe("1.00");
    expect(formatPreviewUsdtAmount(2858, "USD", "en")).toBe("28.58");
    expect(formatPreviewUsdtAmount(2858, "USD", "ar")).toBe("28.58");
    expect(() => formatPreviewUsdtAmount(100, "EUR", "en")).toThrow();
    expect(() => formatPreviewUsdtAmount(-1, "USD", "en")).toThrow();
  });

  it("uses the required card and preview disclosures in English", () => {
    expect(en["checkout.cardPreviewBody"]).toBe(
      "Preview only — payment processing is not connected.",
    );
    expect(en["checkout.cryptoPreviewBody"]).toBe(
      "Cryptocurrency payments are not yet connected.",
    );
    expect(en["checkout.cryptoLead"]).toBe(
      "Pay securely using your crypto wallet.",
    );
    expect(en["checkout.cryptoHeading"]).toBe(
      "Pay with USDT on BNB Smart Chain (BEP-20)",
    );
  });

  it("translates the USDT checkout into every supported locale", () => {
    for (const code of localeCodes) {
      const dictionary = dictionaries[code];
      for (const key of requiredCheckoutKeys) {
        expect(dictionary[key].trim().length, `${code}:${key}`).toBeGreaterThan(0);
      }
      expect(Object.keys(dictionary).length, code).toBe(
        Object.keys(dictionaries.en).length,
      );
    }

    expect(dictionaries.es["checkout.cryptoHeading"]).not.toBe(
      en["checkout.cryptoHeading"],
    );
    expect(dictionaries.ar["checkout.cryptoHeading"]).not.toBe(
      en["checkout.cryptoHeading"],
    );
    expect(dictionaries.fr["checkout.cryptoHeading"]).not.toBe(
      en["checkout.cryptoHeading"],
    );
    expect(en["checkout.cryptoPayLine"]).toContain("{amount}");
    expect(en["checkout.cryptoInstruction2"]).toContain("{amount}");
    expect(en["checkout.cryptoConversionNote"]).toContain("{amount}");
  });

  it("does not advertise other crypto assets, fake hashes, or private credentials", () => {
    for (const code of localeCodes) {
      const copy = requiredCheckoutKeys
        .map((key) => dictionaries[code][key])
        .join(" ");

      expect(copy, code).toMatch(/\bUSDT\b/);
      expect(copy, code).not.toMatch(/\bBTC\b|\bETH\b|\bUSDC\b|\bSolana\b/i);
      expect(copy, code).not.toMatch(/0x[a-f0-9]{64}/i);
    }

    expect(
      Object.keys(USDT_BEP20_PAYMENT).some((key) =>
        /private|secret|seed|mnemonic/i.test(key),
      ),
    ).toBe(false);
  });

  it("keeps the wallet details centralized and the amount server-provided", () => {
    const componentSource = readFileSync(
      path.join(process.cwd(), "components", "checkout-payment-preview.tsx"),
      "utf8",
    );
    const pageSource = readFileSync(
      path.join(process.cwd(), "app", "checkout", "page.tsx"),
      "utf8",
    );

    expect(componentSource).not.toContain(USDT_BEP20_PAYMENT.receivingAddress);
    expect(componentSource).not.toContain(USDT_BEP20_PAYMENT.tokenContract);
    expect(componentSource).toContain("USDT_BEP20_PAYMENT");
    expect(componentSource).toContain("DEFAULT_CHECKOUT_PAYMENT_METHOD");
    expect(componentSource).not.toContain("28.58");
    expect(componentSource).toContain("copyValue");
    expect(componentSource).toContain("checkout.copyAddress");
    expect(componentSource).toContain("checkout.copyContract");

    expect(pageSource).toContain("formatPreviewUsdtAmount(");
    expect(pageSource).toContain(
      "<CheckoutPaymentPreview usdtAmount={usdtAmount} sourceAmount={demoTotal} />",
    );
    expect(pageSource).not.toContain("28.58");
  });

  it("contains no network, order, provider, or blockchain calls in the preview", () => {
    const source = readFileSync(
      path.join(process.cwd(), "components", "checkout-payment-preview.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain("XMLHttpRequest");
    expect(source).not.toContain("WebSocket");
    expect(source).not.toContain("createCheckout");
    expect(source).not.toContain("createWhopCheckout");
    expect(source).not.toContain("checkoutConfigurations");
    expect(source).not.toContain("ethers");
    expect(source).not.toContain("viem");
    expect(source).not.toContain("/api/");
    expect(source).not.toContain("QRCode");
    expect(source).not.toContain("<canvas");
    expect(source).not.toContain("<img");
  });
});
