import "server-only";
import { headers } from "next/headers";
import { isLocale, resolveLocale, type Locale } from "./locale";

/**
 * Idioma desta requisição.
 *
 * Vem do Accept-Language, não da URL. A doc do Next monta i18n sob `app/[lang]`, e seria o
 * caminho se o site todo fosse traduzido — mas aqui só o comprador é, e mover tudo para lá
 * trocaria a URL de cada tela do produtor (`/dashboard` → `/pt/dashboard`) para traduzir as
 * duas telas dele. O checkout já é dinâmico, então ler cabeçalho não custa cache nenhum.
 *
 * `override` é o ?lang= da própria página: é como o produtor brasileiro confere o checkout em
 * espanhol sem mexer no navegador, e como ele manda o link já no idioma do mercado.
 */
export async function requestLocale(override?: string | null): Promise<Locale> {
  if (isLocale(override)) return override;
  return resolveLocale((await headers()).get("accept-language"));
}
