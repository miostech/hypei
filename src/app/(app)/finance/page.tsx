import {
  AlertTriangleIcon,
  ArrowDownLeftIcon,
  BanknoteIcon,
  LockIcon,
  type LucideIcon,
  ReceiptIcon,
  RotateCcwIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UnlockIcon,
} from "lucide-react";
import Link from "next/link";
import { BalanceHero } from "@/components/shared/balance-hero";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount, formatDate, formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { SimulateSettlementButton } from "./simulate-settlement";

export const metadata = { title: "Financeiro" };

/** Each journal type gets its own icon + tone, so a movement is readable at a glance. */
const MOVEMENT_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  "payment.captured": { icon: ShoppingBagIcon, className: "bg-success/10 text-success" },
  "settlement.released": { icon: UnlockIcon, className: "bg-accent text-accent-foreground" },
  "refund.completed": { icon: RotateCcwIcon, className: "bg-destructive/10 text-destructive" },
  "dispute.hold": { icon: LockIcon, className: "bg-warning/12 text-warning" },
  "dispute.won": { icon: SparklesIcon, className: "bg-success/10 text-success" },
  "dispute.lost": { icon: AlertTriangleIcon, className: "bg-destructive/10 text-destructive" },
  "payout.initiated": { icon: ArrowDownLeftIcon, className: "bg-gold/15 text-warning" },
  "payout.paid": { icon: BanknoteIcon, className: "bg-gold/15 text-warning" },
  "payout.reversed": { icon: RotateCcwIcon, className: "bg-warning/12 text-warning" },
};

export default async function FinancePage({ searchParams }: PageProps<"/finance">) {
  const { organization } = await requirePagePermission("finance:read");
  const services = getServices();
  const params = await searchParams;
  const currencies = await services.finance.currencies(organization.id, organization.defaultCurrency);
  const requested = typeof params.currency === "string" ? params.currency : undefined;
  const currency = requested && currencies.includes(requested) ? requested : currencies[0];

  const [summary, movements, nextAvailable] = await Promise.all([
    services.finance.summary(organization.id, currency),
    services.finance.movements(organization.id, currency, 40),
    services.finance.nextAvailableDate(organization.id, currency),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Seu dinheiro, lançamento por lançamento"
        description="Todos os números vêm do ledger: cada movimentação é registrada em partida dobrada e nunca é editada."
        actions={
          <>
            {currencies.length > 1 && (
              <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
                {currencies.map((code) => (
                  <Button
                    key={code}
                    size="sm"
                    variant={code === currency ? "default" : "ghost"}
                    className="h-7 rounded-lg px-2.5"
                    render={<Link href={`/finance?currency=${code}`} />}
                  >
                    {code}
                  </Button>
                ))}
              </div>
            )}
            {process.env.APP_ENV !== "production" && <SimulateSettlementButton />}
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <BalanceHero
          className="lg:col-span-2"
          currency={currency}
          available={formatAmount(summary.available, currency)}
          pending={formatAmount(summary.pending, currency)}
          reserved={formatAmount(summary.reserved, currency)}
          footnote={
            nextAvailable ? `Próxima liberação em ${formatDate(nextAvailable)}.` : "Sem liberações agendadas no momento."
          }
          actions={
            <Button className="bg-gold-gradient border-0 text-gold-foreground shadow-gold hover:opacity-90" render={<Link href="/payouts" />}>
              <BanknoteIcon />
              Solicitar saque
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard label="Receita bruta" value={formatAmount(summary.grossRevenue, currency)} icon={ReceiptIcon} hint="Total capturado dos compradores" />
          <StatCard label="Taxas Ripay" value={formatAmount(summary.platformFees, currency)} tone="gold" icon={SparklesIcon} hint="Comissão da plataforma" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Taxas de processamento" value={formatAmount(summary.processorFees, currency)} tone="muted" />
        <StatCard label="Reembolsos" value={formatAmount(summary.refunds, currency)} icon={RotateCcwIcon} tone="muted" />
        <StatCard label="Chargebacks" value={formatAmount(summary.chargebacks, currency)} icon={AlertTriangleIcon} tone="muted" />
        <StatCard label="Saldo reservado" value={formatAmount(summary.reserved, currency)} icon={LockIcon} tone={summary.reserved > 0n ? "warning" : "muted"} hint="Retido por disputas" />
      </section>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Movimentações</CardTitle>
          <CardDescription>Saldo do produtor após cada lançamento (pendente + disponível + reservado).</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {movements.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma movimentação financeira ainda.</p>
          ) : (
            <ul className="divide-y">
              {movements.map((row) => {
                const style = MOVEMENT_STYLE[row.type] ?? { icon: ReceiptIcon, className: "bg-muted text-muted-foreground" };
                const Icon = style.icon;
                return (
                  <li key={row.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${style.className}`}>
                      <Icon className="size-4.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.typeLabel} · {formatDateTime(row.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`tabular text-sm font-semibold ${
                          row.amount > 0n ? "text-success" : row.amount < 0n ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {row.amount > 0n ? "+" : ""}
                        {formatAmount(row.amount, currency)}
                      </p>
                      <p className="tabular text-xs text-muted-foreground">saldo {formatAmount(row.balanceAfter, currency)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
