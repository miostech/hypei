/**
 * O cookie que carrega a indicação do afiliado entre a visita e a compra.
 *
 * Trinta dias porque as pessoas raramente compram na primeira visita, e quem mandou o
 * link deve receber o crédito quando elas voltam. Não é `httpOnly`: o formulário de
 * checkout lê o código no navegador para mandá-lo junto com a venda.
 */
export const REFERRAL_COOKIE = "kabrun_ref";
export const REFERRAL_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Normaliza como o código é escrito em todo lugar: o gerador só usa maiúsculas. */
export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}
