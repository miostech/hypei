import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { money } from "@/lib/money";
import { calculateFeeBreakdown, calculatePlatformFee } from "@/modules/fees/fee.calculator";

describe("Platform fee vs processor fee", () => {
  it("supports percentage, fixed and percentage + fixed", () => {
    const gross = money(10_000, "BRL");
    expect(calculatePlatformFee(gross, { percentageBps: 500, fixedAmount: 0n }).amount).toBe(500n);
    expect(calculatePlatformFee(gross, { percentageBps: 0, fixedAmount: 100n }).amount).toBe(100n);
    expect(calculatePlatformFee(gross, { percentageBps: 500, fixedAmount: 100n }).amount).toBe(600n); // 5% + R$1
  });

  it("produces the reference breakdown 10000 = 400 + 1000 + 8600", () => {
    const b = calculateFeeBreakdown(money(10_000, "BRL"), money(400, "BRL"), { percentageBps: 1000, fixedAmount: 0n });
    expect(b.grossAmount.amount).toBe(10_000n);
    expect(b.processorFeeAmount.amount).toBe(400n);
    expect(b.platformFeeAmount.amount).toBe(1000n);
    expect(b.producerNetAmount.amount).toBe(8600n);
    expect(b.processorFeeAmount.amount + b.platformFeeAmount.amount + b.producerNetAmount.amount).toBe(b.grossAmount.amount);
  });

  it("refuses fees larger than the sale", () => {
    expect(() => calculateFeeBreakdown(money(100, "BRL"), money(90, "BRL"), { percentageBps: 0, fixedAmount: 50n })).toThrow(ValidationError);
  });
});
