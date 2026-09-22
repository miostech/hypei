import { ArrowRightIcon, BanknoteIcon, ClockIcon, PackageIcon, ShoppingBagIcon, WalletIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDate } from "@/lib/ui/format";
import { requireOrganization } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { ORDER_STATUS_BADGE } from "../sales/order-status";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { organization } = await requireOrganization();
  const services = getServices();
  const currency = organization.defaultCurrency;

  const [summary, orders, products, nextAvailable] = await Promise.all([
    services.finance.summary(organization.id, currency),
    services.uow.repos.orders.list(organization.id, { limit: 5 }),
    services.products.list(organization.id),
    services.finance.nextAvailableDate(organization.id, currency),
  ]);
  const paid = await services.uow.repos.orders.paidSummary(organization.id, 30);
  const sales30d = paid.find((p) => p.currency === currency);

  return (
    <>
      <PageHeader
        title={`Olá, ${organization.name}`}
        description="Acompanhe suas vendas, seu saldo e o que precisa da sua atenção."
        actions={
          <Button render={<Link href="/products/new" />}>
            <PackageIcon />
            Novo produto
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Saldo disponível" value={formatAmount(summary.available, currency)} icon={WalletIcon} tone="positive" hint="Pronto para saque" />
        <StatCard
          label="Saldo pendente"
          value={formatAmount(summary.pending, currency)}
          icon={ClockIcon}
          hint={nextAvailable ? `Próxima liberação em ${formatDate(nextAvailable)}` : "Sem liberações agendadas"}
        />
        <StatCard label="Vendas (30 dias)" value={formatAmount(sales30d?.total ?? 0n, currency)} icon={ShoppingBagIcon} hint={`${sales30d?.count ?? 0} pedidos pagos`} />
        <StatCard label="Receita bruta" value={formatAmount(summary.grossRevenue, currency)} icon={BanknoteIcon} hint="Desde o início" tone="muted" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Vendas recentes</CardTitle>
            <CardDescription>Os últimos pedidos criados no seu checkout.</CardDescription>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
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
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <span className="font-medium">{order.customer.name}</span>
                        <span className="block text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{order.items[0]?.productName ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={ORDER_STATUS_BADGE[order.status].variant}>{ORDER_STATUS_BADGE[order.status].label}</Badge>
                      </TableCell>
                      <TableCell className="tabular text-right">{formatAmount(order.totalAmount, order.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos passos</CardTitle>
            <CardDescription>Deixe sua operação pronta para vender.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Step done={products.length > 0} href="/products/new" label="Criar seu primeiro produto" />
            <Step done={products.some((p) => p._count.offers > 0)} href="/offers/new" label="Definir uma oferta e preço" />
            <Step done={orders.length > 0} href="/checkouts/new" label="Publicar um checkout" />
            <Step done={summary.available > 0n} href="/integrations" label="Concluir verificação para receber" />
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function Step({ done, href, label }: { done: boolean; href: Route; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-accent/50"
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={`size-2 rounded-full ${done ? "bg-success" : "bg-muted-foreground/40"}`}
        />
        <span className={done ? "text-muted-foreground line-through" : ""}>{label}</span>
      </span>
      <ArrowRightIcon className="size-4 text-muted-foreground" />
    </Link>
  );
}
