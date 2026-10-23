import { AlertTriangleIcon, RotateCcwIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { DISPUTE_STATUS_LABELS, REFUND_STATUS_LABELS } from "@/modules/refunds/refund.schemas";
import { getServices } from "@/server/container";

export const metadata = { title: "Reembolsos e contestações" };

const OPEN_DISPUTE = new Set(["OPEN", "UNDER_REVIEW"]);

export default async function RefundsPage() {
  const { organization } = await requirePagePermission("sales:read");
  const { repos } = getServices().uow;
  const [refunds, disputes] = await Promise.all([
    repos.refunds.listForOrganization(organization.id, 100),
    repos.disputes.listForOrganization(organization.id, 100),
  ]);

  const currency = organization.defaultCurrency;
  const openDisputes = disputes.filter((dispute) => OPEN_DISPUTE.has(dispute.status));
  const heldAmount = openDisputes.reduce((total, dispute) => total + dispute.heldAmount, 0n);
  const refundedAmount = refunds.filter((refund) => refund.status === "PAID").reduce((total, refund) => total + refund.amount, 0n);

  return (
    <>
      <PageHeader
        title="Reembolsos e contestações"
        description="Devoluções que você fez e cobranças que o cliente contestou no banco ou no cartão."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Reembolsado" value={formatAmount(refundedAmount, currency)} hint={`${refunds.length} solicitação(ões)`} />
        <StatCard
          label="Contestações abertas"
          value={String(openDisputes.length)}
          tone={openDisputes.length > 0 ? "warning" : "muted"}
        />
        <StatCard label="Valor retido" value={formatAmount(heldAmount, currency)} hint="Fica bloqueado até a disputa ser resolvida" />
      </section>

      <Card className="py-0">
        <CardHeader className="border-b p-5 pb-4">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-4 text-warning" aria-hidden />
            Contestações
          </CardTitle>
          <CardDescription>
            Abertas pelo cliente junto ao banco. A Kabrun retém o valor até a resolução — reunir provas de entrega ajuda a reverter.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {disputes.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={ShieldCheckIcon} title="Nenhuma contestação" description="Nada foi contestado nas suas vendas até agora." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell">Produto</TableHead>
                  <TableHead className="hidden lg:table-cell">Prazo para provas</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                      {formatDateTime(dispute.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-[52vw] sm:max-w-none">
                      <Link href={`/sales/${dispute.payment.orderId}`} className="block truncate font-medium hover:underline">
                        {dispute.payment.customer.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">{dispute.payment.customer.email}</span>
                      <span className="block truncate text-xs text-muted-foreground lg:hidden">
                        {dispute.payment.order.items[0]?.productName ?? "—"}
                      </span>
                      <span className="block text-xs text-muted-foreground md:hidden">{formatDateTime(dispute.createdAt)}</span>
                      <Badge
                        className="mt-1 sm:hidden"
                        variant={
                          dispute.status === "WON" ? "success" : dispute.status === "LOST" ? "destructive" : OPEN_DISPUTE.has(dispute.status) ? "warning" : "outline"
                        }
                      >
                        {DISPUTE_STATUS_LABELS[dispute.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{dispute.payment.order.items[0]?.productName ?? "—"}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                      {dispute.evidenceDueAt ? formatDateTime(dispute.evidenceDueAt) : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant={
                          dispute.status === "WON" ? "success" : dispute.status === "LOST" ? "destructive" : OPEN_DISPUTE.has(dispute.status) ? "warning" : "outline"
                        }
                      >
                        {DISPUTE_STATUS_LABELS[dispute.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">{formatAmount(dispute.amount, dispute.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="border-b p-5 pb-4">
          <CardTitle className="flex items-center gap-2">
            <RotateCcwIcon className="size-4 text-muted-foreground" aria-hidden />
            Reembolsos
          </CardTitle>
          <CardDescription>Devoluções feitas por você. Para reembolsar, abra a venda e use o botão Reembolsar.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {refunds.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={RotateCcwIcon}
                title="Nenhum reembolso"
                description="Quando você devolver o valor de uma venda, ela aparece aqui."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell">Produto</TableHead>
                  <TableHead className="hidden lg:table-cell">Motivo</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refunds.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                      {formatDateTime(refund.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-[52vw] sm:max-w-none">
                      <Link href={`/sales/${refund.payment.orderId}`} className="block truncate font-medium hover:underline">
                        {refund.payment.customer.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">{refund.payment.customer.email}</span>
                      <span className="block truncate text-xs text-muted-foreground lg:hidden">
                        {refund.payment.order.items[0]?.productName ?? "—"}
                      </span>
                      <span className="block text-xs text-muted-foreground md:hidden">{formatDateTime(refund.createdAt)}</span>
                      <Badge
                        className="mt-1 sm:hidden"
                        variant={refund.status === "PAID" ? "success" : refund.status === "FAILED" ? "destructive" : "outline"}
                      >
                        {REFUND_STATUS_LABELS[refund.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{refund.payment.order.items[0]?.productName ?? "—"}</TableCell>
                    <TableCell className="hidden max-w-48 truncate text-muted-foreground lg:table-cell">{refund.reason ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={refund.status === "PAID" ? "success" : refund.status === "FAILED" ? "destructive" : "outline"}>
                        {REFUND_STATUS_LABELS[refund.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">{formatAmount(refund.amount, refund.currency)}</TableCell>
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
