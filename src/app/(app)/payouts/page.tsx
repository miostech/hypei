import { AlertCircleIcon, BanknoteIcon, ClockIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { BalanceHero } from "@/components/shared/balance-hero";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount, formatDate, formatDateTime } from "@/lib/ui/format";
import { isMerchantAccountReadyForPayouts } from "@/lib/providers/payment/merchant-status";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { RequestPayoutDialog } from "./request-payout-dialog";
import { PAYOUT_STATUS_BADGE } from "./payout-status";

export const metadata = { title: "Saques" };

export default async function PayoutsPage() {
  const { organization, membership } = await requirePagePermission("finance:read");
  const services = getServices();
  const currency = organization.defaultCurrency;

  const [summary, payouts, merchant, nextAvailable] = await Promise.all([
    services.finance.summary(organization.id, currency),
    services.payouts.list(organization.id),
    services.merchantAccounts.getForOrganization(organization.id),
    services.finance.nextAvailableDate(organization.id, currency),
  ]);

  const canRequest = hasPermission(membership.role, "payouts:request");
  const ready = merchant ? isMerchantAccountReadyForPayouts(merchant) : false;
  const totalPaid = payouts.filter((p) => p.status === "PAID").reduce((acc, p) => acc + p.amount, 0n);

  return (
    <>
      <PageHeader
        eyebrow="Saques"
        title="Transferências para sua conta"
        description="O valor sai do saldo disponível quando você solicita e só é marcado como pago quando o provedor confirma."
      />

      {!ready && (
        <Alert>
          <AlertCircleIcon />
          <AlertTitle>Verificação pendente</AlertTitle>
          <AlertDescription>
            {merchant
              ? "Sua conta de recebimento ainda não está habilitada para saques. Conclua a verificação em Integrações."
              : "Nenhuma conta de recebimento configurada. Configure-a em Integrações para poder sacar."}
            <Button variant="link" className="h-auto p-0" render={<Link href="/integrations" />}>
              Ir para Integrações
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <BalanceHero
          className="lg:col-span-2"
          currency={currency}
          available={formatAmount(summary.available, currency)}
          pending={formatAmount(summary.pending, currency)}
          footnote={
            nextAvailable
              ? `Mais valores entram no saldo disponível em ${formatDateTime(nextAvailable)}.`
              : "Sem liberações agendadas no momento."
          }
          actions={
            canRequest ? (
              <RequestPayoutDialog
                currency={currency}
                availableAmount={summary.available.toString()}
                availableLabel={formatAmount(summary.available, currency)}
                disabled={!ready || summary.available <= 0n}
              />
            ) : undefined
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard label="Total já sacado" value={formatAmount(totalPaid, currency)} icon={BanknoteIcon} tone="positive" hint={`${payouts.length} solicitação(ões)`} />
          <StatCard
            label="Próxima liberação"
            value={nextAvailable ? formatDate(nextAvailable) : "—"}
            icon={ClockIcon}
            tone="muted"
            hint="Conforme a política de settlement"
          />
        </div>
      </section>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Histórico de saques</CardTitle>
          <CardDescription>Cada solicitação e seu status até chegar na conta.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {payouts.length === 0 ? (
            <div className="px-5 pb-2">
              <EmptyState
                icon={BanknoteIcon}
                title="Nenhum saque solicitado"
                description="Quando houver saldo disponível, solicite um saque e acompanhe o status aqui."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {payouts.map((payout) => {
                const badge = PAYOUT_STATUS_BADGE[payout.status];
                return (
                  <li key={payout.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-warning">
                      <BanknoteIcon className="size-4.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Saque solicitado</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(payout.requestedAt)}
                        {payout.paidAt ? ` · pago em ${formatDateTime(payout.paidAt)}` : ""}
                      </p>
                      {payout.failureReason && <p className="text-xs text-destructive">{payout.failureReason}</p>}
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <p className="tabular w-32 text-right text-sm font-semibold">{formatAmount(payout.amount, payout.currency)}</p>
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
