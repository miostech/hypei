import { ReceiptIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount, formatDate } from "@/lib/ui/format";
import { ADMIN_PERIOD_PHRASE, parseAdminPeriod } from "@/modules/admin/admin-period";
import { getServices } from "@/server/container";
import { AdminPeriodTabs } from "../period-tabs";

export const metadata = { title: "Receita · Admin" };

/** Quantos dias o gráfico mostra no máximo: um ponto por dia, de "todo o tempo", não cabe. */
const MAX_CHART_DAYS = 90;

export default async function AdminRevenuePage({ searchParams }: PageProps<"/admin/revenue">) {
  const period = parseAdminPeriod((await searchParams).periodo);
  const phrase = ADMIN_PERIOD_PHRASE[period];
  const services = getServices();
  const [overview, allDays] = await Promise.all([services.platformAdmin.overview(period), services.platformAdmin.revenueByDay(period)]);

  // Os mais recentes: a lista vem em ordem crescente, e o que interessa é o fim dela.
  const byDay = allDays.slice(-MAX_CHART_DAYS);
  const trimmed = allDays.length > byDay.length;
  /*
    Pico por moeda, não da lista inteira. Com um só, a barra de uma taxa em dólar era comparada
    com a soma de um dia em real e saía um tracinho, como se o dia não tivesse rendido nada.
  */
  const peakByCurrency = new Map<string, bigint>();
  for (const row of byDay) {
    peakByCurrency.set(row.currency, row.amount > (peakByCurrency.get(row.currency) ?? 0n) ? row.amount : (peakByCurrency.get(row.currency) ?? 0n));
  }

  return (
    <>
      <PageHeader
        title="Receita da plataforma"
        description="O que a Kabrun cobrou dos produtores, o que pagou ao adquirente e o que sobrou."
      />

      <AdminPeriodTabs active={period} basePath="/admin/revenue" />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Taxas cobradas"
          value={byCurrency(overview.revenue.map((row) => ({ currency: row.currency, amount: row.net }))) ?? "—"}
          hint={`O que entrou de taxa ${phrase}`}
          tone="positive"
        />
        <StatCard
          label="Acumulado"
          value={byCurrency(overview.revenueAllTime.map((row) => ({ currency: row.currency, amount: row.net }))) ?? "—"}
          hint="Desde o início, fora do recorte"
        />
        <StatCard
          label="Volume processado"
          value={byCurrency(overview.volume.map((row) => ({ currency: row.currency, amount: row.total }))) ?? "—"}
          hint={`Pagamentos confirmados ${phrase}`}
        />
      </section>

      {/*
        O resultado, por moeda: a taxa que o produtor pagou menos o que a Kabrun pagou ao
        adquirente. Uma venda em dólar não abate custo em real, então cada moeda fecha sozinha.
      */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Lucro líquido</CardTitle>
          <CardDescription>
            O produtor paga só a taxa anunciada. O custo da Stripe sai dessa taxa, e o que sobra é o lucro da Kabrun.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {overview.profit.length === 0 ? (
            <EmptyState icon={ReceiptIcon} title="Sem resultado no período" description={`Nenhuma taxa foi lançada ${phrase}.`} />
          ) : (
            overview.profit.map((row) => (
              <dl key={row.currency} className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Taxas cobradas ({row.currency})</dt>
                  <dd className="tabular font-medium">{formatAmount(row.revenue, row.currency)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Pago ao adquirente</dt>
                  <Cost amount={row.processorFees} currency={row.currency} />
                </div>
                {row.acquirerLosses > 0n && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Perdido em devolução e chargeback</dt>
                    <Cost amount={row.acquirerLosses} currency={row.currency} />
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 border-t pt-2">
                  <dt className="font-medium">Lucro líquido</dt>
                  <dd className={`tabular text-base font-semibold ${row.net < 0n ? "text-destructive" : "text-success"}`}>
                    {formatAmount(row.net, row.currency)}
                  </dd>
                </div>
              </dl>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Por dia</CardTitle>
          <CardDescription>
            Cada linha é o que a plataforma reteve em taxas naquele dia
            {trimmed ? `, nos ${MAX_CHART_DAYS} dias mais recentes do recorte` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {byDay.length === 0 ? (
            <EmptyState icon={ReceiptIcon} title="Sem receita no período" description={`Nenhuma taxa foi lançada ${phrase}.`} />
          ) : (
            <ul className="space-y-2">
              {byDay.map((row) => (
                <li key={`${row.day.toISOString()}-${row.currency}`} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">{formatDate(row.day)}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="bg-brand-gradient block h-full rounded-full"
                      style={{ width: widthFor(row.amount, peakByCurrency.get(row.currency) ?? 0n) }}
                    />
                  </span>
                  <span className="tabular w-28 shrink-0 text-right text-sm font-medium">
                    {formatAmount(row.amount, row.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/**
 * Uma linha de custo. O "−" vem do sinal do valor, não colado na mão: custo negativo é dinheiro
 * que voltou, e "− -R$ 6,58" não é número que alguém leia. Acontece com lançamento antigo, de
 * antes de `PROCESSOR_FEES` virar despesa (ADR 011).
 */
function Cost({ amount, currency }: { amount: bigint; currency: string }) {
  const negative = amount < 0n;
  return (
    <dd className={`tabular ${negative ? "text-success" : "text-destructive"}`}>
      {negative ? "+" : "−"} {formatAmount(negative ? -amount : amount, currency)}
    </dd>
  );
}

/** Uma linha por moeda no card: somar real com dólar daria um número que não existe. */
function byCurrency(entries: { currency: string; amount: bigint }[]): string[] | null {
  const real = entries.filter((entry) => entry.amount !== 0n);
  if (real.length === 0) return null;
  return real.sort((a, b) => a.currency.localeCompare(b.currency)).map((entry) => formatAmount(entry.amount, entry.currency));
}

/** Nunca zero: um dia que rendeu pouco precisa de um traço visível, ou parece dia sem venda. */
function widthFor(amount: bigint, peak: bigint): string {
  if (peak <= 0n || amount <= 0n) return "2%";
  return `${Math.max(Number((amount * 100n) / peak), 2)}%`;
}
