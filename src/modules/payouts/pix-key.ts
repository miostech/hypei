import type { PixKeyType } from "@/generated/prisma/enums";
import { validateTaxId } from "@/modules/compliance/tax-identity";

const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** Chave aleatória: o UUID que o banco gera. */
const EVP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** O DICT limita o e-mail a 77 caracteres. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Celular é DDD mais nove dígitos começando em 9; fixo é DDD mais oito começando em 2–5.
 * Sem esta forma, qualquer sequência de onze dígitos viraria telefone — inclusive um CPF
 * digitado errado, que é exatamente o que não pode passar.
 */
function validBrazilianNumber(digits: string): boolean {
  const ddd = Number(digits.slice(0, 2));
  if (!(ddd >= 11 && ddd <= 99)) return false;
  const rest = digits.slice(2);
  if (rest.length === 9) return rest.startsWith("9");
  if (rest.length === 8) return /^[2-5]/.test(rest);
  return false;
}

/**
 * O telefone no DICT é E.164: `+55` e o número com DDD. Aceitamos o jeito que a produtora
 * digita — `(11) 99999-9999`, `11999999999`, `+55 11 99999-9999` — e devolvemos um só formato.
 */
function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const d = onlyDigits(trimmed);
  // Número de fora do Brasil: não sabemos a forma de cada país, só o tamanho que o E.164 permite.
  const foreign = trimmed.startsWith("+") && !d.startsWith("55");
  if (foreign) return d.length >= 8 && d.length <= 15 ? `+${d}` : null;

  const national = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  return validBrazilianNumber(national) ? `+55${national}` : null;
}

export interface PixKey {
  type: PixKeyType;
  /** Como o valor entra no DICT: só dígitos no documento, E.164 no telefone, minúsculo no resto. */
  value: string;
}

/**
 * Lê o que a produtora digitou e descobre que chave é. O tipo não é perguntado: o formato já
 * diz, e perguntar é um campo a mais para ela errar.
 *
 * Devolve `null` quando nada bate — aí a chave está errada, e é melhor recusar agora do que
 * descobrir no saque.
 */
export function parsePixKey(raw: string): PixKey | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (EVP.test(trimmed)) return { type: "EVP", value: trimmed.toLowerCase() };
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    return EMAIL.test(email) && email.length <= 77 ? { type: "EMAIL", value: email } : null;
  }

  const digits = onlyDigits(trimmed);
  const phone = normalizePhone(trimmed);
  // Um celular com DDD tem onze dígitos, igual a um CPF. Os parênteses e o `+55` desempatam;
  // sem eles, vale o dígito verificador — se fecha como CPF é CPF, se não fecha é telefone.
  const looksLikePhone = trimmed.startsWith("+") || trimmed.includes("(");
  if (!looksLikePhone) {
    // O documento é reconhecido pelo tamanho; o dígito verificador decide se é válido. Sem essa
    // checagem, um CPF digitado errado vira um saque que falha semanas depois.
    if (digits.length === 11 && validateTaxId("CPF", "BR", digits)) return { type: "CPF", value: digits };
    if (digits.length === 14) return validateTaxId("CNPJ", "BR", digits) ? { type: "CNPJ", value: digits } : null;
  }

  return phone ? { type: "PHONE", value: phone } : null;
}

/**
 * O que vai para log, auditoria e e-mail. A chave inteira fica no banco porque é preciso para
 * pagar; repeti-la em todo lugar que registra o saque é que não.
 */
export function maskPixKey(key: PixKey): string {
  switch (key.type) {
    case "CPF":
      return `•••.•••.${key.value.slice(6, 9)}-••`;
    case "CNPJ":
      return `••.•••.•••/${key.value.slice(8, 12)}-••`;
    case "EMAIL": {
      const [user, domain] = key.value.split("@");
      return `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
    }
    case "PHONE":
      return `${key.value.slice(0, 3)} ••••• ${key.value.slice(-4)}`;
    case "EVP":
      return `${key.value.slice(0, 8)}…${key.value.slice(-4)}`;
  }
}
