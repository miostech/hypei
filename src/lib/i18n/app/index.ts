import { SUPPORTED_LOCALES, type Locale } from "../locale";
import type { AppDictionary } from "./pt";

/** Mesma mecânica das outras famílias: um import por idioma, carregado sob demanda. */
const dictionaries: Record<Locale, () => Promise<AppDictionary>> = {
  pt: () => import("./pt").then((module) => module.default),
  en: () => import("./en").then((module) => module.default),
  es: () => import("./es").then((module) => module.default),
  fr: () => import("./fr").then((module) => module.default),
  de: () => import("./de").then((module) => module.default),
  it: () => import("./it").then((module) => module.default),
};

export async function getAppDictionary(locale: Locale): Promise<AppDictionary> {
  return dictionaries[locale]();
}

/**
 * Os idiomas como o seletor os mostra: cada um escrito no próprio idioma.
 *
 * Sai dos dicionários em vez de uma lista à parte para não existirem dois lugares onde o nome
 * de um idioma mora. Custa carregar os seis módulos, que o cache do Node resolve no primeiro
 * request — e são seis objetos de texto, não seis bundles de cliente.
 */
export async function languageOptions(): Promise<{ locale: Locale; name: string }[]> {
  return Promise.all(
    SUPPORTED_LOCALES.map(async (locale) => ({ locale, name: (await dictionaries[locale]()).languageName })),
  );
}

export type { AppDictionary };
