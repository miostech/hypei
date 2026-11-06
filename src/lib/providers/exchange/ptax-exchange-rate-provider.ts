import { ProviderError } from "@/lib/errors";
import { RATE_SCALE, type CurrencyCode } from "@/lib/money";
import type { ExchangeRateProvider, ExchangeRateQuote } from "./exchange-rate-provider";

const ENDPOINT = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)";

/** Um boletim do dia: o Banco Central publica vários, da abertura ao fechamento. */
interface PtaxBulletin {
  cotacaoCompra: number;
  cotacaoVenda: number;
  dataHoraCotacao: string;
  tipoBoletim: string;
}

export interface PtaxOptions {
  /** Outro endpoint — é o que o teste aponta para um servidor local. */
  endpoint?: string;
  now?: () => Date;
  fetch?: typeof globalThis.fetch;
  /** Quantos dias para trás procurar quando o dia de hoje ainda não tem boletim. */
  maxLookbackDays?: number;
  /** Por quanto tempo a mesma cotação é reaproveitada, em milissegundos. */
  cacheTtlMs?: number;
  timeoutMs?: number;
}

/** A data no fuso de Brasília, no formato que a API espera (MM-DD-AAAA). */
function brazilianDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("month")}-${get("day")}-${get("year")}`;
}

const scaled = (value: number) => BigInt(Math.round(value * Number(RATE_SCALE)));

/**
 * A cotação oficial do Banco Central (PTAX).
 *
 * É a referência pública para converter moeda estrangeira em real, e é de propósito que a
 * Kabrun não inventa a dela: o produtor consegue conferir no site do Banco Central o número
 * que apareceu no saque dele.
 *
 * Os dois lados da cotação são usados como o mercado usa: quem entrega moeda estrangeira
 * recebe pela **compra** (é o que se paga a quem vende dólar) e quem recebe moeda estrangeira
 * paga pela **venda**. A diferença entre as duas é o spread publicado pelo Banco Central, não
 * uma margem que a plataforma põe por cima.
 *
 * O boletim usado é o último publicado no dia — fechamento depois das 13h, e o intermediário
 * mais recente antes disso. Fim de semana e feriado não têm boletim: a busca volta no
 * calendário até achar o último dia útil.
 */
export class PtaxExchangeRateProvider implements ExchangeRateProvider {
  private readonly cache = new Map<string, { bulletin: PtaxBulletin; fetchedAt: number }>();

  constructor(private readonly options: PtaxOptions = {}) {}

  async quote(from: CurrencyCode, to: CurrencyCode): Promise<ExchangeRateQuote> {
    const quotedAt = (this.options.now ?? (() => new Date()))();
    if (from === to) return { from, to, rate: RATE_SCALE, source: "ptax", quotedAt };

    // Tudo passa pelo real, porque é contra o real que a PTAX cota.
    if (to === "BRL") {
      const bulletin = await this.bulletinFor(from);
      return this.quoteOf(from, to, scaled(bulletin.cotacaoCompra), bulletin);
    }
    if (from === "BRL") {
      const bulletin = await this.bulletinFor(to);
      return this.quoteOf(from, to, (RATE_SCALE * RATE_SCALE) / scaled(bulletin.cotacaoVenda), bulletin);
    }

    // Dólar para euro (ou o contrário) é a travessia das duas pontas: vende uma, compra a outra.
    const [sold, bought] = await Promise.all([this.bulletinFor(from), this.bulletinFor(to)]);
    const rate = (scaled(sold.cotacaoCompra) * RATE_SCALE) / scaled(bought.cotacaoVenda);
    return this.quoteOf(from, to, rate, sold);
  }

  private quoteOf(from: CurrencyCode, to: CurrencyCode, rate: bigint, bulletin: PtaxBulletin): ExchangeRateQuote {
    if (rate <= 0n) throw new ProviderError("ptax", `Invalid rate for ${from}->${to}`);
    return {
      from,
      to,
      rate,
      // A fonte vai congelada no saque: o boletim exato que gerou o número.
      source: `ptax:${bulletin.tipoBoletim}:${bulletin.dataHoraCotacao}`,
      quotedAt: new Date(`${bulletin.dataHoraCotacao.replace(" ", "T")}-03:00`),
    };
  }

  /** O último boletim publicado para esta moeda, procurando do dia de hoje para trás. */
  private async bulletinFor(currency: CurrencyCode): Promise<PtaxBulletin> {
    const now = (this.options.now ?? (() => new Date()))();
    const cached = this.cache.get(currency);
    if (cached && now.getTime() - cached.fetchedAt < (this.options.cacheTtlMs ?? 10 * 60_000)) {
      return cached.bulletin;
    }

    const lookback = this.options.maxLookbackDays ?? 7;
    for (let back = 0; back <= lookback; back += 1) {
      const day = new Date(now.getTime() - back * 86_400_000);
      const bulletins = await this.fetchDay(currency, brazilianDate(day));
      const latest = bulletins.at(-1);
      if (latest) {
        this.cache.set(currency, { bulletin: latest, fetchedAt: now.getTime() });
        return latest;
      }
    }
    throw new ProviderError("ptax", `No PTAX bulletin for ${currency} in the last ${lookback} days`);
  }

  private async fetchDay(currency: CurrencyCode, date: string): Promise<PtaxBulletin[]> {
    const url = `${this.options.endpoint ?? ENDPOINT}?@moeda='${currency}'&@dataCotacao='${date}'&$format=json`;
    const doFetch = this.options.fetch ?? globalThis.fetch;
    const response = await doFetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 8_000),
    }).catch((error: unknown) => {
      throw new ProviderError("ptax", `Could not reach the Banco Central: ${String(error)}`);
    });
    if (!response.ok) throw new ProviderError("ptax", `Banco Central answered ${response.status}`);

    const body = (await response.json()) as { value?: PtaxBulletin[] };
    return body.value ?? [];
  }
}
