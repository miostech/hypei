import { describe, expect, it } from "vitest";
import { PtaxExchangeRateProvider } from "@/lib/providers/exchange";
import { RATE_SCALE } from "@/lib/money";

const bulletin = (compra: number, venda: number, tipo: string, hora: string) => ({
  cotacaoCompra: compra,
  cotacaoVenda: venda,
  dataHoraCotacao: hora,
  tipoBoletim: tipo,
});

/** Uma PTAX de mentira que responde o que o teste mandar, por moeda e por data. */
function fakeBcb(days: Record<string, Record<string, unknown[]>>) {
  const calls: string[] = [];
  const fetch = async (url: string | URL | Request) => {
    const text = String(url);
    const currency = /@moeda='(\w+)'/.exec(text)![1];
    const date = /@dataCotacao='([\d-]+)'/.exec(text)![1];
    calls.push(`${currency}@${date}`);
    return Response.json({ value: days[currency]?.[date] ?? [] });
  };
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

// Quarta-feira, 18h em Brasília: o fechamento do dia já saiu.
const NOW = new Date("2026-11-04T21:00:00Z");

describe("PTAX exchange rates", () => {
  it("converte dólar em real pelo último boletim do dia", async () => {
    const bcb = fakeBcb({
      USD: {
        "11-04-2026": [
          bulletin(5.4663, 5.4669, "Abertura", "2026-11-04 10:07:11.299"),
          bulletin(5.472, 5.4726, "Fechamento PTAX", "2026-11-04 13:09:02.123"),
        ],
      },
    });
    const ptax = new PtaxExchangeRateProvider({ now: () => NOW, fetch: bcb.fetch });

    const quote = await ptax.quote("USD", "BRL");
    expect(quote.rate).toBe(547_200_000n); // a compra do fechamento, não a abertura
    expect(quote.source).toContain("Fechamento PTAX");
    expect(quote.from).toBe("USD");
    expect(quote.to).toBe("BRL");
  });

  it("volta no calendário quando o dia não tem boletim", async () => {
    // Domingo: o último boletim é o de sexta.
    const sunday = new Date("2026-11-08T15:00:00Z");
    const bcb = fakeBcb({ USD: { "11-06-2026": [bulletin(5.5, 5.51, "Fechamento PTAX", "2026-11-06 13:09:02.123")] } });
    const ptax = new PtaxExchangeRateProvider({ now: () => sunday, fetch: bcb.fetch });

    expect((await ptax.quote("USD", "BRL")).rate).toBe(550_000_000n);
    expect(bcb.calls).toEqual(["USD@11-08-2026", "USD@11-07-2026", "USD@11-06-2026"]);
  });

  it("usa a venda no caminho de volta: quem recebe dólar paga mais caro que quem vende", async () => {
    const bcb = fakeBcb({ USD: { "11-04-2026": [bulletin(5.0, 5.5, "Fechamento PTAX", "2026-11-04 13:09:02.123")] } });
    const ptax = new PtaxExchangeRateProvider({ now: () => NOW, fetch: bcb.fetch });

    expect((await ptax.quote("USD", "BRL")).rate).toBe(500_000_000n); // R$ 5,00 por dólar entregue
    expect((await ptax.quote("BRL", "USD")).rate).toBe((RATE_SCALE * RATE_SCALE) / 550_000_000n); // 1/5,50
  });

  it("atravessa dólar e euro pelas duas pontas", async () => {
    const bcb = fakeBcb({
      USD: { "11-04-2026": [bulletin(5.5, 5.52, "Fechamento PTAX", "2026-11-04 13:09:02.123")] },
      EUR: { "11-04-2026": [bulletin(6.1, 6.2, "Fechamento PTAX", "2026-11-04 13:09:02.456")] },
    });
    const ptax = new PtaxExchangeRateProvider({ now: () => NOW, fetch: bcb.fetch });

    // Vende dólar a 5,50 e compra euro a 6,20: 0,887…
    expect((await ptax.quote("USD", "EUR")).rate).toBe((550_000_000n * RATE_SCALE) / 620_000_000n);
  });

  it("falha em vez de inventar número quando o Banco Central não responde", async () => {
    const ptax = new PtaxExchangeRateProvider({
      now: () => NOW,
      fetch: (async () => {
        throw new Error("network down");
      }) as unknown as typeof globalThis.fetch,
    });

    await expect(ptax.quote("USD", "BRL")).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });

  it("não vai ao Banco Central quando não há o que converter", async () => {
    const bcb = fakeBcb({});
    const ptax = new PtaxExchangeRateProvider({ now: () => NOW, fetch: bcb.fetch });

    expect((await ptax.quote("BRL", "BRL")).rate).toBe(RATE_SCALE);
    expect(bcb.calls).toHaveLength(0);
  });
});
