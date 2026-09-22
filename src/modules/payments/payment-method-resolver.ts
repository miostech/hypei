import type { PaymentMethodType, PaymentProviderType } from "@/generated/prisma/enums";

/**
 * Provider capability matrix (what the PROVIDER can process per currency/country).
 * This is not the final answer: merchant configuration and checkout config narrow it further.
 */
type Capability = { currencies: string[]; countries?: string[] };

const PROVIDER_CAPABILITIES: Partial<Record<PaymentProviderType, Partial<Record<PaymentMethodType, Capability>>>> = {
  STRIPE: {
    CREDIT_CARD: { currencies: ["BRL", "EUR", "USD"] },
    DEBIT_CARD: { currencies: ["BRL", "EUR", "USD"] },
    APPLE_PAY: { currencies: ["BRL", "EUR", "USD"] },
    GOOGLE_PAY: { currencies: ["BRL", "EUR", "USD"] },
    PIX: { currencies: ["BRL"], countries: ["BR"] },
    BOLETO: { currencies: ["BRL"], countries: ["BR"] },
    SEPA_DEBIT: { currencies: ["EUR"], countries: ["PT", "ES", "FR", "DE", "IT"] },
    BANK_TRANSFER: { currencies: ["EUR", "USD"] },
  },
  MOCK: {
    CREDIT_CARD: { currencies: ["BRL", "EUR", "USD"] },
    PIX: { currencies: ["BRL"], countries: ["BR"] },
    SEPA_DEBIT: { currencies: ["EUR"] },
    APPLE_PAY: { currencies: ["BRL", "EUR", "USD"] },
    GOOGLE_PAY: { currencies: ["BRL", "EUR", "USD"] },
  },
};

export interface ResolvePaymentMethodsInput {
  provider: PaymentProviderType;
  currency: string;
  /** Country of the selling organization (where the merchant account is registered). */
  merchantCountry: string;
  /** Methods the merchant enabled at the provider (e.g. Pix activated). Undefined = provider defaults. */
  merchantEnabledMethods?: PaymentMethodType[];
  /** Methods selected in the checkout configuration. Empty = all available. */
  checkoutEnabledMethods?: PaymentMethodType[];
  /** Pix/Boleto require explicit merchant activation at Stripe; default off unless enabled. */
  requireExplicitActivation?: PaymentMethodType[];
}

const DEFAULT_EXPLICIT: PaymentMethodType[] = ["PIX", "BOLETO", "BANK_TRANSFER"];

/** Returns ONLY the methods that are really available for this checkout. */
export function resolvePaymentMethods(input: ResolvePaymentMethodsInput): PaymentMethodType[] {
  const capabilities = PROVIDER_CAPABILITIES[input.provider] ?? {};
  const explicit = input.requireExplicitActivation ?? (input.provider === "STRIPE" ? DEFAULT_EXPLICIT : []);

  return (Object.entries(capabilities) as [PaymentMethodType, Capability][])
    .filter(([, cap]) => cap.currencies.includes(input.currency))
    .filter(([, cap]) => !cap.countries || cap.countries.includes(input.merchantCountry))
    .map(([method]) => method)
    .filter((m) => (input.merchantEnabledMethods ? input.merchantEnabledMethods.includes(m) : !explicit.includes(m)))
    .filter((m) => !input.checkoutEnabledMethods?.length || input.checkoutEnabledMethods.includes(m));
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  PIX: "Pix",
  BOLETO: "Boleto",
  SEPA_DEBIT: "Débito SEPA",
  BANK_TRANSFER: "Transferência bancária",
  APPLE_PAY: "Apple Pay",
  GOOGLE_PAY: "Google Pay",
  PAYPAL: "PayPal",
};
