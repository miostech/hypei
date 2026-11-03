import type { Locale } from "../locale";
import type { CheckoutDictionary } from "./pt";

/**
 * Um import por idioma, carregado sob demanda: a página só traz o dicionário que vai renderizar.
 *
 * `Record<Locale, …>` é o que impede acrescentar um idioma em `SUPPORTED_LOCALES` e esquecer o
 * dicionário — sem ele, `resolveLocale` passaria a devolver um idioma sem texto.
 */
const dictionaries: Record<Locale, () => Promise<CheckoutDictionary>> = {
  pt: () => import("./pt").then((module) => module.default),
  en: () => import("./en").then((module) => module.default),
  es: () => import("./es").then((module) => module.default),
  fr: () => import("./fr").then((module) => module.default),
  de: () => import("./de").then((module) => module.default),
  it: () => import("./it").then((module) => module.default),
};

export async function getCheckoutDictionary(locale: Locale): Promise<CheckoutDictionary> {
  return dictionaries[locale]();
}

export type { CheckoutDictionary };
