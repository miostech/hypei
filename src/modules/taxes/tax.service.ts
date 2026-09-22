import { money, type Money } from "@/lib/money";

export interface TaxCalculationInput {
  amount: Money;
  sellerCountry: string;
  buyerCountry: string | null;
  buyerTaxId?: string | null;
  productType: string;
}

export interface TaxCalculationResult {
  taxAmount: Money;
  /** e.g. "EU_OSS", "EU_REVERSE_CHARGE", "US_SALES_TAX", "BR_NONE" */
  regime: string;
  breakdown: { jurisdiction: string; rateBps: number; amount: Money }[];
}

/**
 * Tax engine abstraction. Future providers: Stripe Tax, Avalara, TaxJar.
 * Brazil (NF-e/NFS-e issuance) and EU VAT (OSS / reverse charge) plug in behind this.
 */
export interface TaxService {
  calculate(input: TaxCalculationInput): Promise<TaxCalculationResult>;
}

/** Phase 1: no tax is added to prices. */
export class NoTaxService implements TaxService {
  async calculate(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    return { taxAmount: money(0n, input.amount.currency), regime: "NONE", breakdown: [] };
  }
}
