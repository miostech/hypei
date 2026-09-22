import { describe, expect, it } from "vitest";
import { CurrencyMismatchError, MoneyError } from "@/lib/errors";
import {
  addMoney,
  allocateProportionally,
  calculatePercentage,
  convertMinorUnits,
  formatMoney,
  money,
  parseDecimalToMinorUnits,
  subtractMoney,
} from "@/lib/money";

describe("Money", () => {
  it("stores amounts as bigint minor units", () => {
    expect(money(1090, "BRL")).toEqual({ amount: 1090n, currency: "BRL" });
    expect(money(2999n, "USD").amount).toBe(2999n);
  });

  it("rejects non-integer amounts (no floats for money)", () => {
    expect(() => money(10.9, "BRL")).toThrow(MoneyError);
  });

  it("rejects unsupported currencies", () => {
    expect(() => money(100, "JPY")).toThrow();
  });

  it("adds and subtracts in the same currency", () => {
    expect(addMoney(money(1000, "EUR"), money(550, "EUR"), money(1, "EUR")).amount).toBe(1551n);
    expect(subtractMoney(money(1000, "EUR"), money(1550, "EUR")).amount).toBe(-550n);
  });

  it("never mixes currencies without explicit conversion", () => {
    expect(() => addMoney(money(100, "BRL"), money(100, "USD"))).toThrow(CurrencyMismatchError);
    expect(() => subtractMoney(money(100, "EUR"), money(1, "USD"))).toThrow(CurrencyMismatchError);
  });

  it("calculates percentages in basis points with integer rounding", () => {
    expect(calculatePercentage(money(10_000, "BRL"), 1000).amount).toBe(1000n); // 10%
    expect(calculatePercentage(money(999, "BRL"), 500).amount).toBe(50n); // 49.95 → 50 (half up)
    expect(calculatePercentage(money(999, "BRL"), 500, "DOWN").amount).toBe(49n);
  });

  it("allocates proportionally without creating or losing a cent", () => {
    const parts = allocateProportionally(money(1000, "BRL"), [1n, 1n, 1n]);
    expect(parts.map((p) => p.amount)).toEqual([334n, 333n, 333n]);
    expect(parts.reduce((a, p) => a + p.amount, 0n)).toBe(1000n);

    const refundParts = allocateProportionally(money(3333, "BRL"), [8600n, 1000n, 400n]);
    expect(refundParts.reduce((a, p) => a + p.amount, 0n)).toBe(3333n);
  });

  it("parses human decimals to minor units without floats", () => {
    expect(parseDecimalToMinorUnits("10,90", "BRL")).toBe(1090n);
    expect(parseDecimalToMinorUnits("29.99", "USD")).toBe(2999n);
    expect(parseDecimalToMinorUnits("15", "EUR")).toBe(1500n);
    expect(parseDecimalToMinorUnits("0.1", "EUR")).toBe(10n);
    expect(() => parseDecimalToMinorUnits("1.999", "EUR")).toThrow(MoneyError);
    expect(() => parseDecimalToMinorUnits("abc", "EUR")).toThrow(MoneyError);
  });

  it("converts and formats minor units", () => {
    expect(convertMinorUnits(1090n, "BRL")).toBe("10.90");
    expect(convertMinorUnits(-5n, "USD")).toBe("-0.05");
    expect(formatMoney(money(1090, "BRL")).replace(/\s/g, " ")).toBe("R$ 10,90");
    expect(formatMoney(money(2999, "USD"))).toBe("$29.99");
    expect(formatMoney(money(1550, "EUR"), "pt-PT").replace(/\s/g, " ")).toBe("15,50 €");
  });
});
