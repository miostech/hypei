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

/** Os meios de pagamento que a tela mostra prazo, na ordem em que aparecem. */
export type SettlementMethodKey = "card" | "pix" | "boleto";

/**
 * Quais meios existem em cada moeda.
 *
 * Pix e boleto são brasileiros: numa venda em dólar ou euro não há o que mostrar, e anunciar
 * "Pix: 15 dias" para uma venda internacional seria um prazo de um meio que nem aparece no
 * checkout dela.
 */
export const METHODS_BY_CURRENCY: Record<CurrencyCode, SettlementMethodKey[]> = {
  BRL: ["card", "pix", "boleto"],
  EUR: ["card"],
  USD: ["card"],
};

/** Quanto de cada venda fica retido para cobrir estorno e chargeback, e por quantos dias. */
export interface ReserveRule {
  percentageBps: number;
  holdDays: number;
}

/**
 * A reserva anunciada, por moeda.
 *
 * O chargeback chega meses depois da venda, mas o produtor recebe em dias e saca no mesmo dia.
 * Sem reter nada, o estorno que chega depois do saque é dinheiro que a Kabrun devolve ao
 * comprador do próprio caixa e cobra de um saldo que já ficou negativo. A reserva é a parte
 * da venda que fica em casa até essa janela passar — e volta inteira para quem não dá problema.
 *
 * Lá fora é mais: o prazo de contestação é maior e a venda está mais longe de qualquer
 * cobrança nossa.
 */
export const PUBLISHED_RESERVE: Record<CurrencyCode, ReserveRule> = {
  BRL: { percentageBps: 400, holdDays: 30 },
  EUR: { percentageBps: 1000, holdDays: 45 },
  USD: { percentageBps: 1000, holdDays: 45 },
};
