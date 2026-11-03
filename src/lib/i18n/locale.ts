/**
 * Idioma do comprador.
 *
 * Só o que o comprador lê é traduzido. O app do produtor segue em pt-BR: quem vende na Kabrun
 * é brasileiro, e traduzir as 491 strings dele seria trabalho sem leitor.
 *
 * O recorte é por idioma, não por país: "pt" serve Brasil e Portugal com o mesmo texto, e
 * separar pt-BR de pt-PT custaria dois dicionários quase iguais para ganhar meia dúzia de
 * palavras. A etiqueta BCP-47 que o Intl e a Stripe pedem sai do próprio dicionário
 * (`localeTag`) — é lá que mora a decisão de que o nosso português é o do Brasil.
 *
 * Este módulo roda nos dois lados: metade do checkout é client component, então nada de
 * servidor pode entrar aqui.
 */
export const SUPPORTED_LOCALES = ["pt", "en", "es", "fr", "de", "it"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * A etiqueta BCP-47 de cada dicionário, que é o que o Intl, o atributo lang= e a Stripe pedem.
 *
 * É união fechada e não `string` porque a Stripe só aceita locales da lista dela: tipada assim,
 * `locale: dict.localeTag` no Payment Element passa sem conversão, e um idioma novo com
 * etiqueta que a Stripe não conhece para de compilar em vez de renderizar o cartão em inglês.
 */
export type LocaleTag = "pt-BR" | "en" | "es" | "fr" | "de" | "it";

/** Português, porque é a língua de quem vende e o destino de quem não pedir nada. */
export const DEFAULT_LOCALE: Locale = "pt";

export function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Escolhe o idioma a partir do Accept-Language do navegador.
 *
 * Compara só a subtag primária, porque é a granularidade dos dicionários: "es-419" e "es-AR"
 * são ambos "es". Respeita o q= porque é assim que o navegador declara a ordem de preferência
 * de quem é bilíngue — ignorar isso daria inglês a um espanhol que mandou "en;q=0.3, es;q=0.9".
 */
export function resolveLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((entry) => {
      const [tag, ...parameters] = entry.split(";");
      const quality = parameters.map((p) => /^\s*q=([\d.]+)\s*$/.exec(p)?.[1]).find(Boolean);
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        // Sem q= o peso é 1, como manda o RFC 9110; q=0 significa "não aceito" e sai da lista.
        quality: quality === undefined ? 1 : Number(quality),
      };
    })
    .filter((entry) => entry.language && Number.isFinite(entry.quality) && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ranked) {
    if (isLocale(entry.language)) return entry.language;
  }
  return DEFAULT_LOCALE;
}

/**
 * Interpola {chave} nos textos do dicionário.
 *
 * Existe porque frase partida não traduz: "Garantia de" + número + "dias" impõe a ordem do
 * português, e em alemão o número vem antes ("7 Tage Garantie"). O dicionário guarda a frase
 * inteira com o buraco marcado, e quem renderiza preenche.
 *
 * Chave sem valor fica visível como {chave} em vez de virar vazio: numa página de pagamento,
 * texto estranho é bug que alguém reporta, e frase mutilada em silêncio não é.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    key in values ? String(values[key]) : placeholder,
  );
}
