import type { CurrencyCode } from "@/lib/money";

/** Uma cotação, com de onde ela veio: o saque guarda as três coisas. */
export interface ExchangeRateQuote {
  from: CurrencyCode;
  to: CurrencyCode;
  /** Cotação inteira na escala de `RATE_SCALE` (1e8): 5,4321 vira 543_210_000n. */
  rate: bigint;
  /** De onde saiu o número — fica gravado no saque, para o extrato poder ser conferido. */
  source: string;
  quotedAt: Date;
}

/**
 * De onde vem o câmbio do dia.
 *
 * É uma porta, e não uma constante, porque o número que converte o saldo de um produtor em
 * dinheiro na conta dele precisa vir de uma fonte conferível e mudar todo dia. Em produção
 * isso é uma cotação de mercado (PTAX do Banco Central, para o real); em desenvolvimento é a
 * tabela fixa abaixo, que serve para a tela funcionar e nunca para pagar ninguém.
 */
export interface ExchangeRateProvider {
  /** A cotação de agora para converter `from` em `to`. Mesma moeda devolve 1. */
  quote(from: CurrencyCode, to: CurrencyCode): Promise<ExchangeRateQuote>;
}
