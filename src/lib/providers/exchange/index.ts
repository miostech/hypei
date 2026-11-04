export * from "./exchange-rate-provider";
export { FixedExchangeRateProvider, ratePair, type RateTable } from "./fixed-exchange-rate-provider";

import { FixedExchangeRateProvider, ratePair, type RateTable } from "./fixed-exchange-rate-provider";
import type { ExchangeRateProvider } from "./exchange-rate-provider";

/**
 * Cotações de desenvolvimento, na escala de `RATE_SCALE` (1e8).
 *
 * São números plausíveis, não cotações: existem para a tela e os testes funcionarem. Antes de
 * converter dinheiro de verdade é preciso trocar isto por uma fonte do dia — para o real, a
 * PTAX do Banco Central é a referência que a conversão de um recebimento costuma usar.
 */
export const DEVELOPMENT_RATES: RateTable = {
  [ratePair("USD", "BRL")]: 540_000_000n, // R$ 5,40
  [ratePair("EUR", "BRL")]: 620_000_000n, // R$ 6,20
  [ratePair("BRL", "USD")]: 18_520_000n, // $ 0,1852
  [ratePair("BRL", "EUR")]: 16_130_000n, // € 0,1613
  [ratePair("USD", "EUR")]: 87_000_000n, // € 0,87
  [ratePair("EUR", "USD")]: 115_000_000n, // $ 1,15
};

export function createExchangeRateProvider(): ExchangeRateProvider {
  return new FixedExchangeRateProvider(DEVELOPMENT_RATES);
}
