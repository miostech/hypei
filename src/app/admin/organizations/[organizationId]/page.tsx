import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NotFoundError } from "@/lib/errors";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { describeRequirements } from "@/modules/compliance/verification.requirements";
import { getServices } from "@/server/container";
import { PAYMENT_BADGE, VERIFICATION_BADGE } from "../../status-badges";

export const metadata = { title: "Organização · Admin" };

export default async function AdminOrganizationPage({ params }: PageProps<"/admin/organizations/[organizationId]">) {
  const { organizationId } = await params;
  const organization = await getServices()
    .platformAdmin.organization(organizationId)
    .catch((error) => {
      if (error instanceof NotFoundError) notFound();
      throw error;
    });

  const badge = VERIFICATION_BADGE[organization.verificationStatus ?? "NOT_STARTED"];
  const requirements = describeRequirements(organization.requirementsDue);

  return (
    <>
      <PageHeader
        eyebrow="Organização"
        title={organization.name}
        description={`/${organization.slug} · ${organization.country} · desde ${formatDateTime(organization.createdAt)}`}
        actions={
          <Button variant="outline" render={<Link href="/admin/organizations" />}>
            <ArrowLeftIcon />
            Todas as organizações
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b pb-4">
            <CardTitle>Saldos</CardTitle>
            <CardDescription>Posição atual por moeda, projetada do ledger.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {organization.balances.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum saldo movimentado ainda.</p>
            ) : (
              organization.balances.map((balance) => (
                <div key={balance.currency} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-3">
                  <Figure label={`Disponível (${balance.currency})`} value={formatAmount(balance.available, balance.currency)} strong />
                  <Figure label="Pendente" value={formatAmount(balance.pending, balance.currency)} />
                  <Figure label="Reservado" value={formatAmount(balance.reserved, balance.currency)} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle>Cadastro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Row label="Status" value={<Badge variant={organization.status === "ACTIVE" ? "success" : "outline"}>{organization.status}</Badge>} />
            <Row label="Verificação" value={<Badge variant={badge.variant}>{badge.label}</Badge>} />
            <Row label="Saques" value={<Badge variant={organization.payoutsEnabled ? "success" : "outline"}>{organization.payoutsEnabled ? "Liberados" : "Bloqueados"}</Badge>} />
            <Row label="Tipo" value={organization.businessType === "INDIVIDUAL" ? "Pessoa física" : "Empresa"} />
            {organization.legalName && <Row label="Razão social" value={organization.legalName} />}
            {organization.taxIdentities.map((identity) => (
              <Row key={identity.type} label={identity.type} value={identity.maskedValue} />
            ))}
            {organization.supportEmail && <Row label="Suporte" value={organization.supportEmail} />}
          </CardContent>
        </Card>
      </div>

      {requirements.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader className="border-b pb-4">
            <CardTitle>Pendências de verificação</CardTitle>
            <CardDescription>O que o provedor está esperando desta organização.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {requirements.map((requirement) => (
                <li key={requirement.code}>{requirement.label}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Equipe</CardTitle>
          <CardDescription>Quem tem acesso a esta organização.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {organization.members.map((member) => (
            <p key={member.email} className="flex items-center justify-between gap-3">
              <span>
                {member.name ?? member.email}
                <span className="block text-xs text-muted-foreground">{member.email}</span>
              </span>
              <Badge variant="outline">{member.role}</Badge>
            </p>
          ))}
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="border-b p-5 pb-4">
          <CardTitle>Últimos pagamentos</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {organization.recentPayments.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organization.recentPayments.map((payment) => {
                  const paymentBadge = PAYMENT_BADGE[payment.status] ?? { label: payment.status, variant: "outline" as const };
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(payment.createdAt)}</TableCell>
                      <TableCell className="text-muted-foreground">{payment.customerEmail}</TableCell>
                      <TableCell>
                        <Badge variant={paymentBadge.variant}>{paymentBadge.label}</Badge>
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">{formatAmount(payment.amount, payment.currency)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <span>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className={strong ? "tabular font-heading text-lg font-bold" : "tabular font-medium"}>{value}</span>
    </span>
  );
}
