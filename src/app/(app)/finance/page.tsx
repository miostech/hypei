import { AlertTriangleIcon, BanknoteIcon, ClockIcon, LockIcon, ReceiptIcon, RotateCcwIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { SimulateSettlementButton } from "./simulate-settlement";

export const metadata = { title: "Financeiro" };

export default async function FinancePage({ searchParams }: PageProps<"/finance">) {
  const { organization } = await requirePagePermission("finance:read");
  const services = getServices();
  const params = await searchParams;
  const currencies = await services.finance.currencies(organization.id, organization.defaultCurrency);
  const requested = typeof params.currency === "string" ? params.currency : undefined;
  const currency = requested && currencies.includes(requested) ? requested : currencies[0];

  const [summary, movements, nextAvailable] = await Promise.all([
    services.finance.summary(organization.id, currency),
    services.finance.movements(organization.id, currency),
    services.finance.nextAvailableDate(organization.id, currency),
  ]);

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Todos os números vêm do ledger: cada movimentação é registrada em partida dobrada e nunca é editada."
        actions={
          <div className="flex items-center gap-2">
            {currencies.length > 1 &&
              currencies.map((c) => (
                <Button key={c} size="sm" variant={c === currency ? "secondary" : "ghost"} render={<Link href={`/finance?currency=${c}`} />}>
                  {c}
                </Button>
              ))}
            {process.env.APP_ENV !== "production" && <SimulateSettlementButton />}
            <Button variant="outline" render={<Link href="/payouts" />}>
              <BanknoteIcon />
              Saques
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Saldo disponível" value={formatAmount(summary.available, currency)} icon={WalletIcon} tone="positive" hint="Pode ser sacado agora" />
        <StatCard
          label="Saldo pendente"
          value={formatAmount(summary.pending, currency)}
          icon={ClockIcon}
          hint={nextAvailable ? `Libera em ${formatDateTime(nextAvailable)}` : "Sem liberações agendadas"}
        />
        <StatCard label="Saldo reservado" value={formatAmount(summary.reserved, currency)} icon={LockIcon} tone="warning" hint="Retido por disputas" />
        <StatCard label="Receita bruta" value={formatAmount(summary.grossRevenue, currency)} icon={ReceiptIcon} hint="Total capturado dos compradores" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Taxas Hypei" value={formatAmount(summary.platformFees, currency)} tone="muted" />
        <StatCard label="Taxas de processamento" value={formatAmount(summary.processorFees, currency)} tone="muted" />
        <StatCard label="Reembolsos" value={formatAmount(summary.refunds, currency)} icon={RotateCcwIcon} tone="muted" />
        <StatCard label="Chargebacks" value={formatAmount(summary.chargebacks, currency)} icon={AlertTriangleIcon} tone="muted" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Últimas movimentações</CardTitle>
          <CardDescription>Saldo do produtor após cada lançamento (pendente + disponível + reservado).</CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma movimentação financeira ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(row.date)}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.typeLabel}</Badge>
                    </TableCell>
                    <TableCell className={`tabular text-right ${row.amount > 0n ? "text-success" : row.amount < 0n ? "text-destructive" : ""}`}>
                      {row.amount > 0n ? "+" : ""}
                      {formatAmount(row.amount, currency)}
                    </TableCell>
                    <TableCell className="tabular text-right text-muted-foreground">{formatAmount(row.balanceAfter, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
