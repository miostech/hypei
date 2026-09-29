import { AlertTriangleIcon, ArrowLeftIcon, MailIcon, ReceiptTextIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { PAYMENT_METHOD_LABELS } from "@/modules/payments/payment-method-resolver";
import { DISPUTE_STATUS_LABELS, REFUND_STATUS_LABELS } from "@/modules/refunds/refund.schemas";
import { getServices } from "@/server/container";
import { ORDER_STATUS_BADGE, PAYMENT_STATUS_BADGE } from "../order-status";
import { RefundDialog } from "../refund-dialog";

export const metadata = { title: "Venda" };

export default async function SaleDetailPage({ params }: PageProps<"/sales/[orderId]">) {
  const { orderId } = await params;
  const { organization, membership } = await requirePagePermission("sales:read");
  const order = await getServices().uow.repos.orders.findDetail(organization.id, orderId);
  if (!order) notFound();

  const payment = order.payments.at(-1);
  const refunds = order.payments.flatMap((item) => item.refunds);
  const disputes = order.payments.flatMap((item) => item.disputes);
  const openDispute = disputes.find((dispute) => dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW");

  const refundable = payment ? payment.amount - payment.refundedAmount : 0n;
  const canRefund =
    hasPermission(membership.role, "refunds:create") &&
    payment !== undefined &&
    (payment.status === "PAID" || payment.status === "PARTIALLY_REFUNDED") &&
    refundable > 0n;

  return (
    <>
      <PageHeader
        eyebrow="Venda"
        title={order.items[0]?.productName ?? "Pedido"}
        description={`${order.customer.name} · ${formatDateTime(order.createdAt)}`}
        actions={
          <>
            <Button variant="outline" render={<Link href="/sales" />}>
              <ArrowLeftIcon />
              Todas as vendas
            </Button>
            {canRefund && payment && (
              <RefundDialog
                paymentId={payment.id}
                refundableAmount={refundable.toString()}
                currency={payment.currency}
                partiallyRefunded={payment.refundedAmount > 0n}
              />
            )}
          </>
        }
      />

      {openDispute && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <AlertTriangleIcon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Contestação {DISPUTE_STATUS_LABELS[openDispute.status].toLowerCase()}</p>
              <p className="text-xs text-muted-foreground">
                {formatAmount(openDispute.heldAmount, openDispute.currency)} retidos
                {openDispute.evidenceDueAt ? ` · prazo para provas até ${formatDateTime(openDispute.evidenceDueAt)}` : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" render={<Link href="/refunds" />}>
              Ver contestações
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>Pagamento</CardTitle>
              <CardDescription>Valores cobrados do cliente e o que sobra para você.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {payment ? (
                <>
                  <Row label="Status">
                    <Badge variant={PAYMENT_STATUS_BADGE[payment.status].variant}>{PAYMENT_STATUS_BADGE[payment.status].label}</Badge>
                  </Row>
                  <Row label="Valor cobrado">{formatAmount(payment.amount, payment.currency)}</Row>
                  {payment.processorFeeAmount !== null && (
                    <Row label="Taxa do processador">− {formatAmount(payment.processorFeeAmount, payment.currency)}</Row>
                  )}
                  {payment.platformFeeAmount !== null && (
                    <Row label="Taxa Ripay">− {formatAmount(payment.platformFeeAmount, payment.currency)}</Row>
                  )}
                  {payment.producerNetAmount !== null && (
                    <Row label="Você recebe" strong>
                      {formatAmount(payment.producerNetAmount, payment.currency)}
                    </Row>
                  )}
                  {payment.refundedAmount > 0n && (
                    <Row label="Já reembolsado">− {formatAmount(payment.refundedAmount, payment.currency)}</Row>
                  )}
                  <Row label="Forma de pagamento">
                    {payment.paymentMethod ? PAYMENT_METHOD_LABELS[payment.paymentMethod] : "—"}
                  </Row>
                  {payment.paidAt && <Row label="Pago em">{formatDateTime(payment.paidAt)}</Row>}
                  {payment.settleAt && (
                    <Row label={payment.settledAt ? "Liberado em" : "Libera em"}>
                      {formatDateTime(payment.settledAt ?? payment.settleAt)}
                    </Row>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Este pedido ainda não gerou pagamento.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>Reembolsos</CardTitle>
              <CardDescription>Devoluções solicitadas para esta venda.</CardDescription>
            </CardHeader>
            <CardContent>
              {refunds.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RotateCcwIcon className="size-4" aria-hidden />
                  Nenhum reembolso nesta venda.
                </p>
              ) : (
                <ul className="divide-y">
                  {refunds.map((refund) => (
                    <li key={refund.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{formatAmount(refund.amount, refund.currency)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(refund.createdAt)}
                          {refund.reason ? ` · ${refund.reason}` : ""}
                        </p>
                      </div>
                      <Badge variant={refund.status === "PAID" ? "success" : refund.status === "FAILED" ? "destructive" : "outline"}>
                        {REFUND_STATUS_LABELS[refund.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-medium">{order.customer.name}</p>
              <a href={`mailto:${order.customer.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <MailIcon className="size-4" aria-hidden />
                {order.customer.email}
              </a>
              {order.customer.phone && <p className="text-muted-foreground">{order.customer.phone}</p>}
              <Button variant="outline" size="sm" className="w-full" render={<Link href={`/customers?q=${encodeURIComponent(order.customer.email)}`} />}>
                Ver cliente
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Status">
                <Badge variant={ORDER_STATUS_BADGE[order.status].variant}>{ORDER_STATUS_BADGE[order.status].label}</Badge>
              </Row>
              <Row label="Referência">
                <span className="font-mono text-xs">{order.id.slice(-8).toUpperCase()}</span>
              </Row>
              {order.items.map((item) => (
                <Row key={item.id} label={item.productName}>
                  {formatAmount(item.totalAmount, order.currency)}
                </Row>
              ))}
              {order.discountAmount > 0n && <Row label="Desconto">− {formatAmount(order.discountAmount, order.currency)}</Row>}
              <Row label="Total" strong>
                {formatAmount(order.totalAmount, order.currency)}
              </Row>
              <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <ReceiptTextIcon className="size-3.5" aria-hidden />
                Criado em {formatDateTime(order.createdAt)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <p className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{children}</span>
    </p>
  );
}
