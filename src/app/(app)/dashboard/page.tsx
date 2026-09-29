import { ArrowRightIcon, ArrowUpRightIcon, BanknoteIcon, PackageIcon, ReceiptIcon, ShoppingBagIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { BalanceHero } from "@/components/shared/balance-hero";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDate } from "@/lib/ui/format";
import { timezoneForCountry, todayAgainstYesterday } from "@/lib/time/day-window";
import { buildDailySeries } from "@/lib/ui/series";
import { requireOrganization } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { ORDER_STATUS_BADGE } from "../sales/order-status";

export const metadata = { title: "Dashboard" };

const WINDOW_DAYS = 30;

export default async function DashboardPage() {
  const { organization } = await requireOrganization();
  const services = getServices();
  const currency = organization.defaultCurrency;

  // "Hoje" segue o fuso do produtor, não o do servidor.
  const day = todayAgainstYesterday(timezoneForCountry(organization.country));

  const [summary, orders, products, nextAvailable, paid, daily, verification, today, yesterday] = await Promise.all([
    services.finance.summary(organization.id, currency),
    services.uow.repos.orders.list(organization.id, { limit: 6 }),
    services.products.list(organization.id),
    services.finance.nextAvailableDate(organization.id, currency),
    services.uow.repos.orders.paidSummary(organization.id, WINDOW_DAYS),
    services.uow.repos.orders.dailyPaidTotals(organization.id, WINDOW_DAYS),
    services.verification.overview(organization.id),
    services.uow.repos.orders.paidBetween(organization.id, day.todayStart, day.now),
    services.uow.repos.orders.paidBetween(organization.id, day.yesterdayStart, day.yesterdayEnd),
  ]);

  const todaySales = today.find((row) => row.currency === currency);
  const todayTotal = todaySales?.total ?? 0n;
  const todayCount = todaySales?.count ?? 0;
  const yesterdayTotal = yesterday.find((row) => row.currency === currency)?.total ?? 0n;
  // Compared against the same stretch of yesterday, so a morning meets a morning.
  // With nothing to compare against, a percentage would be invented.
  const dayOverDay = yesterdayTotal > 0n ? Number(((todayTotal - yesterdayTotal) * 100n) / yesterdayTotal) : null;
  const todayHint =
    todayCount === 0
      ? "Nenhuma venda confirmada ainda hoje"
      : `${todayCount} ${todayCount === 1 ? "pedido pago" : "pedidos pagos"} · ${
          dayOverDay === null ? "ontem não houve vendas até agora" : `${dayOverDay >= 0 ? "+" : ""}${dayOverDay}% vs. ontem até agora`
        }`;

  const sales = paid.find((row) => row.currency === currency);
  const salesTotal = sales?.total ?? 0n;
  const salesCount = sales?.count ?? 0;
  const averageTicket = salesCount > 0 ? salesTotal / BigInt(salesCount) : 0n;
  const series = buildDailySeries(
    daily.filter((row) => row.currency === currency),
    WINDOW_DAYS,
  );

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title={`Olá, ${organization.name}`}
        description="Acompanhe suas vendas, seu saldo e o que precisa da sua atenção."
        actions={
          <>
            <Button variant="outline" render={<Link href="/checkouts" />}>
              Ver checkouts
            </Button>
            <Button render={<Link href="/products/new" />}>
              <PackageIcon />
              Novo produto
            </Button>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <BalanceHero
          className="lg:col-span-2"
          currency={currency}
          available={formatAmount(summary.available, currency)}
          pending={formatAmount(summary.pending, currency)}
          reserved={summary.reserved > 0n ? formatAmount(summary.reserved, currency) : undefined}
          footnote={
            nextAvailable
              ? `Próxima liberação em ${formatDate(nextAvailable)}, conforme a política de settlement.`
              : "Assim que uma venda for confirmada, o valor entra como saldo a liberar."
          }
          actions={
            <>
              <Button className="bg-gold-gradient border-0 text-gold-foreground shadow-gold hover:opacity-90" render={<Link href="/payouts" />}>
                <BanknoteIcon />
                Solicitar saque
              </Button>
              <Button variant="ghost" className="text-white hover:bg-white/12 hover:text-white" render={<Link href="/finance" />}>
                Ver financeiro
                <ArrowUpRightIcon />
              </Button>
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label="Vendas hoje"
            value={formatAmount(todayTotal, currency)}
            icon={ShoppingBagIcon}
            tone={todayCount > 0 ? "positive" : "muted"}
            hint={todayHint}
          />
          <StatCard
            label={`Vendas (${WINDOW_DAYS} dias)`}
            value={formatAmount(salesTotal, currency)}
            icon={ShoppingBagIcon}
            hint={`${salesCount} ${salesCount === 1 ? "pedido pago" : "pedidos pagos"}`}
          />
          <StatCard
            label="Ticket médio"
            value={formatAmount(averageTicket, currency)}
            icon={ReceiptIcon}
            tone="muted"
            hint="No mesmo período"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b pb-4">
            <CardTitle>Vendas confirmadas</CardTitle>
            <CardDescription>Volume pago por dia nos últimos {WINDOW_DAYS} dias.</CardDescription>
          </CardHeader>
          <CardContent>
            {salesCount === 0 ? (
              <div className="flex h-[260px] flex-col items-center justify-center gap-1 text-center">
                <p className="text-sm font-medium">Ainda sem vendas no período</p>
                <p className="text-sm text-muted-foreground">O gráfico aparece assim que o primeiro pagamento for confirmado.</p>
              </div>
            ) : (
              <RevenueChart data={series} currency={currency} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle>Próximos passos</CardTitle>
            <CardDescription>Deixe sua operação pronta para vender.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Step done={products.length > 0} href="/products/new" label="Criar seu primeiro produto" />
            <Step done={products.some((p) => p._count.offers > 0)} href="/offers/new" label="Definir uma oferta e preço" />
            <Step done={orders.length > 0} href="/checkouts/new" label="Publicar um checkout" />
            <Step done={verification.canWithdraw} href="/verification" label="Concluir verificação para receber" />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle>Vendas recentes</CardTitle>
            <CardDescription>Os últimos pedidos criados no seu checkout.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" render={<Link href="/sales" />}>
            Ver todas
            <ArrowRightIcon />
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {orders.length === 0 ? (
            <div className="px-5 pb-2">
              <EmptyState
                icon={ShoppingBagIcon}
                title="Nenhuma venda ainda"
                description="Crie um produto, publique um checkout e compartilhe o link para começar a vender."
                action={
                  <Button variant="outline" render={<Link href="/checkouts/new" />}>
                    Criar checkout
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="pl-5">
                      <span className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-accent font-heading text-xs font-semibold text-accent-foreground">
                          {order.customer.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span>
                          <span className="block font-medium">{order.customer.name}</span>
                          <span className="block text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{order.items[0]?.productName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={ORDER_STATUS_BADGE[order.status].variant}>{ORDER_STATUS_BADGE[order.status].label}</Badge>
                    </TableCell>
                    <TableCell className="tabular pr-5 text-right font-medium">{formatAmount(order.totalAmount, order.currency)}</TableCell>
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

function Step({ done, href, label }: { done: boolean; href: Route; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors hover:border-primary/30 hover:bg-accent/50"
    >
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={`flex size-5 items-center justify-center rounded-full text-[0.6rem] font-bold ${
            done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {done ? "✓" : ""}
        </span>
        <span className={done ? "text-muted-foreground line-through" : "font-medium"}>{label}</span>
      </span>
      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
