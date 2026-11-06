import { RATE_SCALE, type CurrencyCode } from "@/lib/money";
import type { ExchangeRateProvider, ExchangeRateQuote } from "./exchange-rate-provider";

export type RateTable = Partial<Record<string, bigint>>;

/** `USD->BRL`, a chave da tabela. */
export const ratePair = (from: CurrencyCode, to: CurrencyCode) => `${from}->${to}`;

/**
 * Cotação de tabela: o que roda em desenvolvimento e nos testes.
 *
 * O número é fixo de propósito — um valor plausível para a tela mostrar. Nada que vale
 * dinheiro de verdade deve sair daqui: em produção entra um provedor que busca a cotação do
 * dia e responde com a fonte e a hora dela.
 */
export class FixedExchangeRateProvider implements ExchangeRateProvider {
  constructor(
    private readonly rates: RateTable,
    private readonly now: () => Date = () => new Date(),
    private readonly source = "fixed-table",
  ) {}

  async quote(from: CurrencyCode, to: CurrencyCode): Promise<ExchangeRateQuote> {
    const quotedAt = this.now();
    if (from === to) return { from, to, rate: RATE_SCALE, source: this.source, quotedAt };

    const rate = this.rates[ratePair(from, to)];
    if (rate === undefined) throw new Error(`No exchange rate configured for ${ratePair(from, to)}`);
    return { from, to, rate, source: this.source, quotedAt };
  }
}
