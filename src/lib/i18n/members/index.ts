import type { Locale } from "../locale";
import type { MembersDictionary } from "./pt";

/** Mesma mecânica do dicionário do checkout: um import por idioma, carregado sob demanda. */
const dictionaries: Record<Locale, () => Promise<MembersDictionary>> = {
  pt: () => import("./pt").then((module) => module.default),
  en: () => import("./en").then((module) => module.default),
  es: () => import("./es").then((module) => module.default),
  fr: () => import("./fr").then((module) => module.default),
  de: () => import("./de").then((module) => module.default),
  it: () => import("./it").then((module) => module.default),
};

export async function getMembersDictionary(locale: Locale): Promise<MembersDictionary> {
  return dictionaries[locale]();
}

export type { MembersDictionary };
