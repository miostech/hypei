import { assertSupportedCurrency, calculatePercentage, type Money } from "@/lib/money";
import { PUBLISHED_RESERVE, type ReserveRule } from "@/modules/balances/settlement-terms";

/** A reserva anunciada da moeda da venda. Moeda não suportada nunca chega aqui. */
export function publishedReserve(currency: string): ReserveRule {
  return PUBLISHED_RESERVE[assertSupportedCurrency(currency)];
}

/**
 * Quanto fica retido desta venda.
 *
 * O percentual é sobre o valor da venda — é o que pode ser contestado —, mas nunca pode passar
 * do que sobrou para o produtor: numa venda com comissão alta de afiliado, reter 4% do bruto
 * poderia ser mais do que ele ganhou, e o saldo nasceria negativo.
 */
export function reserveAmountFor(gross: Money, producerNet: Money, rule: ReserveRule): bigint {
  if (rule.percentageBps <= 0) return 0n;
  const wanted = calculatePercentage(gross, rule.percentageBps).amount;
  return wanted > producerNet.amount ? producerNet.amount : wanted;
}
