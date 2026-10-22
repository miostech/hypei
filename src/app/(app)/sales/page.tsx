import { SearchIcon, ShoppingBagIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_METHOD_LABELS } from "@/modules/payments/payment-method-resolver";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { ORDER_STATUS_BADGE, PAYMENT_STATUS_BADGE } from "./order-status";

export const metadata = { title: "Vendas" };

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const { organization } = await requirePagePermission("sales:read");
  const { repos } = getServices().uow;
  const orders = query ? await repos.orders.search(organization.id, query, 100) : await repos.orders.list(organization.id, { limit: 100 });

  return (
    <>
      <PageHeader title="Vendas" description="Pedidos criados no checkout e o status do pagamento de cada um." />

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Buscar por cliente, e-mail, produto ou referência…"
          aria-label="Buscar vendas"
          className="min-w-0 flex-1 basis-full sm:basis-auto"
        />
        <Button type="submit" variant="outline">
          <SearchIcon />
          Buscar
        </Button>
        {query && (
          <Button variant="ghost" render={<Link href="/sales" />}>
            Limpar
          </Button>
        )}
      </form>

      {orders.length === 0 ? (
        query ? (
          <EmptyState
            icon={SearchIcon}
            title="Nenhuma venda encontrada"
            description={`Nada corresponde a "${query}". Tente o e-mail do cliente, o nome do produto ou a referência do pedido.`}
            action={
              <Button variant="outline" render={<Link href="/sales" />}>
                Ver todas as vendas
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ShoppingBagIcon}
            title="Nenhuma venda registrada"
            description="Assim que alguém iniciar uma compra no seu checkout, o pedido aparece aqui."
            action={
              <Button variant="outline" render={<Link href="/checkouts" />}>
                Ver checkouts
              </Button>
            }
          />
        )
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell">Produto</TableHead>
                  <TableHead className="hidden lg:table-cell">Pedido</TableHead>
                  <TableHead className="hidden sm:table-cell">Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const payment = order.payments.at(-1);
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                        {formatDateTime(order.createdAt)}
                      </TableCell>
                      {/* Capped so the long e-mail truncates instead of pushing the amount off-screen. */}
                      <TableCell className="max-w-[52vw] sm:max-w-none">
                        <Link href={`/sales/${order.id}`} className="block truncate font-medium hover:underline">
                          {order.customer.name}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">{order.customer.email}</span>
                        {/* The columns hidden on small screens come back as context here. */}
                        <span className="block truncate text-xs text-muted-foreground lg:hidden">
                          {order.items[0]?.productName ?? "—"}
                        </span>
                        <span className="block text-xs text-muted-foreground md:hidden">{formatDateTime(order.createdAt)}</span>
                        {payment && (
                          <Badge className="mt-1 sm:hidden" variant={PAYMENT_STATUS_BADGE[payment.status].variant}>
                            {PAYMENT_STATUS_BADGE[payment.status].label}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{order.items[0]?.productName ?? "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={ORDER_STATUS_BADGE[order.status].variant}>{ORDER_STATUS_BADGE[order.status].label}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {payment ? (
                          <>
                            <Badge variant={PAYMENT_STATUS_BADGE[payment.status].variant}>{PAYMENT_STATUS_BADGE[payment.status].label}</Badge>
                            {payment.paymentMethod && (
                              <span className="hidden text-xs text-muted-foreground sm:block">
                                {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">{formatAmount(order.totalAmount, order.currency)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
