import { describe, expect, it } from "vitest";
import { resolvePaymentMethods } from "@/modules/payments/payment-method-resolver";

describe("PaymentMethodResolver", () => {
  it("does not offer Pix unless the merchant enabled it (Stripe, BRL)", () => {
    const methods = resolvePaymentMethods({ provider: "STRIPE", currency: "BRL", merchantCountry: "BR" });
    expect(methods).toContain("CREDIT_CARD");
    expect(methods).not.toContain("PIX");
    expect(resolvePaymentMethods({ provider: "STRIPE", currency: "BRL", merchantCountry: "BR", merchantEnabledMethods: ["CREDIT_CARD", "PIX"] })).toEqual([
      "CREDIT_CARD",
      "PIX",
    ]);
  });

  it("offers SEPA only for EUR merchants in SEPA countries", () => {
    expect(resolvePaymentMethods({ provider: "STRIPE", currency: "EUR", merchantCountry: "PT" })).toContain("SEPA_DEBIT");
    expect(resolvePaymentMethods({ provider: "STRIPE", currency: "USD", merchantCountry: "US" })).not.toContain("SEPA_DEBIT");
  });

  it("never offers Pix outside BRL/Brazil", () => {
    expect(resolvePaymentMethods({ provider: "STRIPE", currency: "EUR", merchantCountry: "PT", merchantEnabledMethods: ["PIX", "CREDIT_CARD"] })).toEqual([
      "CREDIT_CARD",
    ]);
  });

  it("narrows to the methods enabled in the checkout configuration", () => {
    expect(resolvePaymentMethods({ provider: "MOCK", currency: "BRL", merchantCountry: "BR", checkoutEnabledMethods: ["PIX"] })).toEqual(["PIX"]);
  });
});
