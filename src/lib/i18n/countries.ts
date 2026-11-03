import { SUPPORTED_COUNTRIES, type CountryCode } from "@/modules/organizations/countries";

/**
 * Nomes de país no idioma do comprador, vindos da tabela ICU do runtime em vez de uma nossa.
 *
 * `COUNTRY_INFO` tem os nomes em português e continua servindo o app do produtor; repetir a
 * mesma lista em seis idiomas seriam 42 strings para dizer o que o Intl já sabe.
 *
 * Resolve no servidor e desce como prop de propósito: a tabela ICU do Node e a do navegador
 * podem divergir de versão, e divergência em texto renderizado é erro de hidratação.
 */
export function localizedCountries(localeTag: string): { code: CountryCode; name: string }[] {
  const names = new Intl.DisplayNames([localeTag], { type: "region" });
  const collator = new Intl.Collator(localeTag);
  return SUPPORTED_COUNTRIES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
    collator.compare(a.name, b.name),
  );
}
