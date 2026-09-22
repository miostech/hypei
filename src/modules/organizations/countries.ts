import type { CurrencyCode } from "@/lib/money/currency";

export const SUPPORTED_COUNTRIES = ["BR", "PT", "ES", "FR", "DE", "IT", "US"] as const;
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

export const COUNTRY_INFO: Record<CountryCode, { name: string; currency: CurrencyCode; region: "BR" | "EU" | "US"; locale: string }> = {
  BR: { name: "Brasil", currency: "BRL", region: "BR", locale: "pt-BR" },
  PT: { name: "Portugal", currency: "EUR", region: "EU", locale: "pt-PT" },
  ES: { name: "Espanha", currency: "EUR", region: "EU", locale: "es-ES" },
  FR: { name: "França", currency: "EUR", region: "EU", locale: "fr-FR" },
  DE: { name: "Alemanha", currency: "EUR", region: "EU", locale: "de-DE" },
  IT: { name: "Itália", currency: "EUR", region: "EU", locale: "it-IT" },
  US: { name: "Estados Unidos", currency: "USD", region: "US", locale: "en-US" },
};
