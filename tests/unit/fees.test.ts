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

  it("produces the reference breakdown 10000 = 1000 + 9000", () => {
    const b = calculateFeeBreakdown(money(10_000, "BRL"), money(400, "BRL"), { percentageBps: 1000, fixedAmount: 0n });
    expect(b.grossAmount.amount).toBe(10_000n);
    expect(b.platformFeeAmount.amount).toBe(1000n);
    expect(b.producerNetAmount.amount).toBe(9000n);
    expect(b.platformFeeAmount.amount + b.producerNetAmount.amount).toBe(b.grossAmount.amount);
  });

  it("não tira a taxa do adquirente do produtor: ela é custo da Kabrun", () => {
    // Mesma venda, duas taxas de adquirente muito diferentes: o produtor recebe o mesmo.
    const barata = calculateFeeBreakdown(money(10_000, "BRL"), money(100, "BRL"), { percentageBps: 1000, fixedAmount: 0n });
    const cara = calculateFeeBreakdown(money(10_000, "BRL"), money(900, "BRL"), { percentageBps: 1000, fixedAmount: 0n });

    expect(barata.producerNetAmount.amount).toBe(cara.producerNetAmount.amount);
    expect(barata.platformFeeAmount.amount).toBe(cara.platformFeeAmount.amount);
    // Ela continua no resultado: é o que o ledger registra como despesa, e o que separa a
    // receita da plataforma do lucro dela.
    expect(barata.processorFeeAmount.amount).toBe(100n);
    expect(cara.processorFeeAmount.amount).toBe(900n);
  });

  it("deixa passar a venda em que o adquirente custa mais do que a taxa", () => {
    // Prejuízo numa venda é fato do negócio, não quebra de invariante: o ledger registra, e o
    // lucro líquido no admin mostra. Recusar a venda seria pior para todo mundo.
    const b = calculateFeeBreakdown(money(500, "BRL"), money(300, "BRL"), { percentageBps: 0, fixedAmount: 100n });
    expect(b.platformFeeAmount.amount).toBe(100n);
    expect(b.processorFeeAmount.amount).toBe(300n);
    expect(b.producerNetAmount.amount).toBe(400n);
  });

  it("refuses a platform fee larger than the sale", () => {
    expect(() => calculateFeeBreakdown(money(100, "BRL"), money(0, "BRL"), { percentageBps: 0, fixedAmount: 150n })).toThrow(ValidationError);
  });
});
