import { assertSupportedCurrency, formatMoney, money } from "@/lib/money";

/** Formats minor units coming from the database (bigint) or from a client prop (string). */
export function formatAmount(amount: bigint | string | number, currency: string, locale?: string): string {
  return formatMoney(money(BigInt(amount), assertSupportedCurrency(currency)), locale);
}

/**
 * Short money for tight spaces: "R$ 22,3 mil". Never used where an exact figure
 * matters — this rounds, and a producer reading a balance must see the cents.
 */
export function formatCompactAmount(amount: bigint | string | number, currency: string, locale = "pt-BR"): string {
  const value = Number(BigInt(amount)) / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: Date | string, locale = "pt-BR"): string {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}

export function formatDateTime(date: Date | string, locale = "pt-BR"): string {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

export function formatRelativeDays(date: Date | string, locale = "pt-BR"): string {
  const days = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000);
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
}
