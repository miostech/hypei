import { ShoppingBagIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_METHOD_LABELS } from "@/modules/payments/payment-method-resolver";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { ORDER_STATUS_BADGE, PAYMENT_STATUS_BADGE } from "./order-status";

export const metadata = { title: "Vendas" };

export default async function SalesPage() {
  const { organization } = await requirePagePermission("sales:read");
  const orders = await getServices().uow.repos.orders.list(organization.id, { limit: 100 });

  return (
    <>
      <PageHeader title="Vendas" description="Pedidos criados no checkout e o status do pagamento de cada um." />

      {orders.length === 0 ? (
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
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const payment = order.payments.at(-1);
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(order.createdAt)}</TableCell>
                      <TableCell>
                        <Link href={`/sales/${order.id}`} className="font-medium hover:underline">
                          {order.customer.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{order.customer.email}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{order.items[0]?.productName ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={ORDER_STATUS_BADGE[order.status].variant}>{ORDER_STATUS_BADGE[order.status].label}</Badge>
                      </TableCell>
                      <TableCell>
                        {payment ? (
                          <>
                            <Badge variant={PAYMENT_STATUS_BADGE[payment.status].variant}>{PAYMENT_STATUS_BADGE[payment.status].label}</Badge>
                            {payment.paymentMethod && (
                              <span className="block text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[payment.paymentMethod]}</span>
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
