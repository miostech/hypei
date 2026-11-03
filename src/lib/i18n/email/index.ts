import { DEFAULT_LOCALE, isLocale, type Locale } from "../locale";
import type { EmailDictionary } from "./pt";

const dictionaries: Record<Locale, () => Promise<EmailDictionary>> = {
  pt: () => import("./pt").then((module) => module.default),
  en: () => import("./en").then((module) => module.default),
  es: () => import("./es").then((module) => module.default),
  fr: () => import("./fr").then((module) => module.default),
  de: () => import("./de").then((module) => module.default),
  it: () => import("./it").then((module) => module.default),
};

export async function getEmailDictionary(locale: Locale): Promise<EmailDictionary> {
  return dictionaries[locale]();
}

/**
 * O idioma guardado no comprador, que é texto livre vindo do banco.
 *
 * Nulo é o caso normal de quem comprou antes desta coluna existir: cai em português, que é o
 * que esses e-mails já diziam.
 */
export function storedLocale(value: string | null | undefined): Locale {
  if (isLocale(value)) return value;
  // Tolera "pt-BR" e afins, caso um dia alguém grave a etiqueta completa em vez do idioma.
  const language = value?.toLowerCase().split("-")[0];
  return isLocale(language) ? language : DEFAULT_LOCALE;
}

export type { EmailDictionary };
