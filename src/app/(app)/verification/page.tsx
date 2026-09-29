import { AlertTriangleIcon, BanknoteIcon, CheckCircle2Icon, ClockIcon, ShieldCheckIcon, ShoppingBagIcon, XCircleIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { VerificationStatus } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { VerificationActions } from "./verification-actions";

export const metadata = { title: "Verificação" };

const STATUS: Record<VerificationStatus, { label: string; description: string; variant: "success" | "warning" | "destructive" | "outline" }> = {
  NOT_STARTED: {
    label: "Não iniciada",
    description: "Você ainda não enviou seus dados para verificação.",
    variant: "outline",
  },
  PENDING: {
    label: "Em análise",
    description: "Seus dados foram enviados e o provedor de pagamento está analisando. Costuma levar de minutos a alguns dias.",
    variant: "warning",
  },
  REQUIRES_ACTION: {
    label: "Falta informação",
    description: "O provedor precisa de mais alguma coisa antes de liberar sua conta.",
    variant: "warning",
  },
  VERIFIED: {
    label: "Verificada",
    description: "Tudo certo: você pode vender e sacar normalmente.",
    variant: "success",
  },
  REJECTED: {
    label: "Recusada",
    description: "O provedor não aprovou a verificação. Fale com o suporte para entender o motivo.",
    variant: "destructive",
  },
  SUSPENDED: {
    label: "Suspensa",
    description: "Sua conta foi suspensa pelo provedor. Fale com o suporte.",
    variant: "destructive",
  },
};

export default async function VerificationPage() {
  const { organization, membership } = await requirePagePermission("organization:read");
  const overview = await getServices().verification.overview(organization.id);
  const status = STATUS[overview.status];
  const canEdit = hasPermission(membership.role, "integrations:manage");

  const actionLabel = !overview.hasAccount
    ? "Iniciar verificação"
    : overview.detailsSubmitted
      ? "Revisar meus dados"
      : "Continuar verificação";

  return (
    <>
      <PageHeader
        eyebrow="Conta"
        title="Verificação"
        description="Exigência dos meios de pagamento para que você possa receber. Os documentos vão direto para o provedor — a Ripay não guarda essas informações."
        actions={<VerificationActions label={actionLabel} canStart={canEdit} />}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <span
            className={`flex size-11 items-center justify-center rounded-2xl ${
              overview.status === "VERIFIED"
                ? "bg-success/12 text-success"
                : status.variant === "destructive"
                  ? "bg-destructive/12 text-destructive"
                  : "bg-warning/12 text-warning"
            }`}
          >
            {overview.status === "VERIFIED" ? (
              <ShieldCheckIcon className="size-6" aria-hidden />
            ) : status.variant === "destructive" ? (
              <XCircleIcon className="size-6" aria-hidden />
            ) : (
              <ClockIcon className="size-6" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-heading font-semibold">
              {status.label}
              <Badge variant={status.variant}>{overview.provider}</Badge>
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{status.description}</p>
          </div>
          {overview.verifiedAt && (
            <p className="text-xs text-muted-foreground">Verificada em {formatDateTime(overview.verifiedAt)}</p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3">
            <span className={`flex size-10 items-center justify-center rounded-xl ${overview.canSell ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}>
              <ShoppingBagIcon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-medium">{overview.canSell ? "Vendas liberadas" : "Vendas bloqueadas"}</p>
              <p className="text-sm text-muted-foreground">
                {overview.canSell ? "Seus checkouts podem receber pagamentos." : "Enquanto não verificar, o checkout não cobra."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <span className={`flex size-10 items-center justify-center rounded-xl ${overview.canWithdraw ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}>
              <BanknoteIcon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-medium">{overview.canWithdraw ? "Saques liberados" : "Saques bloqueados"}</p>
              <p className="text-sm text-muted-foreground">
                {overview.canWithdraw ? "Você pode transferir seu saldo disponível." : "O dinheiro continua seu; só não sai até a verificação terminar."}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {overview.requirements.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="size-4 text-warning" aria-hidden />O que ainda falta
            </CardTitle>
            <CardDescription>Pendências que o provedor apontou. Elas são preenchidas no formulário dele.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {overview.requirements.map((requirement) => (
                <li key={requirement.code} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-warning/50 text-warning">
                    <span className="size-1.5 rounded-full bg-warning" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{requirement.label}</p>
                    {requirement.hint && <p className="text-xs text-muted-foreground">{requirement.hint}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Dados já informados</CardTitle>
          <CardDescription>O que a Ripay tem no cadastro desta organização.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Row label="Tipo" value={overview.businessType === "INDIVIDUAL" ? "Pessoa física" : "Empresa"} />
          <Row label="Razão social" value={overview.legalName ?? organization.name} />
          <Row label="País" value={overview.country} />
          {overview.taxIdentities.map((identity) => (
            <Row key={identity.type} label={identity.type} value={identity.maskedValue} />
          ))}
          {overview.submittedAt && <Row label="Enviada em" value={formatDateTime(overview.submittedAt)} />}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
        <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Documentos e dados bancários são enviados e guardados pelo provedor de pagamento. A Ripay recebe apenas o status da análise e o que ainda falta.
      </p>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 sm:border-0 sm:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </p>
  );
}
