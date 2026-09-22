import { createHmac } from "node:crypto";
import type { TaxIdType } from "@/generated/prisma/enums";
export { TAX_ID_TYPES_BY_COUNTRY } from "./tax-id-types";


const onlyDigits = (v: string) => v.replace(/\D/g, "");

function validCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

function validCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

function validPtNif(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 9) return false;
  const sum = d.slice(0, 8).split("").reduce((acc, c, i) => acc + Number(c) * (9 - i), 0);
  const check = 11 - (sum % 11);
  return (check >= 10 ? 0 : check) === Number(d[8]);
}

/** Format-level validation only. Real identity verification is done by the provider's KYC. */
export function validateTaxId(type: TaxIdType, country: string, value: string): boolean {
  const v = value.trim();
  switch (type) {
    case "CPF":
      return validCpf(v);
    case "CNPJ":
      return validCnpj(v);
    case "NIF":
      return country === "PT" ? validPtNif(v) : /^[A-Z0-9]{8,10}$/i.test(v.replace(/[\s-]/g, ""));
    case "VAT_ID":
      return /^[A-Z]{2}[A-Z0-9]{8,12}$/i.test(v.replace(/[\s.-]/g, ""));
    case "EIN":
      return /^\d{2}-?\d{7}$/.test(v);
    case "SSN":
    case "TIN":
      return /^[A-Z0-9-]{6,20}$/i.test(v.replace(/\s/g, ""));
    default:
      return v.length >= 4;
  }
}

/** Only the last 4 characters are ever shown/stored in clear. */
export function maskTaxId(value: string): string {
  const clean = value.replace(/[\s.\-/]/g, "");
  return `${"•".repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
}

/** Keyed hash for deduplication (detect the same document across organizations) without storing it. */
export function hashTaxId(type: TaxIdType, value: string, secret: string): string {
  const clean = value.replace(/[\s.\-/]/g, "").toUpperCase();
  return createHmac("sha256", secret).update(`${type}:${clean}`).digest("hex");
}
