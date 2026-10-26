import { describe, expect, it } from "vitest";
import { calculatePercentage, extractIncludedPercentage, money } from "@/lib/money";
import { NoTaxService, PolicyTaxService } from "@/modules/taxes/tax.service";
import type { TaxPolicyRepository, TaxRule } from "@/modules/taxes/tax-policy.repository";

const BRL = (amount: bigint) => money(amount, "BRL");

function repositoryWith(rule: TaxRule | null): TaxPolicyRepository {
  return { findTaxRule: async () => rule };
}

const input = (amount: bigint) => ({
  amount: BRL(amount),
  organizationId: "org_1",
  sellerCountry: "BR",
  buyerCountry: "BR",
  productType: "DIGITAL",
});

describe("extractIncludedPercentage", () => {
  it("extracts the rate contained in the price instead of adding it on top", () => {
    // R$ 107,00 com 7% embutido → R$ 7,00 de imposto e R$ 100,00 de base.
    expect(extractIncludedPercentage(BRL(10_700n), 700).amount).toBe(700n);
  });

  it("is not the same as applying the rate on top", () => {
    const gross = BRL(10_000n);
    // Somar por fora daria R$ 7,00; extrair de dentro dá R$ 6,54.
    expect(calculatePercentage(gross, 700).amount).toBe(700n);
    expect(extractIncludedPercentage(gross, 700).amount).toBe(654n);
  });

  it("never exceeds the amount it was taken from", () => {
    for (const bps of [1, 700, 2500, 9999, 50_000]) {
      const tax = extractIncludedPercentage(BRL(9_999n), bps);
      expect(tax.amount).toBeLessThanOrEqual(9_999n);
      expect(tax.amount).toBeGreaterThanOrEqual(0n);
    }
  });

  it("rounds half up on the minor unit", () => {
    // 1000 × 500 / 10500 = 47,619… → 48
    expect(extractIncludedPercentage(BRL(1_000n), 500).amount).toBe(48n);
  });

  it("returns zero for a zero rate or a zero amount", () => {
    expect(extractIncludedPercentage(BRL(10_000n), 0).amount).toBe(0n);
    expect(extractIncludedPercentage(BRL(0n), 700).amount).toBe(0n);
  });

  it("refuses a negative or fractional rate", () => {
    expect(() => extractIncludedPercentage(BRL(100n), -1)).toThrow();
    expect(() => extractIncludedPercentage(BRL(100n), 1.5)).toThrow();
  });
});

describe("PolicyTaxService", () => {
  it("charges nothing when the producer has no policy", async () => {
    const service = new PolicyTaxService(repositoryWith(null));
    const result = await service.calculate(input(10_000n));

    expect(result.taxAmount.amount).toBe(0n);
    expect(result.regime).toBe("NONE");
    expect(result.breakdown).toEqual([]);
  });

  it("extracts the configured rate from what the buyer paid", async () => {
    const service = new PolicyTaxService(
      repositoryWith({ regime: "BR_SIMPLES_NACIONAL", rateBps: 600, jurisdiction: null }),
    );
    const result = await service.calculate(input(10_600n));

    expect(result.taxAmount.amount).toBe(600n);
    expect(result.regime).toBe("BR_SIMPLES_NACIONAL");
    expect(result.breakdown).toEqual([
      { jurisdiction: "BR", rateBps: 600, amount: BRL(600n) },
    ]);
  });

  it("names the municipality in the breakdown when the regime is ISS", async () => {
    const service = new PolicyTaxService(
      repositoryWith({ regime: "BR_ISS", rateBps: 500, jurisdiction: "São Paulo/SP" }),
    );
    const result = await service.calculate(input(10_500n));

    expect(result.breakdown[0].jurisdiction).toBe("São Paulo/SP");
    expect(result.taxAmount.amount).toBe(500n);
  });

  it("charges nothing when the policy exists but the rate is zero", async () => {
    const service = new PolicyTaxService(repositoryWith({ regime: "BR_ISS", rateBps: 0, jurisdiction: null }));
    const result = await service.calculate(input(10_000n));

    expect(result.taxAmount.amount).toBe(0n);
    expect(result.breakdown).toEqual([]);
  });

  it("keeps the currency of the sale", async () => {
    const service = new PolicyTaxService(repositoryWith({ regime: "BR_ISS", rateBps: 500, jurisdiction: null }));
    const result = await service.calculate({ ...input(10_500n), amount: money(10_500n, "EUR") });

    expect(result.taxAmount.currency).toBe("EUR");
  });
});

describe("NoTaxService", () => {
  it("always returns zero, for whoever has not configured anything", async () => {
    const result = await new NoTaxService().calculate(input(999_999n));
    expect(result.taxAmount.amount).toBe(0n);
    expect(result.regime).toBe("NONE");
  });
});
