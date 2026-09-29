import { RepeatIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SubscriptionStatus } from "@/generated/prisma/enums";
import { formatAmount, formatDate } from "@/lib/ui/format";
import { BILLING_INTERVAL_LABELS } from "@/modules/offers/offer.schemas";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { CancelSubscriptionDialog } from "./cancel-dialog";

export const metadata = { title: "Assinaturas" };

const STATUS_BADGE: Record<SubscriptionStatus, { label: string; variant: "success" | "warning" | "destructive" | "outline" }> = {
  ACTIVE: { label: "Ativa", variant: "success" },
  TRIALING: { label: "Em teste", variant: "outline" },
  PAST_DUE: { label: "Pagamento atrasado", variant: "warning" },
  PAUSED: { label: "Pausada", variant: "outline" },
  UNPAID: { label: "Inadimplente", variant: "destructive" },
  CANCELED: { label: "Cancelada", variant: "outline" },
};

const LIVE: SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

export default async function SubscriptionsPage() {
  const { organization } = await requirePagePermission("sales:read");
  const subscriptions = await getServices().subscriptions.list(organization.id);

  const live = subscriptions.filter((subscription) => LIVE.includes(subscription.status));
  const monthlyRevenue = live.reduce((total, subscription) => {
    // Everything is normalized to a monthly figure so the number means something.
    const perMonth =
      subscription.billingInterval === "YEAR"
        ? subscription.amount / 12n
        : subscription.billingInterval === "WEEK"
          ? subscription.amount * 4n
          : subscription.billingInterval === "DAY"
            ? subscription.amount * 30n
            : subscription.amount;
    return total + perMonth;
  }, 0n);
  const atRisk = subscriptions.filter((subscription) => subscription.status === "PAST_DUE" || subscription.status === "UNPAID");

  return (
    <>
      <PageHeader
        title="Assinaturas"
        description="O status vem sempre dos eventos do provedor de pagamento, nunca de um retorno do navegador."
      />

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={RepeatIcon}
          title="Nenhuma assinatura ativa"
          description="Crie uma oferta recorrente e publique um checkout: cada assinante aparece aqui, com as renovações lançadas como venda."
          action={
            <Button variant="outline" render={<Link href="/offers" />}>
              Criar oferta recorrente
            </Button>
          }
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Assinaturas ativas" value={String(live.length)} hint={`${subscriptions.length} no total`} />
            <StatCard label="Receita recorrente" value={formatAmount(monthlyRevenue, organization.defaultCurrency)} hint="Equivalente por mês" />
            <StatCard label="Em atraso" value={String(atRisk.length)} tone={atRisk.length > 0 ? "warning" : "muted"} />
          </section>

          <Card className="py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Recorrência</TableHead>
                    <TableHead className="text-right">Ciclos</TableHead>
                    <TableHead>Próxima cobrança</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-px" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((subscription) => {
                    const badge = STATUS_BADGE[subscription.status];
                    const canCancel = subscription.status !== "CANCELED";
                    return (
                      <TableRow key={subscription.id}>
                        <TableCell>
                          <span className="font-medium">{subscription.customer.name}</span>
                          <span className="block text-xs text-muted-foreground">{subscription.customer.email}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{subscription.offer.product.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {subscription.offer.billingInterval ? BILLING_INTERVAL_LABELS[subscription.offer.billingInterval] : "—"}
                        </TableCell>
                        <TableCell className="tabular text-right text-muted-foreground">{subscription._count.payments}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {subscription.cancelAtPeriodEnd ? (
                            <span className="text-warning">encerra em {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "—"}</span>
                          ) : subscription.currentPeriodEnd ? (
                            formatDate(subscription.currentPeriodEnd)
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="tabular text-right font-medium">
                          {formatAmount(subscription.amount, subscription.currency)}
                        </TableCell>
                        <TableCell>
                          {canCancel && (
                            <CancelSubscriptionDialog
                              subscriptionId={subscription.id}
                              customerName={subscription.customer.name}
                              periodEndLabel={subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : null}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
