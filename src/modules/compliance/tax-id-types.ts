import type { TaxIdType } from "@/generated/prisma/enums";

/**
 * Which tax identity types make sense per country and business type. Never assume CPF.
 * Kept separate from the hashing/validation helpers so the UI can import it safely.
 */
export const TAX_ID_TYPES_BY_COUNTRY: Record<string, { INDIVIDUAL: TaxIdType[]; COMPANY: TaxIdType[] }> = {
  BR: { INDIVIDUAL: ["CPF"], COMPANY: ["CNPJ"] },
  PT: { INDIVIDUAL: ["NIF"], COMPANY: ["NIF", "VAT_ID"] },
  ES: { INDIVIDUAL: ["NIF"], COMPANY: ["NIF", "VAT_ID"] },
  FR: { INDIVIDUAL: ["TIN"], COMPANY: ["VAT_ID"] },
  DE: { INDIVIDUAL: ["TIN"], COMPANY: ["VAT_ID"] },
  IT: { INDIVIDUAL: ["TIN"], COMPANY: ["VAT_ID"] },
  US: { INDIVIDUAL: ["SSN", "TIN"], COMPANY: ["EIN"] },
};
