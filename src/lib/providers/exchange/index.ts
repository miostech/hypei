export * from "./exchange-rate-provider";
export { FixedExchangeRateProvider, ratePair, type RateTable } from "./fixed-exchange-rate-provider";
export { PtaxExchangeRateProvider, type PtaxOptions } from "./ptax-exchange-rate-provider";

import { FixedExchangeRateProvider, ratePair, type RateTable } from "./fixed-exchange-rate-provider";
import { PtaxExchangeRateProvider } from "./ptax-exchange-rate-provider";
import type { ExchangeRateProvider } from "./exchange-rate-provider";

/**
 * Cotações de tabela, na escala de `RATE_SCALE` (1e8).
 *
 * São números plausíveis, não cotações: existem para os testes terem uma conta previsível e
 * para o ambiente local funcionar sem internet. Quem converte dinheiro de verdade é a PTAX.
 */
export const DEVELOPMENT_RATES: RateTable = {
  [ratePair("USD", "BRL")]: 540_000_000n, // R$ 5,40
  [ratePair("EUR", "BRL")]: 620_000_000n, // R$ 6,20
  [ratePair("BRL", "USD")]: 18_520_000n, // $ 0,1852
  [ratePair("BRL", "EUR")]: 16_130_000n, // € 0,1613
  [ratePair("USD", "EUR")]: 87_000_000n, // € 0,87
  [ratePair("EUR", "USD")]: 115_000_000n, // $ 1,15
};

export interface ExchangeEnv {
  EXCHANGE_RATE_PROVIDER: string;
}

/**
 * `ptax` busca a cotação oficial do Banco Central; `fixed` usa a tabela acima.
 *
 * Produção recusa `fixed` (ver `src/lib/env.ts`): converter o saldo de alguém a um número
 * inventado é o tipo de erro que só aparece no extrato do produtor, tarde demais.
 */
export function createExchangeRateProvider(env: ExchangeEnv): ExchangeRateProvider {
  if (env.EXCHANGE_RATE_PROVIDER === "fixed") return new FixedExchangeRateProvider(DEVELOPMENT_RATES);
  return new PtaxExchangeRateProvider();
}
