import "server-only";
import { cookies, headers } from "next/headers";
import { isLocale, LANG_COOKIE, resolveLocale, type Locale } from "./locale";

/**
 * Idioma desta requisição.
 *
 * Vem do Accept-Language, não da URL. A doc do Next monta i18n sob `app/[lang]`, e seria o
 * caminho se o site todo fosse traduzido — mas aqui só o comprador é, e mover tudo para lá
 * trocaria a URL de cada tela do produtor (`/dashboard` → `/pt/dashboard`) para traduzir as
 * duas telas dele. O checkout já é dinâmico, então ler cabeçalho não custa cache nenhum.
 *
 * `override` é o ?lang= da própria página: é como o produtor brasileiro confere o checkout em
 * espanhol sem mexer no navegador, e como ele manda o link já no idioma do mercado. O proxy
 * guarda esse pedido no cookie, que é o que faz a escolha sobreviver ao clique seguinte — sem
 * ele, só a página que trouxe o parâmetro ficaria traduzida.
 *
 * Nesta ordem: o que a URL pede agora, depois o que já foi pedido, e por último o navegador.
 */
export async function requestLocale(override?: string | null): Promise<Locale> {
  if (isLocale(override)) return override;

  const stored = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(stored)) return stored;

  return resolveLocale((await headers()).get("accept-language"));
}

/** O ?lang= da página, quando houver. Entrada inválida vira null e o cabeçalho decide. */
export function langParam(query: Record<string, string | string[] | undefined>): string | null {
  return typeof query.lang === "string" ? query.lang : null;
}
