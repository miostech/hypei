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
        description="Taxas da Ripay lançadas no ledger, já descontados os estornos de reembolso e chargeback."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label={`Últimos ${ADMIN_WINDOW_DAYS} dias`} value={formatAmount(windowTotal, currency)} tone="positive" />
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
