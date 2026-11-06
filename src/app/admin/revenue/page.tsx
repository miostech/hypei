import { ReceiptIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount, formatDate } from "@/lib/ui/format";
import { ADMIN_WINDOW_DAYS } from "@/modules/admin/platform-admin.service";
import { getServices } from "@/server/container";

export const metadata = { title: "Receita · Admin" };

export default async function AdminRevenuePage() {
  const services = getServices();
  const [overview, byDay] = await Promise.all([services.platformAdmin.overview(), services.platformAdmin.revenueByDay()]);

  const windowTotal = byDay.reduce((total, row) => total + row.amount, 0n);
  const currency = byDay[0]?.currency ?? overview.revenue[0]?.currency ?? "BRL";
  const peak = byDay.reduce((max, row) => (row.amount > max ? row.amount : max), 0n);

  return (
    <>
      <PageHeader
        title="Receita da plataforma"
        description="O que a Kabrun cobrou dos produtores, o que pagou ao adquirente e o que sobrou."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label={`Taxas em ${ADMIN_WINDOW_DAYS} dias`} value={formatAmount(windowTotal, currency)} tone="positive" />
        <StatCard
          label="Acumulado"
          value={overview.revenue[0] ? formatAmount(overview.revenue[0].net, overview.revenue[0].currency) : "—"}
          hint="Desde o início"
        />
        <StatCard
          label="Volume processado"
          value={overview.volume[0] ? formatAmount(overview.volume[0].total, overview.volume[0].currency) : "—"}
          hint={`Pagamentos confirmados em ${ADMIN_WINDOW_DAYS} dias`}
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
            <EmptyState icon={ReceiptIcon} title="Sem resultado ainda" description="Nenhuma taxa foi lançada até agora." />
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
          <CardDescription>Cada linha é o que a plataforma reteve em taxas naquele dia.</CardDescription>
        </CardHeader>
        <CardContent>
          {byDay.length === 0 ? (
            <EmptyState icon={ReceiptIcon} title="Sem receita no período" description="Nenhuma taxa foi lançada nos últimos dias." />
          ) : (
            <ul className="space-y-2">
              {byDay.map((row) => (
                <li key={`${row.day.toISOString()}-${row.currency}`} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">{formatDate(row.day)}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="bg-brand-gradient block h-full rounded-full"
                      style={{ width: peak > 0n ? `${Math.max(Number((row.amount * 100n) / peak), 2)}%` : "2%" }}
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
