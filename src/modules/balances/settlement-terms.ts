import type { CurrencyCode } from "@/lib/money";

/**
 * Os prazos anunciados, e o padrão que o seed grava.
 *
 * Ficam aqui, e não escritos à mão na tela, porque é o mesmo número em três lugares: o que o
 * produtor lê antes de vender, o que o seed grava no banco e o que o settlement aplica. Escrito
 * em três lugares, divergiria em três momentos diferentes.
 */
export const CARD_SETTLEMENT_DAYS = 15;

/** Pix e boleto não têm o que compensar: o dinheiro já está lá. */
export const INSTANT_SETTLEMENT_DAYS = 2;

/** O prazo de cartão que a conta passa a ter quando o recebimento rápido é liberado. */
export const FAST_CARD_SETTLEMENT_DAYS = 2;

/**
 * Quanto a conta precisa ter vendido para liberar o recebimento de cartão em 2 dias sozinha.
 *
 * Receber antes é a Kabrun adiantando dinheiro que o cartão só paga depois: quem já vendeu
 * muito tem histórico para cobrir um estorno, quem está começando não. Abaixo disso a
 * liberação continua possível, mas passa por análise humana, não por este botão.
 */
export const FAST_SETTLEMENT_MIN_REVENUE: Record<CurrencyCode, bigint> = {
  BRL: 100_000_000n, // R$ 1.000.000,00
  EUR: 100_000_000n, // € 1.000.000,00
  USD: 100_000_000n, // $ 1,000,000.00
};
