import { BuildingIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDate } from "@/lib/ui/format";
import type { OrganizationTotalsRow } from "@/modules/admin/platform-admin.repository";
import { getServices } from "@/server/container";
import { VERIFICATION_BADGE } from "../status-badges";

export const metadata = { title: "Organizações · Admin" };

export default async function AdminOrganizationsPage({ searchParams }: PageProps<"/admin/organizations">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : undefined;
  const services = getServices();
  const [organizations, totals] = await Promise.all([
    services.platformAdmin.listOrganizations(query),
    services.platformAdmin.organizationTotals(),
  ]);

  return (
    <>
      <PageHeader title="Organizações" description="Todos os produtores da plataforma." />

      <form className="flex gap-2">
        <Input name="q" defaultValue={query} placeholder="Buscar por nome, link ou razão social…" aria-label="Buscar organizações" />
        <Button type="submit" variant="outline">
          <SearchIcon />
          Buscar
        </Button>
      </form>

      {organizations.length === 0 ? (
        <EmptyState
          icon={BuildingIcon}
          title="Nenhuma organização encontrada"
          description={query ? "Nenhum produtor corresponde à busca." : "Ainda não há produtores cadastrados."}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead className="hidden lg:table-cell">País</TableHead>
                  <TableHead className="text-right">Vendeu</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Taxa gerada</TableHead>
                  <TableHead className="hidden md:table-cell">Verificação</TableHead>
                  <TableHead className="hidden lg:table-cell">Saques</TableHead>
                  <TableHead className="hidden text-right xl:table-cell">Produtos</TableHead>
                  <TableHead className="hidden lg:table-cell">Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((organization) => {
                  const badge = VERIFICATION_BADGE[organization.verificationStatus ?? "NOT_STARTED"];
                  const rows = totals.get(organization.id) ?? [];
                  return (
                    <TableRow key={organization.id}>
                      <TableCell className="max-w-[52vw] sm:max-w-none">
                        <Link href={`/admin/organizations/${organization.id}`} className="block truncate font-medium hover:underline">
                          {organization.name}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">/{organization.slug}</span>
                        <span className="block text-xs text-muted-foreground lg:hidden">
                          {organization.country} · {organization.products} produto(s) · {organization.orders} pedido(s)
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{organization.country}</TableCell>
                      <TableCell className="tabular text-right whitespace-nowrap">
                        <Money rows={rows} pick={(row) => row.volume} />
                      </TableCell>
                      <TableCell className="tabular hidden text-right whitespace-nowrap text-muted-foreground sm:table-cell">
                        <Money rows={rows} pick={(row) => row.revenue} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={organization.payoutsEnabled ? "success" : "outline"}>
                          {organization.payoutsEnabled ? "Liberados" : "Bloqueados"}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular hidden text-right text-muted-foreground xl:table-cell">{organization.products}</TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                        {formatDate(organization.createdAt)}
                      </TableCell>
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

/**
 * Um produtor pode vender em mais de uma moeda, e somar real com dólar daria um número que não
 * existe. Cada moeda sai na sua linha; sem venda nenhuma, um traço.
 */
function Money({ rows, pick }: { rows: OrganizationTotalsRow[]; pick: (row: OrganizationTotalsRow) => bigint }) {
  if (rows.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-col items-end">
      {rows.map((row) => (
        <span key={row.currency}>{formatAmount(pick(row), row.currency)}</span>
      ))}
    </span>
  );
}
