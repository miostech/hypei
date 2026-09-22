/**
 * Supported currencies. Adding a currency = adding an entry here (and enabling it
 * at the payment provider). Minor-unit exponent follows ISO 4217.
 */
export const CURRENCIES = {
  BRL: { code: "BRL", exponent: 2, defaultLocale: "pt-BR" },
  EUR: { code: "EUR", exponent: 2, defaultLocale: "pt-PT" },
  USD: { code: "USD", exponent: 2, defaultLocale: "en-US" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isSupportedCurrency(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

export function assertSupportedCurrency(value: string): CurrencyCode {
  if (!isSupportedCurrency(value)) {
    throw new Error(`Unsupported currency: ${value}`);
  }
  return value;
}

export function currencyExponent(currency: CurrencyCode): number {
  return CURRENCIES[currency].exponent;
}
