import { AlertTriangleIcon, ArrowLeftIcon, MailIcon, ReceiptTextIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { ORDER_STATUS_VARIANT, PAYMENT_STATUS_VARIANT, REFUND_STATUS_VARIANT } from "../order-status";
import { RefundDialog } from "../refund-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.sale.title };
}

export default async function SaleDetailPage({ params }: PageProps<"/sales/[orderId]">) {
  const { orderId } = await params;
  const { organization, membership } = await requirePagePermission("sales:read");
  const order = await getServices().uow.repos.orders.findDetail(organization.id, orderId);
  if (!order) notFound();

  const dict = await getAppDictionary(await appLocale());
  const t = dict.sale;

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
        eyebrow={t.title}
        title={order.items[0]?.productName ?? t.fallbackProduct}
        description={`${order.customer.name} · ${formatDateTime(order.createdAt, dict.localeTag)}`}
        actions={
          <>
            <Button variant="outline" render={<Link href="/sales" />}>
              <ArrowLeftIcon />
              {t.allSales}
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
              <p className="text-sm font-medium">{t.disputeOpen[openDispute.status === "UNDER_REVIEW" ? "UNDER_REVIEW" : "OPEN"]}</p>
              <p className="text-xs text-muted-foreground">
                {fill(t.disputeHeld, { amount: formatAmount(openDispute.heldAmount, openDispute.currency) })}
                {openDispute.evidenceDueAt
                  ? ` · ${fill(t.disputeDeadline, { date: formatDateTime(openDispute.evidenceDueAt, dict.localeTag) })}`
                  : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" render={<Link href="/refunds" />}>
              {t.viewDisputes}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>{t.payment.title}</CardTitle>
              <CardDescription>{t.payment.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {payment ? (
                <>
                  <Row label={dict.common.status}>
                    <Badge variant={PAYMENT_STATUS_VARIANT[payment.status]}>{dict.status.payment[payment.status]}</Badge>
                  </Row>
                  <Row label={t.payment.charged}>{formatAmount(payment.amount, payment.currency)}</Row>
                  {payment.processorFeeAmount !== null && (
                    <Row label={t.payment.processorFee}>− {formatAmount(payment.processorFeeAmount, payment.currency)}</Row>
                  )}
                  {payment.platformFeeAmount !== null && (
                    <Row label={t.payment.platformFee}>− {formatAmount(payment.platformFeeAmount, payment.currency)}</Row>
                  )}
                  {payment.producerNetAmount !== null && (
                    <Row label={t.payment.net} strong>
                      {formatAmount(payment.producerNetAmount, payment.currency)}
                    </Row>
                  )}
                  {payment.refundedAmount > 0n && (
                    <Row label={t.payment.refunded}>− {formatAmount(payment.refundedAmount, payment.currency)}</Row>
                  )}
                  {order.taxAmount > 0n && (
                    <Row label={fill(t.payment.taxIncluded, { regime: dict.settings.taxRegimes[order.taxRegime].label })}>
                      {formatAmount(order.taxAmount, order.currency)}
                    </Row>
                  )}
                  <Row label={t.payment.method}>
                    {payment.paymentMethod ? dict.status.paymentMethod[payment.paymentMethod] : "—"}
                  </Row>
                  {payment.paidAt && <Row label={t.payment.paidAt}>{formatDateTime(payment.paidAt, dict.localeTag)}</Row>}
                  {payment.settleAt && (
                    <Row label={payment.settledAt ? t.payment.settledAt : t.payment.settlesAt}>
                      {formatDateTime(payment.settledAt ?? payment.settleAt, dict.localeTag)}
                    </Row>
                  )}
                  {order.taxAmount > 0n && <p className="border-t pt-3 text-xs text-muted-foreground">{t.payment.taxNote}</p>}
                </>
              ) : (
                <p className="text-muted-foreground">{t.payment.none}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>{t.refunds.title}</CardTitle>
              <CardDescription>{t.refunds.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {refunds.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RotateCcwIcon className="size-4" aria-hidden />
                  {t.refunds.empty}
                </p>
              ) : (
                <ul className="divide-y">
                  {refunds.map((refund) => (
                    <li key={refund.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{formatAmount(refund.amount, refund.currency)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(refund.createdAt, dict.localeTag)}
                          {refund.reason ? ` · ${refund.reason}` : ""}
                        </p>
                      </div>
                      <Badge variant={REFUND_STATUS_VARIANT[refund.status]}>{dict.status.refund[refund.status]}</Badge>
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
              <CardTitle>{t.customer.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-medium">{order.customer.name}</p>
              <a href={`mailto:${order.customer.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <MailIcon className="size-4" aria-hidden />
                {order.customer.email}
              </a>
              {order.customer.phone && <p className="text-muted-foreground">{order.customer.phone}</p>}
              <Button variant="outline" size="sm" className="w-full" render={<Link href={`/customers?q=${encodeURIComponent(order.customer.email)}`} />}>
                {t.customer.view}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>{t.order.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label={dict.common.status}>
                <Badge variant={ORDER_STATUS_VARIANT[order.status]}>{dict.status.order[order.status]}</Badge>
              </Row>
              <Row label={t.order.reference}>
                <span className="font-mono text-xs">{order.id.slice(-8).toUpperCase()}</span>
              </Row>
              {/*
                O valor BRUTO de cada linha, não o `totalAmount`: naquele campo o desconto já
                está abatido da oferta principal, e mostrá-lo ao lado de uma linha de desconto
                contava o mesmo abatimento duas vezes — as linhas não fechavam com o total. Com
                order bump um pedido passa a ter várias linhas, e um painel que não soma vira
                pergunta no suporte.
              */}
              {order.items.map((item) => (
                <Row key={item.id} label={item.productName}>
                  {formatAmount(item.unitAmount * BigInt(item.quantity), order.currency)}
                </Row>
              ))}
              {order.discountAmount > 0n && (
                <>
                  <Row label={dict.common.subtotal}>{formatAmount(order.subtotalAmount, order.currency)}</Row>
                  <Row label={dict.common.discount}>− {formatAmount(order.discountAmount, order.currency)}</Row>
                </>
              )}
              <Row label={dict.common.total} strong>
                {formatAmount(order.totalAmount, order.currency)}
              </Row>
              <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <ReceiptTextIcon className="size-3.5" aria-hidden />
                {fill(t.order.createdAt, { date: formatDateTime(order.createdAt, dict.localeTag) })}
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
