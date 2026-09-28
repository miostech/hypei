import { CurrencyMismatchError, MoneyError } from "@/lib/errors";
import { assertSupportedCurrency, currencyExponent, type CurrencyCode } from "./currency";

/**
 * Money is always an integer amount of MINOR units (cents) + currency.
 * Floats are never used for money anywhere in Ripay.
 */
export interface Money {
  readonly amount: bigint;
  readonly currency: CurrencyCode;
}

export const BPS_DENOMINATOR = 10_000n;

export function money(amount: bigint | number, currency: string): Money {
  if (typeof amount === "number" && !Number.isSafeInteger(amount)) {
    throw new MoneyError(`Money amount must be an integer in minor units, received ${amount}`);
  }
  return Object.freeze({ amount: BigInt(amount), currency: assertSupportedCurrency(currency) });
}

export function zero(currency: CurrencyCode): Money {
  return money(0n, currency);
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
}

export function addMoney(a: Money, ...rest: Money[]): Money {
  return rest.reduce((acc, m) => {
    assertSameCurrency(acc, m);
    return money(acc.amount + m.amount, acc.currency);
  }, a);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function isNegative(m: Money): boolean {
  return m.amount < 0n;
}

export function isZero(m: Money): boolean {
  return m.amount === 0n;
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  return a.amount === b.amount ? 0 : a.amount > b.amount ? 1 : -1;
}

export type RoundingMode = "HALF_UP" | "DOWN" | "UP";

function divideRounded(numerator: bigint, denominator: bigint, mode: RoundingMode): bigint {
  if (denominator <= 0n) throw new MoneyError("Denominator must be positive");
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  const quotient = abs / denominator;
  const remainder = abs % denominator;
  let result = quotient;
  if (remainder !== 0n) {
    if (mode === "UP" || (mode === "HALF_UP" && remainder * 2n >= denominator)) {
      result = quotient + 1n;
    }
  }
  return negative ? -result : result;
}

/**
 * Percentage expressed in basis points (1% = 100 bps) to stay in integer math.
 * calculatePercentage(R$100,00, 1000) → R$10,00
 */
export function calculatePercentage(m: Money, basisPoints: number, mode: RoundingMode = "HALF_UP"): Money {
  if (!Number.isInteger(basisPoints) || basisPoints < 0) {
    throw new MoneyError(`Basis points must be a non-negative integer, received ${basisPoints}`);
  }
  return money(divideRounded(m.amount * BigInt(basisPoints), BPS_DENOMINATOR, mode), m.currency);
}

/**
 * Splits `total` proportionally to `weights`, distributing the rounding remainder
 * so that the parts ALWAYS add up exactly to `total` (no money created or lost).
 */
export function allocateProportionally(total: Money, weights: bigint[]): Money[] {
  if (weights.length === 0) throw new MoneyError("At least one weight is required");
  if (weights.some((w) => w < 0n)) throw new MoneyError("Weights must be non-negative");
  const weightSum = weights.reduce((a, b) => a + b, 0n);
  if (weightSum === 0n) throw new MoneyError("Weights must not all be zero");

  const parts = weights.map((w) => (total.amount * w) / weightSum);
  let remainder = total.amount - parts.reduce((a, b) => a + b, 0n);
  // Give leftover minor units to the largest weights first (deterministic).
  const order = weights.map((w, i) => ({ w, i })).sort((a, b) => (b.w > a.w ? 1 : b.w < a.w ? -1 : a.i - b.i));
  const step = remainder >= 0n ? 1n : -1n;
  for (let k = 0; remainder !== 0n; k = (k + 1) % order.length) {
    parts[order[k].i] += step;
    remainder -= step;
  }
  return parts.map((p) => money(p, total.currency));
}

/** Converts a decimal string typed by a user ("10,90" / "10.90") to minor units without floats. */
/**
 * Normalizes the human separators of "1.997,00", "1,997.00", "1997,00" and "1997" to a
 * single dot. A separator followed by exactly three digits is a thousands separator;
 * anything else (1 or 2 digits) is the decimal mark, which is how people actually type
 * prices in pt-BR, pt-PT and en-US alike.
 */
function separateDecimal(value: string): string {
  const last = Math.max(value.lastIndexOf("."), value.lastIndexOf(","));
  if (last === -1) return value;

  const tail = value.slice(last + 1);
  // "1.997" / "1,997" / "1.234.567": every separator groups thousands.
  const onlyThousandGroups = /^\d{1,3}(?:[.,]\d{3})+$/.test(value) && !/^0/.test(value);
  if (tail.length === 3 && onlyThousandGroups) return value.replace(/[.,]/g, "");

  // Otherwise the last separator is the decimal mark and the rest group thousands.
  return `${value.slice(0, last).replace(/[.,]/g, "")}.${tail}`;
}

export function parseDecimalToMinorUnits(input: string, currency: CurrencyCode): bigint {
  const exponent = currencyExponent(currency);
  const normalized = separateDecimal(input.trim().replace(/\s/g, ""));
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) throw new MoneyError(`Invalid amount: "${input}"`);
  const [, whole, fraction = ""] = match;
  if (fraction.length > exponent) {
    throw new MoneyError(`Amount "${input}" has more than ${exponent} decimal places`);
  }
  return BigInt(whole) * 10n ** BigInt(exponent) + BigInt(fraction.padEnd(exponent, "0") || "0");
}

/** Minor units → decimal string with a dot separator ("1090" → "10.90"). Pure string math. */
export function convertMinorUnits(amount: bigint, currency: CurrencyCode): string {
  const exponent = currencyExponent(currency);
  const negative = amount < 0n;
  const digits = (negative ? -amount : amount).toString().padStart(exponent + 1, "0");
  const whole = digits.slice(0, digits.length - exponent);
  const fraction = exponent > 0 ? `.${digits.slice(-exponent)}` : "";
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

export function formatMoney(m: Money, locale?: string): string {
  const exponent = currencyExponent(m.currency);
  const formatter = new Intl.NumberFormat(locale ?? defaultLocaleFor(m.currency), {
    style: "currency",
    currency: m.currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  });
  // Intl accepts decimal strings (ES2023), so no float conversion happens.
  return formatter.format(convertMinorUnits(m.amount, m.currency) as unknown as number);
}

function defaultLocaleFor(currency: CurrencyCode): string {
  return currency === "BRL" ? "pt-BR" : currency === "EUR" ? "pt-PT" : "en-US";
}
