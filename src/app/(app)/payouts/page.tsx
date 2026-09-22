import { AlertCircleIcon, BanknoteIcon, ClockIcon, WalletIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
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

  return (
    <>
      <PageHeader
        title="Saques"
        description="Transferências do seu saldo disponível para a sua conta bancária."
        actions={
          canRequest && (
            <RequestPayoutDialog
              currency={currency}
              availableAmount={summary.available.toString()}
              availableLabel={formatAmount(summary.available, currency)}
              disabled={!ready || summary.available <= 0n}
            />
          )
        }
      />

      {!ready && (
        <Alert>
          <AlertCircleIcon />
          <AlertTitle>Verificação pendente</AlertTitle>
          <AlertDescription>
            {merchant
              ? "Sua conta de recebimento ainda não está habilitada para saques. Conclua a verificação em Integrações."
              : "Nenhuma conta de recebimento configurada. Configure-a em Integrações para poder sacar."}
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Saldo disponível" value={formatAmount(summary.available, currency)} icon={WalletIcon} tone="positive" />
        <StatCard label="Saldo pendente" value={formatAmount(summary.pending, currency)} icon={ClockIcon} />
        <StatCard
          label="Próxima liberação"
          value={nextAvailable ? formatDateTime(nextAvailable) : "—"}
          icon={ClockIcon}
          tone="muted"
          hint="Conforme a política de settlement"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de saques</CardTitle>
          <CardDescription>Um saque só é marcado como pago quando o provedor confirma.</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <EmptyState icon={BanknoteIcon} title="Nenhum saque solicitado" description="Quando houver saldo disponível, solicite um saque e acompanhe o status aqui." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(payout.requestedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={PAYOUT_STATUS_BADGE[payout.status].variant}>{PAYOUT_STATUS_BADGE[payout.status].label}</Badge>
                      {payout.failureReason && <span className="block text-xs text-destructive">{payout.failureReason}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{payout.paidAt ? formatDateTime(payout.paidAt) : "—"}</TableCell>
                    <TableCell className="tabular text-right">{formatAmount(payout.amount, payout.currency)}</TableCell>
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
