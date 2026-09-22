import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COUNTRY_INFO, type CountryCode } from "@/modules/organizations/countries";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";

export const metadata = { title: "Configurações" };

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  FINANCE: "Financeiro",
  SUPPORT: "Suporte",
  MARKETING: "Marketing",
  VIEWER: "Visualizador",
};

export default async function SettingsPage() {
  const { organization, membership } = await requirePagePermission("organization:read");
  const services = getServices();
  const [taxIdentities, verification] = await Promise.all([
    services.uow.repos.organizations.taxIdentities(organization.id),
    services.uow.repos.organizations.latestVerification(organization.id),
  ]);

  return (
    <>
      <PageHeader title="Configurações" description="Dados da organização, identidade fiscal e seu nível de acesso." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organização</CardTitle>
            <CardDescription>Estes dados definem moeda, país e regras financeiras aplicadas às suas vendas.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Item label="Nome" value={organization.name} />
              <Item label="Identificador" value={`/${organization.slug}`} />
              <Item label="País" value={COUNTRY_INFO[organization.country as CountryCode]?.name ?? organization.country} />
              <Item label="Moeda padrão" value={organization.defaultCurrency} />
              <Item label="Tipo" value={organization.businessType === "COMPANY" ? "Empresa" : "Pessoa física"} />
              <Item label="Seu acesso" value={ROLE_LABELS[membership.role] ?? membership.role} />
              <Item label="E-mail de suporte" value={organization.supportEmail ?? "—"} />
              <Item label="Site" value={organization.website ?? "—"} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identidade fiscal e verificação</CardTitle>
            <CardDescription>Guardamos apenas os últimos dígitos do documento; o valor completo nunca é armazenado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>País</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxIdentities.map((identity) => (
                  <TableRow key={identity.type}>
                    <TableCell>{identity.type}</TableCell>
                    <TableCell className="tabular">{identity.maskedValue}</TableCell>
                    <TableCell className="text-muted-foreground">{identity.country}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Verificação:</span>
              <Badge variant={verification?.status === "VERIFIED" ? "success" : verification?.status === "REJECTED" ? "destructive" : "warning"}>
                {verification?.status ?? "NOT_STARTED"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
