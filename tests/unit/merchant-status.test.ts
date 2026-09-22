import { describe, expect, it } from "vitest";
import { deriveMerchantAccountStatus, isMerchantAccountReadyForPayouts } from "@/lib/providers/payment/merchant-status";
import type { MerchantAccountSnapshot } from "@/lib/providers/payment/types";

const base: MerchantAccountSnapshot = {
  providerAccountId: "acct_1",
  country: "BR",
  defaultCurrency: "BRL",
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  requirements: { currentlyDue: [], pastDue: [], pendingVerification: [], disabledReason: null },
};

describe("Merchant account status (not a single boolean)", () => {
  it("is PENDING before onboarding starts", () => {
    expect(deriveMerchantAccountStatus({ ...base, requirements: { ...base.requirements, currentlyDue: ["individual.id_number"] } })).toBe("PENDING");
  });

  it("is UNDER_REVIEW while documents are being verified", () => {
    expect(
      deriveMerchantAccountStatus({ ...base, detailsSubmitted: true, requirements: { ...base.requirements, pendingVerification: ["individual.verification.document"] } }),
    ).toBe("UNDER_REVIEW");
  });

  it("is REQUIRES_ACTION when requirements are past due", () => {
    expect(deriveMerchantAccountStatus({ ...base, detailsSubmitted: true, requirements: { ...base.requirements, pastDue: ["external_account"] } })).toBe(
      "REQUIRES_ACTION",
    );
  });

  it("is RESTRICTED when charging works but requirements are missing", () => {
    expect(
      deriveMerchantAccountStatus({ ...base, chargesEnabled: true, detailsSubmitted: true, requirements: { ...base.requirements, currentlyDue: ["external_account"] } }),
    ).toBe("RESTRICTED");
  });

  it("is ACTIVE only with charges + payouts enabled and nothing due", () => {
    const active = { ...base, chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true };
    expect(deriveMerchantAccountStatus(active)).toBe("ACTIVE");
    expect(isMerchantAccountReadyForPayouts({ status: "ACTIVE", payoutsEnabled: true })).toBe(true);
    expect(isMerchantAccountReadyForPayouts({ status: "ACTIVE", payoutsEnabled: false })).toBe(false);
    expect(isMerchantAccountReadyForPayouts({ status: "RESTRICTED", payoutsEnabled: true })).toBe(false);
  });

  it("is DISABLED when rejected", () => {
    expect(deriveMerchantAccountStatus({ ...base, requirements: { ...base.requirements, disabledReason: "rejected.fraud" } })).toBe("DISABLED");
  });
});
